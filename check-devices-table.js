// Script to check devices table structure
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const isRemote = connectionString.includes('localhost') === false;

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

async function checkTables() {
  try {
    console.log('Checking users table...');
    
    // Check users table structure
    const usersColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Users table columns:');
    usersColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check users data
    const users = await pool.query('SELECT id, email FROM users LIMIT 5');
    console.log('\n👤 Sample users:');
    users.rows.forEach(user => {
      console.log(`  - ID: ${user.id} (${typeof user.id}) - Email: ${user.email}`);
    });
    
    // Check if devices table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'devices'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('\n❌ Table "devices" does not exist!');
      console.log('You need to create it using database_schema.sql');
      process.exit(1);
    }
    
    console.log('\n✅ Table "devices" exists');
    
    // Check devices table structure
    const devicesColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'devices' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Devices table columns:');
    devicesColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}`);
    });
    
    // Check foreign key constraint
    const foreignKeys = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'devices'
        AND kcu.column_name = 'user_id';
    `);
    
    console.log('\n🔗 Foreign key constraints:');
    if (foreignKeys.rows.length > 0) {
      foreignKeys.rows.forEach(fk => {
        console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    // Check devices count
    const deviceCount = await pool.query('SELECT COUNT(*) as count FROM devices');
    console.log(`\n📱 Total devices: ${deviceCount.rows[0].count}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkTables();

