const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function addDisplayOrderColumn() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Počinje migracija - dodavanje display_order kolone...');
    
    // Step 1: Add display_order column
    console.log('📝 Dodavanje display_order kolone...');
    await client.query(`
      ALTER TABLE cjenovnik 
      ADD COLUMN IF NOT EXISTS display_order INTEGER;
    `);
    
    // Step 2: Migrate existing data
    console.log('📝 Migriranje postojećih podataka (dodjela display_order)...');
    const updateResult = await client.query(`
      UPDATE cjenovnik
      SET display_order = subquery.row_num - 1
      FROM (
        SELECT 
          id,
          user_id,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY naziv ASC) as row_num
        FROM cjenovnik
        WHERE display_order IS NULL
      ) AS subquery
      WHERE cjenovnik.id = subquery.id AND cjenovnik.user_id = subquery.user_id;
    `);
    console.log(`   ✅ Ažurirano ${updateResult.rowCount} redova`);
    
    // Step 3: Create index
    console.log('📝 Kreiranje indeksa za display_order...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cjenovnik_display_order ON cjenovnik(user_id, display_order);
    `);
    
    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cjenovnik' AND column_name = 'display_order';
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Kolona display_order je uspješno dodana!');
      console.log('   Detalji:', verifyResult.rows[0]);
    } else {
      throw new Error('Kolona display_order nije pronađena nakon migracije!');
    }
    
    console.log('✅ Migracija uspešno završena!');
    
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

addDisplayOrderColumn().catch(error => {
  console.error('❌ Migracija nije uspela:', error);
  process.exit(1);
});

