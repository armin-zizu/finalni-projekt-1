// Script to check if user has password_hash and help set it
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const isRemote = connectionString.includes('localhost') === false;

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

async function checkUser(email) {
  try {
    console.log(`Checking user: ${email}`);
    
    const result = await pool.query(
      'SELECT id, email, password_hash, role, is_owner FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (result.rows.length === 0) {
      console.log(`\n❌ User with email "${email}" does not exist in database.`);
      console.log('\n💡 You need to REGISTER this user first (create account on login page).');
      return;
    }
    
    const user = result.rows[0];
    
    console.log(`\n✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role || '(not set)'}`);
    console.log(`   Is Owner: ${user.is_owner}`);
    console.log(`   Password Hash: ${user.password_hash ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!user.password_hash) {
      console.log(`\n⚠️  User exists but has NO password_hash!`);
      console.log(`\n💡 Options:`);
      console.log(`   1. REGISTER a new account with this email (will fail if email exists)`);
      console.log(`   2. Set password manually via SQL (see below)`);
      console.log(`\n📝 SQL to set password manually:`);
      console.log(`   You need to hash the password first, then update the user.`);
      console.log(`   Or use the register endpoint which will create a new user.`);
      console.log(`\n💡 Best solution: Use the REGISTER functionality on the login page!`);
    } else {
      console.log(`\n✅ User has password_hash - login should work!`);
      console.log(`\nIf login still fails, check:`);
      console.log(`   - Password is correct`);
      console.log(`   - Password hash was created with bcrypt`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node check-user-password.js <email>');
  console.log('Example: node check-user-password.js gitara.zizu@gmail.com');
  process.exit(1);
}

checkUser(email);

