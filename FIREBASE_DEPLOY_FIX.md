# Firebase Hosting Deploy Fix

## Problem:
Firebase Hosting prikazuje default "Welcome" stranicu umjesto aplikacije jer aplikacija nije pravilno build-ovana za static export.

## Rješenje:
Ažurirana je konfiguracija da generiše statičke fajlove u `out` folderu koji Firebase Hosting očekuje.

## Šta je urađeno:

1. **next.config.ts** - Dodano `output: 'export'` za static export
2. **next.config.ts** - Ažurirano `images.unoptimized: true` (potrebno za static export)
3. **package.json** - Dodana `export` skripta (opcionalno)

## Kako deploy-ovati:

### Automatski (preko GitHub):
1. Push-uj promjene na GitHub:
   ```bash
   git add .
   git commit -m "Fix Firebase Hosting static export"
   git push
   ```
2. GitHub Actions će automatski:
   - Build-ovati aplikaciju (`npm run build`)
   - Generisati `out` folder sa statičkim fajlovima
   - Deploy-ovati na Firebase Hosting

### Ručno (lokalno):
1. Build-uj aplikaciju:
   ```bash
   npm run build
   ```
2. Provjeri da li je kreiran `out` folder
3. Deploy-uj na Firebase:
   ```bash
   firebase deploy --only hosting
   ```

## Napomene:

- **Static Export:** Aplikacija se sada build-uje kao statički site, što znači da sve stranice moraju biti statičke
- **Firebase Functions:** Ako koristiš Firebase Functions, one se deploy-uju odvojeno
- **Environment Variables:** Provjeri da li su sve `NEXT_PUBLIC_*` varijable postavljene u Firebase Hosting environment variables

## Troubleshooting:

### Ako build ne uspije:
- Provjeri da li sve stranice mogu biti statički export-ovane
- Provjeri da li nema server-side koda u client komponentama
- Provjeri konzolu za greške

### Ako se aplikacija ne prikazuje:
- Provjeri da li je `out` folder kreiran nakon build-a
- Provjeri Firebase Hosting konzolu za greške
- Provjeri da li su svi fajlovi deploy-ovani

