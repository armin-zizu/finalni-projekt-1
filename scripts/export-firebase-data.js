/**
 * Firebase Data Export Script
 * Eksportuje sve podatke iz Firebase Firestore i Storage za migraciju u PostgreSQL
 * 
 * Usage:
 *   1. Instaliraj Firebase Admin SDK: npm install firebase-admin
 *   2. Postavi FIREBASE_SERVICE_ACCOUNT_KEY environment variable ili fajl
 *   3. Pokreni: node scripts/export-firebase-data.js
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin
// Opcija 1: Koristi environment variable sa JSON string-om
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} 
// Opcija 2: Koristi fajl (ne commitaj u git!)
else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
// Opcija 3: Traži lokalni fajl
else {
  try {
    const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('❌ Greška: Ne mogu pronaći Firebase Service Account.');
    console.error('Molim vas postavite FIREBASE_SERVICE_ACCOUNT_KEY ili FIREBASE_SERVICE_ACCOUNT_PATH');
    console.error('Ili stvorite firebase-service-account.json u root direktorijumu.');
    process.exit(1);
  }
}

const db = admin.firestore();
const storage = admin.storage();

const EXPORT_DIR = path.join(__dirname, '../exported-data');
const EXPORT_FILE = path.join(EXPORT_DIR, 'firebase-export.json');

// Helper funkcija za rekurzivni eksport kolekcije
async function exportCollection(collectionPath) {
  console.log(`📦 Eksportujem: ${collectionPath}`);
  const snapshot = await db.collection(collectionPath).get();
  const data = {};
  
  for (const doc of snapshot.docs) {
    data[doc.id] = {
      ...doc.data(),
      _exportedAt: new Date().toISOString()
    };
  }
  
  console.log(`   ✅ Eksportovano ${Object.keys(data).length} dokumenata`);
  return data;
}

// Helper funkcija za eksport subkolekcija
async function exportSubcollection(parentPath, subcollectionName) {
  console.log(`📁 Eksportujem subkolekciju: ${parentPath}/${subcollectionName}`);
  const parentDoc = await db.doc(parentPath).get();
  
  if (!parentDoc.exists) {
    return {};
  }
  
  const subcollectionRef = parentDoc.ref.collection(subcollectionName);
  const snapshot = await subcollectionRef.get();
  const data = {};
  
  for (const doc of snapshot.docs) {
    data[doc.id] = {
      ...doc.data(),
      _exportedAt: new Date().toISOString()
    };
  }
  
  console.log(`   ✅ Eksportovano ${Object.keys(data).length} dokumenata`);
  return data;
}

// Eksport Storage fajlova (fakture)
async function exportStorageFiles(userId) {
  console.log(`📎 Eksportujem Storage fajlove za user: ${userId}`);
  const bucket = storage.bucket();
  const prefix = `fakture/${userId}/`;
  
  try {
    const [files] = await bucket.getFiles({ prefix });
    const fileList = [];
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2500' // Dugi rok za download
      });
      
      fileList.push({
        name: file.name,
        url: signedUrl,
        metadata: {
          contentType: metadata.contentType,
          size: metadata.size,
          timeCreated: metadata.timeCreated,
          updated: metadata.updated
        }
      });
    }
    
    console.log(`   ✅ Pronađeno ${fileList.length} fajlova`);
    return fileList;
  } catch (error) {
    console.warn(`   ⚠️  Greška pri eksportu Storage fajlova: ${error.message}`);
    return [];
  }
}

// Glavna funkcija za eksport
async function exportAllData() {
  console.log('🚀 Počinjem eksport Firebase podataka...\n');
  
  // Kreiraj export direktorijum
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
  } catch (error) {
    // Već postoji
  }
  
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    users: {},
    devices: {},
    loginApprovals: {}
  };
  
  // 1. Eksportuj users
  console.log('\n📋 Korak 1: Eksport korisnika...');
  const usersSnapshot = await db.collection('users').get();
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    exportData.users[userId] = {
      ...userData,
      obracuni: {},
      sessions: {},
      cjenovnik: {},
      subscription: {},
      storageFiles: []
    };
    
    // Eksportuj subkolekcije za svakog korisnika
    console.log(`\n   👤 Korisnik: ${userId}`);
    
    // Obračuni
    const obracuni = await exportSubcollection(`users/${userId}`, 'obracuni');
    exportData.users[userId].obracuni = obracuni;
    
    // Sesije
    const sessions = await exportSubcollection(`users/${userId}`, 'sessions');
    exportData.users[userId].sessions = sessions;
    
    // Cjenovnik
    const cjenovnik = await exportSubcollection(`users/${userId}`, 'cjenovnik');
    exportData.users[userId].cjenovnik = cjenovnik;
    
    // Subscription
    const subscription = await exportSubcollection(`users/${userId}`, 'subscription');
    exportData.users[userId].subscription = subscription;
    
    // Storage fajlovi (fakture)
    const storageFiles = await exportStorageFiles(userId);
    exportData.users[userId].storageFiles = storageFiles;
  }
  
  // 2. Eksportuj devices
  console.log('\n📋 Korak 2: Eksport uređaja...');
  exportData.devices = await exportCollection('devices');
  
  // 3. Eksportuj loginApprovals
  console.log('\n📋 Korak 3: Eksport login approvals...');
  exportData.loginApprovals = await exportCollection('loginApprovals');
  
  // 4. Sačuvaj sve u JSON fajl
  console.log('\n💾 Čuvanje eksportovanih podataka...');
  await fs.writeFile(EXPORT_FILE, JSON.stringify(exportData, null, 2), 'utf8');
  
  // Statistika
  const stats = {
    users: Object.keys(exportData.users).length,
    devices: Object.keys(exportData.devices).length,
    loginApprovals: Object.keys(exportData.loginApprovals).length,
    totalObracuni: Object.values(exportData.users).reduce((sum, user) => sum + Object.keys(user.obracuni || {}).length, 0),
    totalSessions: Object.values(exportData.users).reduce((sum, user) => sum + Object.keys(user.sessions || {}).length, 0),
    totalCjenovnik: Object.values(exportData.users).reduce((sum, user) => sum + Object.keys(user.cjenovnik || {}).length, 0),
    totalStorageFiles: Object.values(exportData.users).reduce((sum, user) => sum + (user.storageFiles || []).length, 0)
  };
  
  console.log('\n✅ Eksport završen!');
  console.log('\n📊 Statistika:');
  console.log(`   - Korisnici: ${stats.users}`);
  console.log(`   - Uređaji: ${stats.devices}`);
  console.log(`   - Login approvals: ${stats.loginApprovals}`);
  console.log(`   - Obračuni: ${stats.totalObracuni}`);
  console.log(`   - Sesije: ${stats.totalSessions}`);
  console.log(`   - Cjenovnik stavke: ${stats.totalCjenovnik}`);
  console.log(`   - Storage fajlovi: ${stats.totalStorageFiles}`);
  console.log(`\n💾 Eksportovan fajl: ${EXPORT_FILE}`);
  console.log(`\n📝 Sledeći korak: Pokreni scripts/import-to-postgresql.js`);
}

// Pokreni eksport
exportAllData()
  .then(() => {
    console.log('\n🎉 Gotovo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Greška pri eksportu:', error);
    process.exit(1);
  });






