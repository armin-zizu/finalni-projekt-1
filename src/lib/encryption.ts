import CryptoJS from 'crypto-js';

// Ključ za enkripciju - u produkciji bi trebao biti u environment varijablama
// Za sada koristimo fiksni ključ, ali u produkciji bi trebao biti generisan per-user
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

/**
 * Enkriptuje podatke koristeći AES enkripciju
 */
export function encrypt(data: string): string {
  try {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Greška pri enkripciji:', error);
    throw error;
  }
}

/**
 * Dekriptuje podatke koristeći AES enkripciju
 */
export function decrypt(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error('Dekripcija nije uspjela - možda je podatak oštećen ili ključ nije ispravan');
    }
    return decrypted;
  } catch (error) {
    console.error('Greška pri dekripciji:', error);
    throw error;
  }
}

