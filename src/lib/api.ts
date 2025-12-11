// Helper funkcije za API pozive

/**
 * Dohvata token iz localStorage ili cookies
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Prvo pokušaj localStorage (jer je dostupniji za JavaScript)
  let token = localStorage.getItem('token');
  if (token) {
    return token;
  }
  
  // Fallback na cookies (ako nije httpOnly)
  try {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
    if (tokenCookie) {
      token = tokenCookie.split('=')[1];
      // Ako token postoji u cookie-ju, spremi ga u localStorage za sljedeći put
      if (token) {
        localStorage.setItem('token', token);
      }
      return token;
    }
  } catch (error) {
    // Ignoriraj greške pri čitanju cookies
    console.warn('Error reading cookies:', error);
  }
  
  // Debug logging
  console.warn('getAuthToken: No token found in localStorage or cookies');
  console.log('localStorage token:', localStorage.getItem('token'));
  console.log('Cookies:', document.cookie);
  
  return null;
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

/**
 * Upload file
 */
export async function uploadFile(file: File, fileType: string = 'document', obracunDatum?: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileType', fileType);
  if (obracunDatum) {
    formData.append('obracunDatum', obracunDatum);
  }

  const response = await fetch('/api/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to upload file');
  }

  const data = await response.json();
  return data.file;
}

/**
 * Save obracun
 */
export async function saveObracun(
  userId: string,
  obracunData: {
    datum: string;
    artikli: any[];
    rashodi: any[];
    prihodi: any[];
    ukupnoArtikli: number;
    ukupnoRashod: number;
    ukupnoPrihod: number;
    neto: number;
    isAzuriran?: boolean;
    imaUlaz?: boolean;
    invoiceImages?: string[];
  }
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/obracuni`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(obracunData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save obracun');
  }

  const data = await response.json();
  return data.obracun;
}

/**
 * Get all obracuni for user
 */
export async function getObracuni(userId: string, datum?: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  let url = `/api/users/${userId}/obracuni`;
  if (datum) {
    url += `?datum=${encodeURIComponent(datum)}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch obracuni');
  }

  const data = await response.json();
  return data.obracuni || [];
}

/**
 * Update current user (app name, etc.)
 */
export async function updateCurrentUser(updates: { appName?: string }) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('/api/users/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to update user');
  }

  const data = await response.json();
  return data;
}

/**
 * Logout user
 */
export async function logout() {
  const token = getAuthToken();
  
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: token ? {
        'Authorization': `Bearer ${token}`,
      } : {},
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to logout');
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with local cleanup even if API call fails
  } finally {
    // Always remove token locally
    removeAuthToken();
  }
}

