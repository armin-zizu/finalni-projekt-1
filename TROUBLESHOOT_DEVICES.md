# Troubleshooting devices table creation

## Problem
Tabela `devices` se ne može kreirati.

## Korak 1: Provjeri šta se dešava

Na serveru u psql:
```bash
sudo -u postgres psql -d office_app
```

Pokreni ove debug komande jednu po jednu:

### 1. Provjeri da li tabela već postoji
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'devices'
) as table_exists;
```

### 2. Provjeri korisnika i bazu
```sql
SELECT current_user, current_database();
```

### 3. Provjeri users tabelu
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';
```

### 4. Probaj kreirati JEDNOSTAVNU verziju (bez foreign key)
```sql
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Ako ovo radi**, onda je problem sa foreign key constraint-om.

### 5. Ako jednostavna verzija radi, dodaj foreign key NAKNADNO:
```sql
ALTER TABLE devices 
ADD CONSTRAINT devices_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

### 6. Zatim dodaj preostale kolone:
```sql
ALTER TABLE devices ADD COLUMN device_name VARCHAR(255);
ALTER TABLE devices ADD COLUMN device_info JSONB;
ALTER TABLE devices ADD COLUMN role VARCHAR(50);
ALTER TABLE devices ADD COLUMN permissions JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN last_login TIMESTAMP;
ALTER TABLE devices ADD COLUMN status VARCHAR(50);
ALTER TABLE devices ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
```

### 7. Kreiraj indexe:
```sql
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
```

## Korak 2: Ako dobiješ GREŠKU, kopiraj je ovdje

Moguće greške:
- `permission denied` - problem sa pravima
- `relation already exists` - tabela već postoji pod drugim imenom
- `foreign key constraint` - problem sa users tabelom
- `syntax error` - greška u SQL sintaksi

Javi šta dobiješ nakon svake komande!

