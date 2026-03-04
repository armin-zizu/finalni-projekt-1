const pg = require('pg');

const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'office_app',
  password: '',
  port: 5432,
});

const hash = '$2b$10$Zyet0drpjH2eLdcCfQbj4.lB0fFgUnYHeFbIVCIqiK0fBAwKccRrK';

(async () => {
  try {
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, LENGTH(password_hash) as hash_length',
      [hash, 'gitara.zizu@gmail.com']
    );
    console.log('✓ Password updated successfully');
    console.log('Email:', result.rows[0].email);
    console.log('Hash length:', result.rows[0].hash_length);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
