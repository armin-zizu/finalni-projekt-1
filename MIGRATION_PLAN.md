# Plan Migracije sa Firebase-a na Vlastiti Server

## 📋 Pregled trenutne infrastrukture

### Firebase servisi koje koristite:
1. **Firebase Authentication**
   - Login/Registracija
   - Password reset
   - Email verifikacija
   - Session management

2. **Firestore Database**
   - Collection: `users/{userId}`
     - appName
     - cjenovnik (array artikala)
     - role, permissions, isOwner
     - devices (array)
     - sessions (array)
     - payments (array)
     - subscription info
   - Collection: `users/{userId}/obracuni/{obracunId}`
     - Svi obračuni sa artiklima, datumom, itd.

3. **Firebase Storage**
   - Backup PDF fajlovi

---

## 🎯 Plan Migracije - Korak po Korak

### **FAZA 1: Priprema servera i baze podataka**

#### 1.1 Instalacija na serveru
```bash
# Na vašem Hetzner serveru:
- PostgreSQL ili MySQL baza podataka
- Node.js backend (Express ili Next.js API routes)
- Nginx reverse proxy (opcionalno)
```

#### 1.2 Schema baze podataka (PostgreSQL primer)
```sql
-- Users tabela
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_info JSONB, -- {os, browser, screenSize}
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}',
  is_blocked BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions tabela
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255),
  session_name VARCHAR(255),
  date VARCHAR(50),
  status VARCHAR(50),
  device VARCHAR(255),
  location VARCHAR(255),
  ip VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cjenovnik tabela
CREATE TABLE cjenovnik (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  naziv VARCHAR(255) NOT NULL,
  cijena DECIMAL(10, 2) NOT NULL,
  proizvodna_cijena DECIMAL(10, 2),
  zestoko_kolicina DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Obračuni tabela
CREATE TABLE obracuni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  datum VARCHAR(50) NOT NULL,
  artikli JSONB NOT NULL, -- Array artikala
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments tabela
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  note TEXT,
  date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions tabela
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50), -- 'active', 'expired', 'cancelled'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- File uploads tabela (za backup PDF-ove)
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **FAZA 2: Backend API Development**

#### 2.1 Next.js API Routes struktura
```
src/app/api/
  ├── auth/
  │   ├── login/route.ts
  │   ├── register/route.ts
  │   ├── logout/route.ts
  │   ├── reset-password/route.ts
  │   └── verify-email/route.ts
  ├── users/
  │   ├── [userId]/
  │   │   ├── route.ts (GET, PUT)
  │   │   ├── devices/route.ts
  │   │   ├── sessions/route.ts
  │   │   ├── cjenovnik/route.ts
  │   │   ├── obracuni/route.ts
  │   │   └── payments/route.ts
  │   └── app-name/route.ts
  └── files/
      └── upload/route.ts
```

#### 2.2 Backend biblioteke
```json
{
  "dependencies": {
    "pg": "^8.11.0", // PostgreSQL client
    "bcryptjs": "^2.4.3", // Password hashing
    "jsonwebtoken": "^9.0.2", // JWT tokens
    "nodemailer": "^6.9.0", // Email sending
    "multer": "^1.4.5", // File uploads
    "express-validator": "^7.0.1" // Validation
  }
}
```

---

### **FAZA 3: Migracija podataka**

#### 3.1 Export podataka iz Firebase
- Script za eksport svih Firestore kolekcija u JSON
- Export Storage fajlova

#### 3.2 Import u novu bazu
- Script za konverziju JSON-a u SQL INSERT statements
- Upload fajlova na novi server

---

### **FAZA 4: Zamjena Frontend koda**

#### 4.1 Nova API utility funkcija
```typescript
// src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://your-server.com/api';

export const api = {
  // Auth
  login: async (email: string, password: string) => { ... },
  register: async (email: string, password: string) => { ... },
  logout: async () => { ... },
  
  // Users
  getUser: async (userId: string) => { ... },
  updateUser: async (userId: string, data: any) => { ... },
  
  // Cjenovnik
  getCjenovnik: async (userId: string) => { ... },
  updateCjenovnik: async (userId: string, cjenovnik: any[]) => { ... },
  
  // Obračuni
  getObracuni: async (userId: string) => { ... },
  createObracun: async (userId: string, obracun: any) => { ... },
  deleteObracun: async (userId: string, obracunId: string) => { ... },
  
  // Devices, Sessions, Payments, itd.
};
```

#### 4.2 Zamjena Firebase poziva
- Zamijeniti sve `firebase/auth` pozive sa API pozivima
- Zamijeniti sve `firebase/firestore` pozive sa API pozivima
- Zamijeniti sve `firebase/storage` pozive sa API pozivima

---

### **FAZA 5: Autentifikacija**

#### 5.1 JWT Token sistema
- Backend generiše JWT token nakon uspješnog login-a
- Frontend čuva token u localStorage ili httpOnly cookie
- API route middleware provjerava token pri svakom zahtjevu

#### 5.2 Session management
- Next.js middleware za zaštitu ruta
- Auto-refresh token mehanizam
- Logout čisti token

---

### **FAZA 6: Testiranje i Deployment**

#### 6.1 Testiranje
- [ ] Login/Registracija radi
- [ ] Svi podaci se učitavaju
- [ ] Obračuni se kreiraju/brišu
- [ ] File uploads rade
- [ ] Permissions/roles rade
- [ ] Mobile responsive radi

#### 6.2 Production deployment
- Backup Firebase podataka (za svaki slučaj)
- Deploy backend API na server
- Update frontend environment variables
- Deploy frontend na Vercel
- Monitor prvi dan za greške

---

## 📝 Checklist za migraciju

### Backend
- [ ] Setup baze podataka na serveru
- [ ] Kreirati API routes za sve operacije
- [ ] Implementirati autentifikaciju (JWT)
- [ ] Implementirati middleware za zaštitu ruta
- [ ] File upload funkcionalnost
- [ ] Error handling i logging

### Frontend
- [ ] Kreirati API utility funkcije
- [ ] Zamijeniti Firebase Auth pozive
- [ ] Zamijeniti Firestore pozive
- [ ] Zamijeniti Storage pozive
- [ ] Update Context provideri (AppName, Cjenovnik, Role, Subscription)
- [ ] Update sve stranice (login, dashboard, obracun, arhiva, profit, cjenovnik, profile, admin)
- [ ] Update sidebar i layout komponente

### Migracija podataka
- [ ] Export Firestore podataka
- [ ] Export Storage fajlova
- [ ] Import u novu bazu
- [ ] Verifikacija podataka

### Testing & Deployment
- [ ] Lokalno testiranje
- [ ] Test na staging serveru
- [ ] Production deployment
- [ ] Monitoring i bug fixes

---

## ⚠️ Važne napomene

1. **Backup prvo**: Uvijek backup Firebase podataka prije migracije
2. **Postupna migracija**: Možete raditi paralelno - Firebase i novi sistem, pa postupno prebacivati
3. **Environment variables**: Ne zaboravite postaviti nove env varijable:
   - `NEXT_PUBLIC_API_URL`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `EMAIL_SMTP_*` (za email funkcionalnosti)

4. **Vremenska procjena**: 
   - Backend API: 5-7 dana
   - Frontend zamjena: 3-5 dana
   - Migracija podataka: 1-2 dana
   - Testiranje: 2-3 dana
   - **Ukupno: 2-3 sedmice**

---

## 🚀 Sljedeći koraci

1. **Odlučite se za bazu podataka** (PostgreSQL preporučeno)
2. **Setup servera** - instalacija potrebnih servisa
3. **Kreiranje baze podataka** - koristite SQL schema iznad
4. **Počnite sa backend API developmentom** - prvo auth, pa ostalo

Jeste li spremni da počnemo sa implementacijom? Možemo početi sa bilo kojom fazom!


