// Script to run migration directly via database connection
// This will only work if the database user has ALTER TABLE permissions
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const isRemote = connectionString.includes('localhost') === false;

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📋 Reading migration script...');
    const sqlScript = fs.readFileSync(path.join(__dirname, 'migrate-users-table.sql'), 'utf8');
    
    // Split script by semicolons and execute each statement
    // We'll execute it as one query since it's in a transaction
    console.log('🔄 Starting migration...');
    
    const result = await client.query(sqlScript);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Final table structure:');
    
    // Get final structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    columns.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}`);
    });
    
  } catch (error) {
    if (error.code === '42501') {
      console.error('\n❌ ERROR: Permission denied!');
      console.error('The database user does not have ALTER TABLE permissions.');
      console.error('\n💡 You need to run this migration via SSH on the server with a user that has proper permissions.');
      console.error('\n📝 Instructions:');
      console.error('1. SSH into your server');
      console.error('2. Navigate to this project directory');
      console.error('3. Run: psql -h 46.224.115.49 -U postgres -d office_app -f migrate-users-table.sql');
      console.error('   (Use postgres superuser or another user with ALTER TABLE permissions)');
    } else {
      console.error('\n❌ Migration failed:', error.message);
      console.error(error);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('🚀 Attempting to run migration via Node.js...');
console.log('Note: This will only work if your database user has ALTER TABLE permissions.\n');
runMigration();

