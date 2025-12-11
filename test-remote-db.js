require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'office_app',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: false, // Za development
});

pool.query('SELECT NOW() as current_time, version() as pg_version')
  .then(res => {
    console.log('✅ Konekcija uspješna!');
    console.log('Vrijeme:', res.rows[0].current_time);
    console.log('PostgreSQL verzija:', res.rows[0].pg_version);
    pool.end();
  })
  .catch(err => {
    console.error('❌ Greška:', err.message);
    pool.end();
    process.exit(1);
  });

