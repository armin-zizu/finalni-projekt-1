# Fix Build Stuck on "Creating an optimized production build"

## Problem
Build se zaustavlja na "Creating an optimized production build" i ne završava.

## Rješenja

### 1. Provjeri Node.js memoriju

```bash
node --max-old-space-size=4096 node_modules/.bin/next build
```

### 2. Build sa verbose output-om

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### 3. Provjeri TypeScript greške (ako postoji tsconfig)

```bash
npx tsc --noEmit
```

### 4. Očisti cache i rebuild

```bash
rm -rf .next
rm -rf node_modules/.cache
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### 5. Build bez TypeScript provjere (temporary)

Dodaj u `next.config.js`:
```js
typescript: {
  ignoreBuildErrors: true,
},
```

### 6. Provjeri da li ima memory limit problema

```bash
# Provjeri memoriju
free -h

# Ako je memorija niska, restartuj Node proces
```

### 7. Skip TypeScript i ESLint provjere (brži build)

```bash
SKIP_ENV_VALIDATION=true npm run build
```

Ili u `next.config.js`:
```js
eslint: {
  ignoreDuringBuilds: true,
},
typescript: {
  ignoreBuildErrors: true,
},
```

