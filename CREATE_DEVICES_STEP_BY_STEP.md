# Korak-po-korak kreiranje devices tabele

## Korak 1: Poveži se na server
```bash
ssh root@46.224.115.49
```

## Korak 2: Otvori PostgreSQL
```bash
sudo -u postgres psql -d office_app
```

## Korak 3: Provjeri da li tabela već postoji
```sql
\d devices
```
Ako kaže "Did not find any relation", nastavi dalje.

## Korak 4: Pokreni CREATE TABLE komandu
Kopiraj i paste ovu komandu:

```sql
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_info JSONB,
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}',
  is_blocked BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Trebalo bi vidjeti: `CREATE TABLE`

## Korak 5: Kreiraj indexe
```sql
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
```

## Korak 6: Provjeri da li je kreirano
```sql
\d devices
```

Ili:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'devices';
```

Ako vidiš tabelu, uspješno je kreirano!

## Korak 7: Izađi
```sql
\q
```

## Korak 8: Testiraj lokalno
Vrati se lokalno i testiraj login!

