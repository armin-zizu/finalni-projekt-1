const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('🗑️ Deleting all suppliers from database...');
    
    const result = await pool.query('DELETE FROM suppliers RETURNING id');
    console.log(`✅ Deleted ${result.rowCount} suppliers`);
    
    const countResult = await pool.query('SELECT COUNT(*) as cnt FROM suppliers');
    console.log(`📊 Remaining suppliers: ${countResult.rows[0].cnt}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
