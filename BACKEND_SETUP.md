# Backend Setup Guide

## 📋 Prvi koraci

### 1. Instalacija na serveru

```bash
# Na vašem Hetzner serveru, instalirajte PostgreSQL:
sudo apt update
sudo apt install postgresql postgresql-contrib

# Pokrenite PostgreSQL:
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Kreirajte bazu podataka:
sudo -u postgres psql
CREATE DATABASE office_app;
CREATE USER office_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE office_app TO office_user;
\q
```

### 2. Kreiranje baze podataka

```bash
# Kopirajte database_schema.sql na server i izvršite:
psql -U office_user -d office_app -f database_schema.sql
```

### 3. Environment Variables

Kopirajte `.env.example` u `.env.local` i popunite sa vašim podacima:

```bash
cp .env.example .env.local
```

**Važno**: Promijenite `JWT_SECRET` u nešto sigurno (minimalno 32 karaktera)!

### 4. Testiranje konekcije

Dodajte test route za provjeru konekcije:

```typescript
// src/app/api/test-db/route.ts
import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db';

export async function GET() {
  const isConnected = await testConnection();
  return NextResponse.json({ connected: isConnected });
}
```

Zatim pozovite: `http://localhost:3000/api/test-db`

---

## 🔐 API Endpoints

### POST /api/auth/login
Login korisnika

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "vlasnik",
    "isOwner": true,
    "permissions": {}
  },
  "token": "jwt_token_here"
}
```

### POST /api/auth/register
Registracija novog korisnika

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "vlasnik",
    "isOwner": true,
    "permissions": {}
  },
  "token": "jwt_token_here"
}
```

### POST /api/auth/logout
Logout korisnika (čisti cookie)

---

## 🧪 Testiranje sa curl

```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","confirmPassword":"password123"}'

# Test sa tokenom (nakon login-a)
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📝 Sljedeći koraci

1. ✅ Database schema kreirana
2. ✅ Auth API kreiran (login/register/logout)
3. ⏭️ Kreirati API za:
   - Users (GET, PUT)
   - Cjenovnik (GET, POST, PUT, DELETE)
   - Obračuni (GET, POST, DELETE)
   - Devices (GET, POST, PUT, DELETE)
   - Sessions (GET, DELETE)
   - Payments (GET, POST)
   - File uploads (POST, GET, DELETE)

4. ⏭️ Zamijeniti Firebase pozive u frontendu

---

## ⚠️ Važne napomene

1. **JWT_SECRET**: Morate postaviti siguran secret u production!
2. **Database**: Osigurajte backup baze podataka
3. **HTTPS**: U production koristite HTTPS za sigurnost
4. **CORS**: Možda ćete trebati konfigurisati CORS ako frontend i backend nisu na istom domenu

---

## 🐛 Troubleshooting

### Database connection error
- Provjerite da li je PostgreSQL pokrenut: `sudo systemctl status postgresql`
- Provjerite credentials u `.env.local`
- Provjerite firewall: `sudo ufw allow 5432`

### JWT errors
- Provjerite da li je `JWT_SECRET` postavljen
- Token mora biti u Authorization header: `Bearer <token>`

### Port conflicts
- Next.js default port je 3000
- Provjerite da li je port slobodan: `netstat -tuln | grep 3000`


