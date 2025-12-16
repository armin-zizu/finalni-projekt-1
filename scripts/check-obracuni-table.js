const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkObracuniTable() {
  try {
    console.log('🔍 Proveravam strukturu tabele obracuni...\n');
    
    // Proveri kolone u tabeli obracuni
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'obracuni'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Kolone u tabeli obracuni:');
    if (columnsResult.rows.length === 0) {
      console.log('   ❌ Tabela obracuni NE POSTOJI!');
    } else {
      columnsResult.rows.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}${col.column_default ? ` - default: ${col.column_default}` : ''}`);
      });
    }
    
    // Proveri da li postoji kolona artikli
    const artikliColumn = columnsResult.rows.find(col => col.column_name === 'artikli');
    if (artikliColumn) {
      console.log('\n✅ Kolona "artikli" POSTOJI');
      console.log(`   Tip: ${artikliColumn.data_type}`);
    } else {
      console.log('\n❌ Kolona "artikli" NE POSTOJI');
      console.log('   Dostupne kolone:', columnsResult.rows.map(col => col.column_name).join(', '));
    }
    
    // Proveri da li postoji kolona data (možda je to umesto artikli)
    const dataColumn = columnsResult.rows.find(col => col.column_name === 'data');
    if (dataColumn) {
      console.log('\n⚠️  Kolona "data" POSTOJI (možda se koristi umesto artikli?)');
      console.log(`   Tip: ${dataColumn.data_type}`);
    }
    
    // Proveri da li postoji kolona saved_at
    const savedAtColumn = columnsResult.rows.find(col => col.column_name === 'saved_at');
    if (savedAtColumn) {
      console.log('\n✅ Kolona "saved_at" POSTOJI');
    } else {
      console.log('\n❌ Kolona "saved_at" NE POSTOJI');
      const createdAtColumn = columnsResult.rows.find(col => col.column_name === 'created_at');
      const updatedAtColumn = columnsResult.rows.find(col => col.column_name === 'updated_at');
      if (createdAtColumn) console.log('   ✅ Kolona "created_at" POSTOJI');
      if (updatedAtColumn) console.log('   ✅ Kolona "updated_at" POSTOJI');
    }
    
    // Proveri tip user_id kolone
    const userIdColumn = columnsResult.rows.find(col => col.column_name === 'user_id');
    if (userIdColumn) {
      console.log(`\n📝 Kolona "user_id" - Tip: ${userIdColumn.data_type}`);
    }
    
    // Proveri tip datum kolone
    const datumColumn = columnsResult.rows.find(col => col.column_name === 'datum');
    if (datumColumn) {
      console.log(`\n📝 Kolona "datum" - Tip: ${datumColumn.data_type}`);
    }
    
  } catch (error) {
    console.error('❌ Greška pri proveri strukture tabele:', error.message);
  } finally {
    await pool.end();
  }
}

checkObracuniTable();

