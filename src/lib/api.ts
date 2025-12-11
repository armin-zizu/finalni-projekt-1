// Helper funkcije za API pozive

/**
 * Dohvata token iz cookies ili localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Prvo pokušaj cookies
  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
  if (tokenCookie) {
    return tokenCookie.split('=')[1];
  }
  
  // Fallback na localStorage
  return localStorage.getItem('token');
}

/**
 * Sačuva token u localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

/**
 * Ukloni token
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  // Ukloni cookie također
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

/**
 * Dohvata trenutnog korisnika preko API-ja
 */
export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        removeAuthToken();
        return null;
      }
      throw new Error('Failed to fetch user');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Autentificirani API poziv helper
 */
export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Dohvati userId iz tokena ili API poziva
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || user?.userId || null;
}

/**
 * Dohvati sve uređaje za korisnika
 */
export async function getUserDevices(userId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/devices`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch devices');
  }

  const data = await response.json();
  return data.devices || [];
}

/**
 * Dohvati uređaj po deviceId
 */
export async function getDeviceByDeviceId(userId: string, deviceId: string) {
  const devices = await getUserDevices(userId);
  return devices.find((d: any) => d.deviceId === deviceId) || null;
}

/**
 * Kreiraj ili ažuriraj uređaj
 */
export async function saveDevice(
  userId: string,
  deviceData: {
    deviceId: string;
    deviceName?: string;
    deviceInfo?: any;
    role?: string | null;
    permissions?: any;
    isBlocked?: boolean;
    status?: string;
  }
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(deviceData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save device');
  }

  const data = await response.json();
  return data.device;
}

