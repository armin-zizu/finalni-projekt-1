const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://office_user:Jasamkonj12_@localhost:5432/office_app'
});

async function run() {
  try {
    console.log('🔄 Adding contact and phone columns to suppliers...');
    
    const client = await pool.connect();
    
    await client.query(`
      ALTER TABLE suppliers 
      ADD COLUMN IF NOT EXISTS contact TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_suppliers_contact ON suppliers(contact);
    `);
    
    client.release();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
