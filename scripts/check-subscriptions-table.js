const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkTable() {
  try {
    console.log('Checking if subscriptions table exists...\n');
    
    // Check if subscriptions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subscriptions'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`Subscriptions table exists: ${tableExists}\n`);
    
    if (tableExists) {
      // Get table structure
      const structure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'subscriptions'
        ORDER BY ordinal_position;
      `);
      
      console.log('Table structure:');
      console.table(structure.rows);
      
      // Check if payments table exists
      const paymentsCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payments'
        );
      `);
      
      const paymentsExists = paymentsCheck.rows[0].exists;
      console.log(`\nPayments table exists: ${paymentsExists}\n`);
      
      if (paymentsExists) {
        const paymentsStructure = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'payments'
          ORDER BY ordinal_position;
        `);
        
        console.log('Payments table structure:');
        console.table(paymentsStructure.rows);
      }
      
      // Count subscriptions
      const count = await pool.query('SELECT COUNT(*) FROM subscriptions');
      console.log(`\nTotal subscriptions: ${count.rows[0].count}`);
      
      // Show sample data
      const sample = await pool.query('SELECT * FROM subscriptions LIMIT 5');
      if (sample.rows.length > 0) {
        console.log('\nSample subscriptions:');
        console.log(JSON.stringify(sample.rows, null, 2));
      }
    } else {
      console.log('\n⚠️  Subscriptions table does not exist!');
      console.log('Please run: psql -h localhost -U office_user -d office_app -f scripts/create-subscriptions-table.sql');
      console.log('Or use the SQL script in scripts/create-subscriptions-table.sql');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkTable();


