// Script to set password for existing user
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const isRemote = connectionString.includes('localhost') === false;

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

async function setPassword(email, password) {
  try {
    console.log(`Setting password for user: ${email}`);
    
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, email, password_hash, role, is_owner FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (userCheck.rows.length === 0) {
      console.log(`\n❌ User with email "${email}" does not exist.`);
      console.log('Use the register functionality on the login page instead.');
      process.exit(1);
    }
    
    const user = userCheck.rows[0];
    
    if (user.password_hash) {
      console.log(`\n⚠️  User already has a password_hash!`);
      console.log('If you want to change it, you can use this script with --force flag.');
      console.log('Or use the "Forgot password" functionality (if implemented).');
      process.exit(1);
    }
    
    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Update user with password hash
    // Also set as owner if no role is set (first user scenario)
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL');
    const isFirstUserWithPassword = parseInt(userCount.rows[0].count) === 0;
    
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           role = CASE WHEN role IS NULL AND $2 THEN 'vlasnik' ELSE role END,
           is_owner = CASE WHEN NOT is_owner AND $2 THEN true ELSE is_owner END,
           updated_at = NOW()
       WHERE email = $3`,
      [passwordHash, isFirstUserWithPassword, email.toLowerCase().trim()]
    );
    
    console.log(`\n✅ Password set successfully for ${email}!`);
    if (isFirstUserWithPassword) {
      console.log('✅ User set as owner (vlasnik) - first user with password.');
    }
    console.log('\nYou can now login with this email and password.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node set-user-password.js <email> <password>');
  console.log('Example: node set-user-password.js gitara.zizu@gmail.com mypassword123');
  process.exit(1);
}

if (password.length < 6) {
  console.log('❌ Password must be at least 6 characters long.');
  process.exit(1);
}

setPassword(email, password);

