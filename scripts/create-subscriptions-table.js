const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Creating subscriptions and payments tables...\n');
    
    await client.query('BEGIN');
    
    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'trial',
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        monthly_price DECIMAL(10, 2) NOT NULL DEFAULT 12.00,
        trial_end_date TIMESTAMP WITH TIME ZONE,
        grace_end_date TIMESTAMP WITH TIME ZONE,
        last_payment_date TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        subscription_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id),
        CONSTRAINT fk_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ subscriptions table created');
    
    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        note TEXT,
        date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        valid_until TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_payments_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ payments table created');
    
    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date DESC);');
    console.log('✅ indexes created');
    
    await client.query('COMMIT');
    console.log('\n✅ All tables created successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error creating tables:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();


