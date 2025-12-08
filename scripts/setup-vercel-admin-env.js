#!/usr/bin/env node
/**
 * Skripta za postavljanje Firebase Admin environment varijabli na Vercel-u
 * 
 * Korišćenje:
 * 1. Instaliraj Vercel CLI: npm i -g vercel
 * 2. Login: vercel login
 * 3. Pokreni: node scripts/setup-vercel-admin-env.js
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupVercelEnv() {
  console.log('🚀 Firebase Admin Environment Variables Setup za Vercel\n');
  console.log('Potrebni podaci:');
  console.log('1. FIREBASE_PROJECT_ID (npr. zadnji-projekt)');
  console.log('2. FIREBASE_CLIENT_EMAIL (iz Service Account JSON fajla)');
  console.log('3. FIREBASE_PRIVATE_KEY (iz Service Account JSON fajla)\n');
  console.log('Dobij Service Account credentials:');
  console.log('https://console.firebase.google.com/project/zadnji-projekt/settings/serviceaccounts/adminsdk\n');

  try {
    // FIREBASE_PROJECT_ID
    const projectId = await question('FIREBASE_PROJECT_ID (default: zadnji-projekt): ') || 'zadnji-projekt';
    
    // FIREBASE_CLIENT_EMAIL
    console.log('\nFIREBASE_CLIENT_EMAIL format: firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com');
    const clientEmail = await question('FIREBASE_CLIENT_EMAIL: ');
    
    // FIREBASE_PRIVATE_KEY
    console.log('\nFIREBASE_PRIVATE_KEY: Paste cijeli private key (uključujući -----BEGIN PRIVATE KEY----- i -----END PRIVATE KEY-----)');
    console.log('Tip: Možeš paste-ovati direktno iz JSON fajla');
    const privateKey = await question('FIREBASE_PRIVATE_KEY: ');

    if (!clientEmail || !privateKey) {
      console.error('❌ FIREBASE_CLIENT_EMAIL i FIREBASE_PRIVATE_KEY su obavezni!');
      process.exit(1);
    }

    console.log('\n📝 Postavljam environment varijable na Vercel...\n');

    const environments = ['production', 'preview', 'development'];
    
    for (const env of environments) {
      console.log(`\n🔧 Postavljam za ${env}...`);
      
      // FIREBASE_PROJECT_ID
      try {
        execSync(`vercel env add FIREBASE_PROJECT_ID ${env} <<< "${projectId}"`, { stdio: 'inherit' });
        console.log(`✅ FIREBASE_PROJECT_ID postavljen za ${env}`);
      } catch (error) {
        console.log(`⚠️  FIREBASE_PROJECT_ID za ${env} - možda već postoji`);
      }
      
      // FIREBASE_CLIENT_EMAIL
      try {
        execSync(`vercel env add FIREBASE_CLIENT_EMAIL ${env} <<< "${clientEmail}"`, { stdio: 'inherit' });
        console.log(`✅ FIREBASE_CLIENT_EMAIL postavljen za ${env}`);
      } catch (error) {
        console.log(`⚠️  FIREBASE_CLIENT_EMAIL za ${env} - možda već postoji`);
      }
      
      // FIREBASE_PRIVATE_KEY
      try {
        // Escape private key za shell
        const escapedKey = privateKey.replace(/\$/g, '\\$').replace(/`/g, '\\`');
        execSync(`vercel env add FIREBASE_PRIVATE_KEY ${env} <<< "${escapedKey}"`, { stdio: 'inherit' });
        console.log(`✅ FIREBASE_PRIVATE_KEY postavljen za ${env}`);
      } catch (error) {
        console.log(`⚠️  FIREBASE_PRIVATE_KEY za ${env} - možda već postoji`);
      }
    }

    console.log('\n✅ Uspešno postavljene environment varijable!');
    console.log('\n⚠️  VAŽNO: Trebaš redeploy projekat na Vercel-u:');
    console.log('   1. Idi na Vercel Dashboard');
    console.log('   2. Odaberi projekat');
    console.log('   3. Klikni "Redeploy" ili commit novi push na GitHub');
    
  } catch (error) {
    console.error('❌ Greška:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupVercelEnv();

