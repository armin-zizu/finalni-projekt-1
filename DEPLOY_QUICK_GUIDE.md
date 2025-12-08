# Brzi Deployment Guide - Vercel CLI

## ✅ Projekat je već link-ovan sa Vercel-om!

## Kako deploy-ovati:

### **Production Deployment** (glavni link):
```bash
npm run deploy
```
**ILI:**
```bash
vercel --prod
```

### **Preview Deployment** (za testiranje):
```bash
npm run deploy:preview
```
**ILI:**
```bash
vercel
```

## Workflow:

### 1. **Napravi promjene u kodu**

### 2. **Commit i push na GitHub** (za backup i verzioniranje):
```bash
git add .
git commit -m "Opis promjena"
git push origin main
```

### 3. **Deploy na Vercel** (za testiranje na telefonu):
```bash
npm run deploy
```

### 4. **Provjeri link na telefonu** (za 1-2 minute)

## Napomena:

- Production deployment: `npm run deploy` → `office-app-eight.vercel.app`
- Preview deployment: `npm run deploy:preview` → privremeni link
- Deployment traje 1-2 minute
- Link je dostupan odmah nakon deploymenta

## Prednosti ovog pristupa:

✅ **Brže** - deployment direktno, bez čekanja GitHub webhook-a  
✅ **Pouzdanije** - direktna kontrola deploymenta  
✅ **Lako za testiranje** - možeš deploy-ovati i bez push-a  

## Backup (opcionalno):

I dalje možeš push-ovati na GitHub za verzioniranje, ali deployment možeš raditi direktno sa `npm run deploy`.

