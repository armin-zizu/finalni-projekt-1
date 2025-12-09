# 🚀 Sljedeći koraci - Firebase Migration

## 📋 Trenutno stanje:

✅ **Završeno:**
- Firebase config fajlovi obrisani
- Firebase lib fajlovi obrisani  
- Firebase dependency uklonjen iz package.json
- Osnovni backend infrastructure kreiran:
  - Database utility (src/lib/db.ts)
  - JWT utility (src/lib/jwt.ts)
  - Password utility (src/lib/password.ts)
  - Auth middleware (src/lib/auth-middleware.ts)
  - Auth API routes (login, register, logout)
  - Database schema (database_schema.sql)

⏳ **U toku:**
- Firebase pozivi još uvijek u kodu (ostavljamo dok ne implementiramo API)

## 🎯 Plan rada:

### **FAZA 1: Server Setup** (Prvi korak)
1. Povezivanje na Hetzner server u Cursor-u (Remote-SSH)
2. Instalacija PostgreSQL na serveru
3. Kreiranje baze podataka
4. Import database_schema.sql
5. Postavljanje environment variables (.env.local)
6. Testiranje konekcije

### **FAZA 2: API Development** (Paralelno sa setupom)
Kreiranje API endpointova koje ćemo testirati:

1. **Users API:**
   - GET /api/users/me - Dohvati trenutnog korisnika
   - PUT /api/users/me - Ažuriraj korisnika (app_name, itd.)

2. **Cjenovnik API:**
   - GET /api/users/[userId]/cjenovnik
   - POST /api/users/[userId]/cjenovnik
   - PUT /api/users/[userId]/cjenovnik

3. **Obračuni API:**
   - GET /api/users/[userId]/obracuni
   - POST /api/users/[userId]/obracuni
   - DELETE /api/users/[userId]/obracuni/[datum]

4. **Devices API:**
   - GET /api/users/[userId]/devices
   - POST /api/users/[userId]/devices
   - PUT /api/users/[userId]/devices/[deviceId]

5. **Sessions API:**
   - GET /api/users/[userId]/sessions
   - DELETE /api/users/[userId]/sessions/[sessionId]

6. **Files API:**
   - POST /api/files/upload
   - GET /api/files/[fileId]
   - DELETE /api/files/[fileId]

### **FAZA 3: Frontend Integration**
Postupna zamjena Firebase poziva sa API pozivima:
1. Login/Register stranica
2. Cjenovnik context
3. Obračuni stranica
4. Arhiva stranica
5. Profile stranica
6. Dashboard stranica

## 🏁 Odakle počinjemo:

**OPCIJA A: Server setup prvo** (Preporučeno)
- Povezivanje na server
- Setup baze podataka
- Zatim API development i testiranje

**OPCIJA B: API development prvo**
- Kreiramo API endpointove lokalno
- Zatim setup servera i testiranje

---

**Preporuka:** Krenimo sa **OPCIJOM A** - prvo server setup, pa API development.

