# Deployment Opcije - Poređenje

## Trenutna situacija:
- **Vercel** - automatski deployment na push
- **Firebase Hosting** - konfigurisan ali ne koristi se aktivno

## Opcije za jednostavniji deployment:

### 1. **Vercel (TRENUTNO - NAJBOLJE ZA NEXT.JS)** ✅
**Prednosti:**
- ✅ Automatski deployment na push
- ✅ Preview deployments za svaki branch/PR
- ✅ Besplatan za personal projekte
- ✅ Optimizovan za Next.js
- ✅ CDN globalno
- ✅ SSL automatski
- ✅ Environment variables lako postavljaju

**Kako koristiti Preview Deployments:**
- Svaki push na `main` → Production deployment
- Svaki push na drugi branch → Preview deployment (link se generiše automatski)
- Svaki PR → Preview deployment

**Problem:** Production link možda ne update-uje se automatski
**Rješenje:** Ručno "Promote to Production" u Vercel Dashboard

---

### 2. **Firebase Hosting** (Već imaš konfigurisan)
**Prednosti:**
- ✅ Već koristiš Firebase (Firestore, Auth)
- ✅ Besplatan tier
- ✅ Integracija sa Firebase servisima

**Nedostaci:**
- ❌ Next.js nije statički (treba `next export` ili custom server)
- ❌ Komplikovanije za Next.js App Router
- ❌ Manje optimizovan za Next.js nego Vercel

**Kako koristiti:**
```bash
# Build statički export
npm run build
# Deploy na Firebase
firebase deploy --only hosting
```

**Problem:** Next.js App Router ne može biti potpuno statički, treba custom server ili Vercel/Netlify.

---

### 3. **Netlify** (Alternativa Vercel-u)
**Prednosti:**
- ✅ Slično kao Vercel
- ✅ Automatski deployment
- ✅ Preview deployments
- ✅ Besplatan tier

**Nedostaci:**
- ❌ Manje optimizovan za Next.js nego Vercel
- ❌ Treba migracija sa Vercel-a

---

### 4. **Vercel CLI - Brži Deployment** (PREPORUČENO)
**Prednosti:**
- ✅ Deployment direktno iz terminala
- ✅ Brže nego čekanje GitHub webhook-a
- ✅ Možeš deploy-ovati bez push-a
- ✅ Isti servis kao web deployment

**Kako koristiti:**
```bash
# Instaliraj Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (prvi put)
vercel

# Deploy na production
vercel --prod

# Deploy sa environment variables
vercel --prod --env FIREBASE_API_KEY=xxx
```

**Ovo je NAJBRŽI način za testiranje!**

---

### 5. **GitHub Pages** (NE PREPORUČUJE SE)
**Nedostaci:**
- ❌ Samo statički sajtovi
- ❌ Next.js ne može direktno
- ❌ Treba custom build proces

---

## PREPORUKA:

### **Najbolja opcija: Vercel + Vercel CLI**

**Za brže testiranje:**
1. Instaliraj Vercel CLI: `npm i -g vercel`
2. Deploy direktno: `vercel --prod`
3. Link je dostupan za 1-2 minute

**Za automatski deployment:**
- Ostavi kako je (push na GitHub → automatski deployment)
- Koristi Preview Deployments za testiranje prije production-a

**Za rješavanje problema sa production linkom:**
- Vercel Dashboard → Deployments → "Promote to Production"
- ILI koristi Vercel CLI: `vercel --prod`

---

## Quick Start - Vercel CLI:

```bash
# 1. Instaliraj
npm i -g vercel

# 2. Login (prvi put)
vercel login

# 3. Link projekat (prvi put)
vercel link

# 4. Deploy na production
vercel --prod

# 5. Deploy preview (bez production)
vercel
```

**Link će biti dostupan odmah!**

---

## Alternativa - Firebase Hosting (ako želiš):

Ako želiš koristiti Firebase Hosting umjesto Vercel-a:

1. **Konfiguriši Next.js za static export:**
```typescript
// next.config.ts
const nextConfig = {
  output: 'export', // Static export
  // ...
};
```

2. **Build i deploy:**
```bash
npm run build
firebase deploy --only hosting
```

**Problem:** Next.js App Router ne može biti potpuno statički, tako da neke funkcije možda neće raditi.

---

## Zaključak:

**Vercel je NAJBOLJA opcija za Next.js!**

- Koristi **Vercel CLI** za brže deployment
- Ostavi automatski deployment za production
- Koristi Preview Deployments za testiranje

**Ne mijenjaj na Firebase Hosting** jer ćeš imati problema sa Next.js App Router funkcionalnostima.

