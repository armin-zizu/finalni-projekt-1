/**
 * Device identification utilities
 * Implements hybrid approach: UUID device_id + device fingerprinting
 */

/**
 * Generiše UUID za device_id
 */
export function generateDeviceId(): string {
  // Generiši UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Sakuplja device fingerprint informacije
 */
export function getDeviceFingerprint(): {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  fingerprintHash: string;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: '',
      screenResolution: '0x0',
      timezone: '',
      language: '',
      platform: '',
      cookieEnabled: false,
      fingerprintHash: '',
    };
  }

  const userAgent = navigator.userAgent || '';
  const screenResolution = `${screen.width}x${screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const language = navigator.language || '';
  const platform = navigator.platform || '';
  const cookieEnabled = navigator.cookieEnabled || false;

  // Generiši hash od fingerprint podataka
  const fingerprintString = `${userAgent}|${screenResolution}|${timezone}|${language}|${platform}|${cookieEnabled}`;
  const fingerprintHash = simpleHash(fingerprintString);

  return {
    userAgent,
    screenResolution,
    timezone,
    language,
    platform,
    cookieEnabled,
    fingerprintHash,
  };
}

/**
 * Jednostavna hash funkcija za fingerprint
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Čita device_id iz cookie-ja
 */
export function getDeviceIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  try {
    const cookies = document.cookie.split(';');
    const deviceIdCookie = cookies.find(c => c.trim().startsWith('device_id='));
    if (deviceIdCookie) {
      return deviceIdCookie.split('=')[1].trim();
    }
  } catch (error) {
    console.warn('Error reading device_id cookie:', error);
  }
  
  return null;
}

/**
 * Postavlja device_id u cookie (client-side, za backup)
 * Napomena: Server-side treba postaviti HttpOnly cookie za sigurnost
 */
export function setDeviceIdCookie(deviceId: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `device_id=${deviceId}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn('Error setting device_id cookie:', error);
  }
}

/**
 * Uklanja device_id cookie
 */
export function removeDeviceIdCookie(): void {
  if (typeof document === 'undefined') return;
  
  try {
    document.cookie = 'device_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (error) {
    console.warn('Error removing device_id cookie:', error);
  }
}

/**
 * Dobija ili generiše device_id
 * Koristi localStorage kao primarni izvor (HttpOnly cookie se ne može čitati iz JavaScript-a)
 * HttpOnly cookie se koristi za server-side provjere
 */
export function getOrCreateDeviceId(): string {
  // Provjeri localStorage (primarni izvor za client-side)
  if (typeof localStorage !== 'undefined') {
    const deviceId = localStorage.getItem('device_id');
    if (deviceId) {
      // Ako postoji u localStorage, spremi u non-HttpOnly cookie kao backup
      // (HttpOnly cookie se postavlja na serveru, ovdje postavljamo non-HttpOnly za backup)
      setDeviceIdCookie(deviceId);
      return deviceId;
    }
  }
  
  // Provjeri cookie kao fallback (samo ako nije HttpOnly)
  let deviceId = getDeviceIdFromCookie();
  if (deviceId) {
    // Ako postoji u cookie-ju, spremi u localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }
  
  // Generiši novi device_id
  deviceId = generateDeviceId();
  
  // Spremi u localStorage i non-HttpOnly cookie (server postavlja HttpOnly cookie)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('device_id', deviceId);
  }
  setDeviceIdCookie(deviceId);
  
  return deviceId;
}

