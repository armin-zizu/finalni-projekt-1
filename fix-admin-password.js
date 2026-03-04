const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
  const password = 'novasifra123';
  const saltRounds = 10;
  
  try {
    const hashed = await bcrypt.hash(password, saltRounds);
    console.log('Heširana šifra:');
    console.log(hashed);
    console.log('\n');
    console.log('SQL komanda koja trebam da se izvrši:');
    console.log(`UPDATE users SET password_hash = '${hashed}' WHERE email = 'gitara.zizu@gmail.com';`);
  } catch (error) {
    console.error('Greška:', error);
  }
}

updateAdminPassword();
