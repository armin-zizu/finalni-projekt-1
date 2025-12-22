-- Office App Database Schema
-- PostgreSQL Database Schema za migraciju sa Firebase-a

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users tabela
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) DEFAULT 'Moja Aplikacija',
  role VARCHAR(50) DEFAULT NULL, -- 'vlasnik', 'konobar', NULL
  is_owner BOOLEAN DEFAULT FALSE,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Devices tabela
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_info JSONB, -- {os, browser, screenSize, ip}
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}',
  is_blocked BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  status VARCHAR(50), -- 'active', 'blocked', 'pending'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_id) -- Ensure same user cannot have duplicate entries for same device
);

-- Sessions tabela
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255),
  session_name VARCHAR(255),
  date VARCHAR(50),
  status VARCHAR(50), -- 'active', 'ended'
  device VARCHAR(255),
  location VARCHAR(255),
  ip VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cjenovnik tabela
CREATE TABLE IF NOT EXISTS cjenovnik (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  naziv VARCHAR(255) NOT NULL,
  cijena DECIMAL(10, 2) NOT NULL,
  proizvodna_cijena DECIMAL(10, 2),
  zestoko_kolicina DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, naziv)
);

-- Obračuni tabela
CREATE TABLE IF NOT EXISTS obracuni (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  datum VARCHAR(50) NOT NULL, -- Format: "DD.MM.YYYY"
  artikli JSONB NOT NULL, -- Array artikala sa svim detaljima
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, datum)
);

-- Payments tabela
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  note TEXT,
  date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions tabela
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status VARCHAR(50), -- 'active', 'expired', 'cancelled'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- File uploads tabela (za backup PDF-ove i druge fajlove)
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  file_type VARCHAR(50), -- 'backup', 'document', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes za brže pretrage
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_id ON cjenovnik(user_id);
CREATE INDEX IF NOT EXISTS idx_obracuni_user_id ON obracuni(user_id);
CREATE INDEX IF NOT EXISTS idx_obracuni_datum ON obracuni(datum);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);

-- Function za automatski update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers za automatski update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cjenovnik_updated_at BEFORE UPDATE ON cjenovnik
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_obracuni_updated_at BEFORE UPDATE ON obracuni
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments za dokumentaciju
COMMENT ON TABLE users IS 'Glavna tabela korisnika aplikacije';
COMMENT ON TABLE devices IS 'Uređaji sa kojih se korisnici prijavljuju';
COMMENT ON TABLE sessions IS 'Sesije korisnika';
COMMENT ON TABLE cjenovnik IS 'Cjenovnik artikala za svakog korisnika';
COMMENT ON TABLE obracuni IS 'Arhiva obračuna';
COMMENT ON TABLE payments IS 'Plaćanja korisnika';
COMMENT ON TABLE subscriptions IS 'Pretplate korisnika';
COMMENT ON TABLE file_uploads IS 'Upload-ovani fajlovi (backup PDF-ovi, itd.)';


