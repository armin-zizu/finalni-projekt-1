-- Kreiranje subscriptions tabele
-- Ova tabela čuva podatke o pretplati korisnika
-- Struktura je kompatibilna sa Firebase subscription dokumentima

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'inactive', 'grace_period'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  monthly_price DECIMAL(10, 2) NOT NULL DEFAULT 12.00,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  grace_end_date TIMESTAMP WITH TIME ZONE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_data JSONB DEFAULT '{}'::jsonb, -- Za dodatne podatke (paymentPendingVerification, paymentRequestedAt, itd.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id),
  CONSTRAINT fk_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Kreiranje payments tabele
-- Ova tabela čuva istoriju plaćanja

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  note TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payments_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Kreiranje indexa za brže pretrage
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date DESC);

COMMENT ON TABLE subscriptions IS 'Tabela za čuvanje podataka o pretplati korisnika';
COMMENT ON TABLE payments IS 'Tabela za čuvanje istorije plaćanja pretplate';

