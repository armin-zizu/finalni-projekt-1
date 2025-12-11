/**
 * PostgreSQL Import Script
 * Importuje eksportovane Firebase podatke u PostgreSQL bazu
 * 
 * Usage:
 *   1. Postavi DATABASE_URL ili .env.local sa DB podacima
 *   2. Pokreni: node scripts/import-to-postgresql.js
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const EXPORT_FILE = path.join(__dirname, '../exported-data/firebase-export.json');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'office_user'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper za konverziju Firebase Timestamp u PostgreSQL timestamp
function convertTimestamp(field) {
  if (!field) return null;
  
  // Ako je već string datum
  if (typeof field === 'string') {
    // Pokušaj parsirati različite formate
    const date = new Date(field);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return field; // Vrati kao string ako ne može parsirati
  }
  
  // Ako je Firebase Timestamp objekt
  if (field._seconds || field.seconds) {
    const seconds = field._seconds || field.seconds;
    const nanoseconds = field._nanoseconds || field.nanoseconds || 0;
    return new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
  }
  
  // Ako je Date objekt
  if (field instanceof Date) {
    return field.toISOString();
  }
  
  return null;
}

// Konvertuj Firebase data u PostgreSQL format
function convertUserData(firebaseUser) {
  return {
    email: firebaseUser.email || null,
    password_hash: firebaseUser.passwordHash || firebaseUser.password_hash || null,
    app_name: firebaseUser.appName || firebaseUser.app_name || 'Moja Aplikacija',
    role: firebaseUser.role || null,
    is_owner: firebaseUser.isOwner || firebaseUser.is_owner || false,
    permissions: firebaseUser.permissions || {},
    created_at: convertTimestamp(firebaseUser.createdAt) || new Date().toISOString(),
    updated_at: convertTimestamp(firebaseUser.updatedAt) || new Date().toISOString()
  };
}

function convertDeviceData(firebaseDevice, userId) {
  return {
    user_id: userId,
    device_id: firebaseDevice.deviceId || firebaseDevice.device_id || firebaseDevice.id,
    device_name: firebaseDevice.deviceName || firebaseDevice.device_name || null,
    device_info: firebaseDevice.deviceInfo || firebaseDevice.device_info || {},
    role: firebaseDevice.role || null,
    permissions: firebaseDevice.permissions || {},
    is_blocked: firebaseDevice.isBlocked || firebaseDevice.is_blocked || false,
    last_login: convertTimestamp(firebaseDevice.lastLogin) || convertTimestamp(firebaseDevice.last_login),
    status: firebaseDevice.status || 'active',
    created_at: convertTimestamp(firebaseDevice.createdAt) || new Date().toISOString(),
    updated_at: convertTimestamp(firebaseDevice.updatedAt) || new Date().toISOString()
  };
}

function convertSessionData(firebaseSession, userId) {
  return {
    user_id: userId,
    device_id: firebaseSession.deviceId || firebaseSession.device_id || null,
    session_name: firebaseSession.sessionName || firebaseSession.session_name || null,
    date: firebaseSession.date || null,
    status: firebaseSession.status || 'active',
    device: firebaseSession.device || null,
    location: firebaseSession.location || null,
    ip: firebaseSession.ip || null,
    created_at: convertTimestamp(firebaseSession.createdAt) || new Date().toISOString()
  };
}

function convertCjenovnikData(firebaseCjenovnik, userId) {
  return {
    user_id: userId,
    naziv: firebaseCjenovnik.naziv || firebaseCjenovnik.nazivArtikla || '',
    cijena: parseFloat(firebaseCjenovnik.cijena) || 0,
    proizvodna_cijena: parseFloat(firebaseCjenovnik.proizvodnaCijena) || parseFloat(firebaseCjenovnik.proizvodna_cijena) || null,
    zestoko_kolicina: parseFloat(firebaseCjenovnik.zestokoKolicina) || parseFloat(firebaseCjenovnik.zestoko_kolicina) || null,
    created_at: convertTimestamp(firebaseCjenovnik.createdAt) || new Date().toISOString(),
    updated_at: convertTimestamp(firebaseCjenovnik.updatedAt) || new Date().toISOString()
  };
}

function convertObracunData(firebaseObracun, userId) {
  return {
    user_id: userId,
    datum: firebaseObracun.datum || firebaseObracun.date || '',
    artikli: firebaseObracun.artikli || firebaseObracun.artikli || [],
    created_at: convertTimestamp(firebaseObracun.createdAt) || new Date().toISOString(),
    updated_at: convertTimestamp(firebaseObracun.updatedAt) || new Date().toISOString()
  };
}

// Glavna import funkcija
async function importData() {
  console.log('🚀 Počinjem import podataka u PostgreSQL...\n');
  
  // Učitaj eksportovane podatke
  let exportData;
  try {
    const fileContent = await fs.readFile(EXPORT_FILE, 'utf8');
    exportData = JSON.parse(fileContent);
    console.log(`✅ Učitano: ${EXPORT_FILE}`);
    console.log(`   Eksportovano: ${exportData.exportedAt}\n`);
  } catch (error) {
    console.error(`❌ Greška pri učitavanju ${EXPORT_FILE}:`, error.message);
    console.error('Molim vas prvo pokrenite scripts/export-firebase-data.js');
    process.exit(1);
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userIdMap = {}; // Mapiranje Firebase user ID -> PostgreSQL UUID
    
    // 1. Importuj korisnike
    console.log('📋 Korak 1: Import korisnika...');
    for (const [firebaseUserId, userData] of Object.entries(exportData.users)) {
      const userDataConverted = convertUserData(userData);
      
      // Provjeri da li korisnik već postoji (po email-u)
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userDataConverted.email]
      );
      
      let postgresUserId;
      if (existingUser.rows.length > 0) {
        postgresUserId = existingUser.rows[0].id;
        console.log(`   ⚠️  Korisnik ${userDataConverted.email} već postoji, preskačem...`);
      } else {
        const result = await client.query(
          `INSERT INTO users (email, password_hash, app_name, role, is_owner, permissions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            userDataConverted.email,
            userDataConverted.password_hash || 'MIGRATED_NO_PASSWORD', // Ovo će trebati resetovati
            userDataConverted.app_name,
            userDataConverted.role,
            userDataConverted.is_owner,
            JSON.stringify(userDataConverted.permissions),
            userDataConverted.created_at,
            userDataConverted.updated_at
          ]
        );
        postgresUserId = result.rows[0].id;
        console.log(`   ✅ Importovan korisnik: ${userDataConverted.email}`);
      }
      
      userIdMap[firebaseUserId] = postgresUserId;
    }
    
    // 2. Importuj uređaje
    console.log('\n📋 Korak 2: Import uređaja...');
    for (const [deviceId, deviceData] of Object.entries(exportData.devices)) {
      const firebaseUserId = deviceData.userId || deviceData.user_id;
      const postgresUserId = userIdMap[firebaseUserId];
      
      if (!postgresUserId) {
        console.log(`   ⚠️  Preskačem uređaj ${deviceId} - korisnik ne postoji`);
        continue;
      }
      
      const deviceDataConverted = convertDeviceData(deviceData, postgresUserId);
      
      try {
        await client.query(
          `INSERT INTO devices (user_id, device_id, device_name, device_info, role, permissions, is_blocked, last_login, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (device_id) DO NOTHING`,
          [
            deviceDataConverted.user_id,
            deviceDataConverted.device_id,
            deviceDataConverted.device_name,
            JSON.stringify(deviceDataConverted.device_info),
            deviceDataConverted.role,
            JSON.stringify(deviceDataConverted.permissions),
            deviceDataConverted.is_blocked,
            deviceDataConverted.last_login,
            deviceDataConverted.status,
            deviceDataConverted.created_at,
            deviceDataConverted.updated_at
          ]
        );
        console.log(`   ✅ Importovan uređaj: ${deviceDataConverted.device_id}`);
      } catch (error) {
        console.log(`   ⚠️  Greška pri importu uređaja ${deviceId}: ${error.message}`);
      }
    }
    
    // 3. Importuj sesije, cjenovnik i obračune za svakog korisnika
    console.log('\n📋 Korak 3: Import korisničkih podataka...');
    for (const [firebaseUserId, userData] of Object.entries(exportData.users)) {
      const postgresUserId = userIdMap[firebaseUserId];
      if (!postgresUserId) continue;
      
      console.log(`   👤 Korisnik: ${userData.email || firebaseUserId}`);
      
      // Sesije
      for (const [sessionId, sessionData] of Object.entries(userData.sessions || {})) {
        const sessionDataConverted = convertSessionData(sessionData, postgresUserId);
        await client.query(
          `INSERT INTO sessions (user_id, device_id, session_name, date, status, device, location, ip, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            sessionDataConverted.user_id,
            sessionDataConverted.device_id,
            sessionDataConverted.session_name,
            sessionDataConverted.date,
            sessionDataConverted.status,
            sessionDataConverted.device,
            sessionDataConverted.location,
            sessionDataConverted.ip,
            sessionDataConverted.created_at
          ]
        );
      }
      console.log(`      ✅ ${Object.keys(userData.sessions || {}).length} sesija`);
      
      // Cjenovnik
      for (const [cjenovnikId, cjenovnikData] of Object.entries(userData.cjenovnik || {})) {
        const cjenovnikDataConverted = convertCjenovnikData(cjenovnikData, postgresUserId);
        try {
          await client.query(
            `INSERT INTO cjenovnik (user_id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, naziv) DO UPDATE SET
               cijena = EXCLUDED.cijena,
               proizvodna_cijena = EXCLUDED.proizvodna_cijena,
               zestoko_kolicina = EXCLUDED.zestoko_kolicina,
               updated_at = EXCLUDED.updated_at`,
            [
              cjenovnikDataConverted.user_id,
              cjenovnikDataConverted.naziv,
              cjenovnikDataConverted.cijena,
              cjenovnikDataConverted.proizvodna_cijena,
              cjenovnikDataConverted.zestoko_kolicina,
              cjenovnikDataConverted.created_at,
              cjenovnikDataConverted.updated_at
            ]
          );
        } catch (error) {
          console.log(`      ⚠️  Greška pri importu cjenovnika: ${error.message}`);
        }
      }
      console.log(`      ✅ ${Object.keys(userData.cjenovnik || {}).length} stavki cjenovnika`);
      
      // Obračuni
      for (const [datum, obracunData] of Object.entries(userData.obracuni || {})) {
        const obracunDataConverted = convertObracunData(obracunData, postgresUserId);
        await client.query(
          `INSERT INTO obracuni (user_id, datum, artikli, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            obracunDataConverted.user_id,
            obracunDataConverted.datum,
            JSON.stringify(obracunDataConverted.artikli),
            obracunDataConverted.created_at,
            obracunDataConverted.updated_at
          ]
        );
      }
      console.log(`      ✅ ${Object.keys(userData.obracuni || {}).length} obračuna`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Import završen uspješno!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Greška pri importu:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Pokreni import
importData()
  .then(() => {
    console.log('\n🎉 Gotovo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Greška:', error);
    process.exit(1);
  });






