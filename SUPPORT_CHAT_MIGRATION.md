# Migracija: Kreiranje support_messages tabele

Chat sistem zahteva tabelu `support_messages` u bazi podataka. Ako tabela ne postoji, chat neće raditi.

## Problem

Aplikacija nema dozvole za automatsko kreiranje tabele (`permission denied for schema public`). Tabela mora biti kreirana ručno.

## Rješenje

### Opcija 1: Ručno kreiranje (preporučeno)

Prijavite se na server i pokrenite SQL komande:

```bash
# Prijavite se kao postgres korisnik
sudo -u postgres psql office_app

# Ili direktno:
psql -U postgres -d office_app
```

Zatim izvršite SQL komande:

```sql
-- Kreiraj tabelu
-- Napomena: users.id je TEXT tip, ne UUID
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  is_admin_response BOOLEAN DEFAULT FALSE,
  conversation_id UUID NOT NULL,
  CONSTRAINT support_messages_message_check CHECK (LENGTH(TRIM(message)) > 0)
);

-- Kreiraj indexe za performanse
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id 
ON support_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id 
ON support_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_created_at 
ON support_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_unread 
ON support_messages(is_read, created_at DESC) 
WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_support_messages_user_conversation 
ON support_messages(user_id, conversation_id, created_at DESC);

-- Grant permissions aplikaciji (zamijenite 'your_db_user' sa stvarnim korisnikom)
-- GRANT SELECT, INSERT, UPDATE ON support_messages TO your_db_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_db_user;
```

### Opcija 2: Koristeći SQL fajl

Ako imate pristup serveru:

```bash
# Kopirajte SQL fajl na server
scp scripts/create-support-messages-table.sql user@server:/path/to/app/

# Na serveru:
sudo -u postgres psql -d office_app -f /path/to/app/scripts/create-support-messages-table.sql
```

### Opcija 3: Node.js skripta (ako ima dozvole)

```bash
# Na serveru, u direktorijumu aplikacije:
node scripts/create-support-messages-table.js
```

**Napomena:** Ova opcija će vjerovatno neuspeti zbog nedostatka dozvola. Koristite Opciju 1.

## Provjera

Nakon kreiranja tabele, provjerite:

```sql
-- Provjerite da li tabela postoji
\dt support_messages

-- Provjerite strukturu tabele
\d support_messages

-- Provjerite indexe
\di idx_support_messages*
```

## Nakon migracije

1. Restartujte aplikaciju:
   ```bash
   pm2 restart office-app --update-env
   ```

2. Testirajte chat:
   - Otvorite `/profile` stranicu
   - Kliknite na chat dugme (desno donje)
   - Pošaljite test poruku

## Troubleshooting

### Greška: "permission denied for schema public"

- Koristite `postgres` korisnika za kreiranje tabele
- Ili dodajte dozvole vašem DB korisniku:
  ```sql
  ALTER USER your_db_user WITH CREATEDB;
  GRANT CREATE ON SCHEMA public TO your_db_user;
  ```

### Greška: "relation users does not exist"

- Provjerite da li `users` tabela postoji u bazi
- Tabela `support_messages` zahteva referencu na `users` tabelu

### Chat ne radi nakon migracije

1. Provjerite da li je tabela kreirana:
   ```sql
   SELECT COUNT(*) FROM support_messages;
   ```

2. Provjerite dozvole aplikacijskog korisnika:
   ```sql
   \dp support_messages
   ```

3. Provjerite server logove za greške

