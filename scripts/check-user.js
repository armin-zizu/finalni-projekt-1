const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Database connection pool
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUser(email) {
  try {
    console.log('🔍 Checking user:', email);
    console.log('📍 Database:', process.env.DB_HOST || 'localhost', process.env.DB_NAME || 'office_app');
    
    // 1. Proveri da li korisnik postoji po email-u
    const userCheck = await pool.query(
      'SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    if (userCheck.rows.length === 0) {
      console.log('❌ Korisnik NE POSTOJI u bazi:', email);
      
      // Proveri sve korisnike
      const allUsers = await pool.query('SELECT id, email, role FROM users ORDER BY email');
      console.log('\n📋 Svi korisnici u bazi:');
      if (allUsers.rows.length === 0) {
        console.log('   (Nema korisnika u bazi)');
      } else {
        allUsers.rows.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.email} (ID: ${user.id}, Role: ${user.role || 'N/A'})`);
        });
      }
    } else {
      const user = userCheck.rows[0];
      console.log('✅ Korisnik POSTOJI u bazi:');
      console.log('   Email:', user.email);
      console.log('   ID (UUID):', user.id);
      console.log('   Role:', user.role || 'N/A');
      
      // 2. Proveri obračune za ovog korisnika
      const obracuniCheck = await pool.query(
        'SELECT COUNT(*) as count FROM obracuni WHERE user_id = $1',
        [user.id]
      );
      console.log('\n📊 Broj obračuna za ovog korisnika:', obracuniCheck.rows[0].count);
      
      // 3. Proveri strukturu tabele obracuni
      const tableInfo = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'obracuni' 
        ORDER BY ordinal_position
      `);
      console.log('\n📋 Struktura tabele obracuni:');
      tableInfo.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
      
      // 4. Proveri poslednje obračune (bez created_at ako ne postoji)
      let dateColumn = 'datum';
      try {
        const lastObracuni = await pool.query(
          'SELECT datum, id FROM obracuni WHERE user_id = $1 ORDER BY datum DESC LIMIT 5',
          [user.id]
        );
        
        if (lastObracuni.rows.length > 0) {
          console.log('\n📅 Poslednji obračuni:');
          lastObracuni.rows.forEach((obracun, index) => {
            console.log(`   ${index + 1}. Datum: ${obracun.datum}, ID: ${obracun.id}`);
          });
        }
      } catch (err) {
        console.log('\n⚠️  Ne mogu da učitam obračune:', err.message);
      }
    }
    
    // 5. Proveri da li postoji obračun za datum 15.12.2025
    try {
      const datumCheck = await pool.query(
        'SELECT id, datum, user_id FROM obracuni WHERE datum = $1',
        ['15.12.2025']
      );
      
      if (datumCheck.rows.length > 0) {
        console.log('\n📆 Obračuni za datum 15.12.2025:');
        for (const obracun of datumCheck.rows) {
          const userForObracun = await pool.query(
            'SELECT email FROM users WHERE id::text = $1',
            [obracun.user_id]
          );
          const userEmail = userForObracun.rows[0]?.email || 'Nepoznat korisnik';
          console.log(`   - ID: ${obracun.id}, Korisnik: ${userEmail}`);
        }
      } else {
        console.log('\n📆 Nema obračuna za datum 15.12.2025');
      }
    } catch (err) {
      console.log('\n⚠️  Ne mogu da proverim obračune za datum:', err.message);
    }
    
    // 6. Proveri strukturu tabele users
    const usersTableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Struktura tabele users:');
    usersTableInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // 7. Proveri da li je ID UUID ili ne
    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log('\n🔍 Analiza ID-ja korisnika:');
      console.log(`   ID: "${user.id}"`);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(user.id)) {
        console.log('   ✅ ID je validan UUID format');
      } else {
        console.log('   ❌ ID NIJE validan UUID format!');
        console.log('   ⚠️  PROBLEM: API kod pokušava da koristi ovaj ID kao UUID u SQL upitima!');
        console.log('   ⚠️  Tabela `obracuni` ima `user_id: text`, ali API koristi `$1::uuid` cast!');
      }
    }
    
  } catch (error) {
    console.error('❌ Greška:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    console.error('   Hint:', error.hint);
  } finally {
    await pool.end();
  }
}

// Proveri email iz argumenta ili koristi default
const emailToCheck = process.argv[2] || 'gitara.zizu@gmail.com';
checkUser(emailToCheck);

