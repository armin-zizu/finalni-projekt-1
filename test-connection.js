// Quick database connection test
// Pokrenite: node test-connection.js

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'office_app',
  user: process.env.DB_USER || 'office_user',
  password: process.env.DB_PASSWORD,
});

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log('   Server time:', result.rows[0].now);
    
    // Test if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('\n📊 Tables found:');
      tablesResult.rows.forEach(row => {
        console.log('   -', row.table_name);
      });
    } else {
      console.log('\n⚠️  No tables found. Import database_schema.sql');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error('   Error:', error.message);
    console.error('\n💡 Provjerite:');
    console.error('   1. Da li je PostgreSQL pokrenut?');
    console.error('   2. Da li su credentials u .env.local tačni?');
    console.error('   3. Da li baza podataka postoji?');
    await pool.end();
    process.exit(1);
  }
}

testConnection();


