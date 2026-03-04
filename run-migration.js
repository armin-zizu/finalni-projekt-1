// Run migration to add contact and phone fields to suppliers table
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  // Load .env.local
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Running migration: add_contact_phone_to_suppliers.sql');

    const migrationFile = path.join(__dirname, 'migrations', 'add_contact_phone_to_suppliers.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
