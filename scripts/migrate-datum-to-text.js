// Node.js skripta za migraciju kolone 'datum' iz 'date' u 'text'
// Koristi istu konekciju kao aplikacija

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrateDatumToText() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Počinje migracija...');
    
    // 1. Prvo, konvertujemo postojeće datume u DD.MM.YYYY format u datum_raw ako postoji
    console.log('📝 Konvertovanje postojećih datuma u datum_raw kolonu...');
    await client.query(`
      UPDATE obracuni 
      SET datum_raw = TO_CHAR(datum, 'DD.MM.YYYY')
      WHERE datum_raw IS NULL OR datum_raw = ''
    `);
    
    // 2. Promenimo tip kolone 'datum' iz 'date' u 'text'
    console.log('🔄 Menjanje tipa kolone datum iz date u text...');
    await client.query(`
      ALTER TABLE obracuni 
      ALTER COLUMN datum TYPE text USING TO_CHAR(datum, 'DD.MM.YYYY')
    `);
    
    console.log('✅ Migracija uspešno završena!');
    console.log('📋 Kolona datum je sada tipa TEXT i koristi format DD.MM.YYYY');
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Greška pri migraciji:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateDatumToText()
  .then(() => {
    console.log('✅ Migracija završena');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migracija neuspešna:', error);
    process.exit(1);
  });

