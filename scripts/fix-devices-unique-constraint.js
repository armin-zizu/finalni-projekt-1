/**
 * Migration script to fix devices table unique constraint
 * Changes from device_id UNIQUE to (user_id, device_id) UNIQUE
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration: Fix devices unique constraint...');
    
    // Step 1: Remove old UNIQUE constraint on device_id (outside transaction to avoid issues)
    console.log('📝 Step 1: Removing old UNIQUE constraint on device_id...');
    try {
      await client.query('ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_key');
      console.log('✅ Removed devices_device_id_key constraint');
    } catch (error) {
      if (error.code !== '42704') { // 42704 = undefined_object
        console.log('⚠️  Error removing devices_device_id_key:', error.message);
      } else {
        console.log('✅ devices_device_id_key constraint does not exist (already removed)');
      }
    }
    
    try {
      await client.query('ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_unique');
      console.log('✅ Removed devices_device_id_unique constraint');
    } catch (error) {
      if (error.code !== '42704') {
        console.log('⚠️  Error removing devices_device_id_unique:', error.message);
      } else {
        console.log('✅ devices_device_id_unique constraint does not exist (already removed)');
      }
    }
    
    await client.query('BEGIN');
    
    // Step 2: Clean up duplicate entries before adding new constraint
    console.log('📝 Step 2: Cleaning up duplicate entries...');
    const duplicateCheck = await client.query(`
      SELECT user_id, device_id, COUNT(*) as count
      FROM devices
      GROUP BY user_id, device_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCheck.rows.length > 0) {
      console.log(`⚠️  Found ${duplicateCheck.rows.length} duplicate device entries. Cleaning up...`);
      
      const deleteDuplicates = await client.query(`
        WITH ranked_devices AS (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY user_id, device_id ORDER BY 
                   COALESCE(last_login, created_at) DESC, created_at DESC) as rn
          FROM devices
        )
        DELETE FROM devices
        WHERE id IN (
          SELECT id FROM ranked_devices WHERE rn > 1
        )
        RETURNING id
      `);
      
      console.log(`✅ Deleted ${deleteDuplicates.rows.length} duplicate entries`);
    } else {
      console.log('✅ No duplicate entries found');
    }
    
    // Step 3: Add new UNIQUE constraint on (user_id, device_id)
    console.log('📝 Step 3: Adding new UNIQUE constraint on (user_id, device_id)...');
    await client.query(`
      ALTER TABLE devices 
      ADD CONSTRAINT devices_user_id_device_id_unique 
      UNIQUE (user_id, device_id)
    `);
    console.log('✅ Added devices_user_id_device_id_unique constraint');
    
    // Step 4: Create index for faster lookups
    console.log('📝 Step 4: Creating index for faster lookups...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_user_device 
      ON devices(user_id, device_id)
    `);
    console.log('✅ Created index idx_devices_user_device');
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });

