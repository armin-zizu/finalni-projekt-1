/**
 * Dohvati sve narudžbe za korisnika
 */
export async function getOrders(userId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/orders`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch orders'));
  }

  const data = await response.json();
  return data.orders || [];
}
// Helper funkcije za API pozive

let hasLoggedMissingToken = false;

function notifySubscriptionUpdated(userId?: string) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('subscription-updated', {
      detail: { userId: userId || null, at: Date.now() },
    })
  );
}

async function readApiError(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const primary = (json?.error && json.error !== 'Internal server error') ? json.error : null;
      return primary || json?.message || json?.detail || json?.hint || `${fallbackMessage} (HTTP ${response.status})`;
    }

    const text = await response.text();
    if (text && text.trim().length > 0) {
      return `${fallbackMessage} (HTTP ${response.status}): ${text.slice(0, 180)}`;
    }
  } catch {
    // ignore parsing issues and fallback below
  }

  return `${fallbackMessage} (HTTP ${response.status})`;
}

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
  
  // Debug logging (only once per page load in development)
  if (process.env.NODE_ENV !== 'production' && !hasLoggedMissingToken) {
    hasLoggedMissingToken = true;
    console.warn('getAuthToken: No token found in localStorage or cookies');
    console.log('localStorage token:', localStorage.getItem('token'));
    console.log('Cookies:', document.cookie);
  }
  
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
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        removeAuthToken();
        return null;
      }
      // Tiha greška za 404 - korisnik možda još nije potpuno prijavljen ili endpoint nije dostupan
      if (response.status === 404) {
        return null;
      }
      // Loguj samo ako nije 401 ili 404
      console.error('Error fetching current user:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    // Tiha greška - ne loguj u konzolu jer AppNameContext već ima fallback
    // console.error('Error fetching current user:', error);
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
    // HeadersInit can be Headers | string[][] | Record<string,string>
    // Normalize to a Headers instance when possible, otherwise assign safely.
    if (headers instanceof Headers) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
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
    throw new Error(await readApiError(response, 'Failed to fetch devices'));
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

  const isRetryableDeviceError = (error: any) => {
    const message = (error?.message || '').toLowerCase();
    return (
      message.includes('lock timeout') ||
      message.includes('canceling statement due to lock timeout') ||
      message.includes('temporarily busy') ||
      message.includes('status 409')
    );
  };

  const sendSaveRequest = async () => {
    const response = await fetch(`/api/users/${userId}/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(deviceData),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Device is temporarily busy, please try again.');
      }
      throw new Error(await readApiError(response, 'Failed to save device'));
    }

    const data = await response.json();
    return data.device;
  };

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendSaveRequest();
    } catch (error: any) {
      if (!isRetryableDeviceError(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = 250 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error('Failed to save device');
}

/**
 * Update device (role, status, isBlocked, deviceName)
 */
export async function updateDevice(
  userId: string,
  deviceId: string,
  deviceData: {
    deviceName?: string;
    role?: string | null;
    permissions?: any;
    isBlocked?: boolean;
    status?: string;
  }
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const sendUpdateRequest = async () => {
    const response = await fetch(`/api/users/${userId}/devices/${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(deviceData),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Device is temporarily busy, please try again.');
      }
      throw new Error(await readApiError(response, 'Failed to update device'));
    }

    const data = await response.json();
    return data.device;
  };

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendUpdateRequest();
    } catch (error: any) {
      const message = (error?.message || '').toLowerCase();
      const isRetryable = message.includes('lock timeout') || message.includes('canceling statement due to lock timeout') || message.includes('temporarily busy');

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = 300 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error('Failed to update device');
}

/**
 * Delete device
 */
export async function deleteDevice(userId: string, deviceId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  console.log('deleteDevice API poziv:', { userId, deviceId, url: `/api/users/${userId}/devices/${deviceId}` });

  const response = await fetch(`/api/users/${userId}/devices/${deviceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('deleteDevice API greška:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      userId,
      deviceId
    });
    throw new Error(errorData.error || errorData.message || 'Failed to delete device');
  }

  const result = await response.json().catch(() => ({ success: true }));
  console.log('deleteDevice API uspjeh:', result);
  return result;
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
    isDraft?: boolean; // Optional: true za draft, false ili undefined za finalni obračun
  }
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const sendSaveRequest = async () => {
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
      const message =
        error?.error && error.error !== 'Database error' && error.error !== 'Internal server error'
          ? error.error
          : (error?.message || error?.detail || error?.hint || `Failed to save obracun (HTTP ${response.status})`);
      throw new Error(message);
    }

    const data = await response.json();
    return data.obracun;
  };

  const isRetryable = (error: any) => {
    const message = (error?.message || '').toLowerCase();
    return (
      message.includes('lock timeout') ||
      message.includes('temporarily busy') ||
      message.includes('trenutno zauzeti') ||
      message.includes('http 409')
    );
  };

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendSaveRequest();
    } catch (error: any) {
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = 250 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error('Failed to save obracun');
}

/**
 * Get all obracuni for user
 */
export async function getObracuni(userId: string, datum?: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  // Note: userId in URL is now ignored by API - API uses JWT token userId instead
  // But we still pass it for consistency and logging
  let url = `/api/users/${userId}/obracuni`;
  if (datum) {
    url += `?datum=${encodeURIComponent(datum)}`;
  }

  console.log('getObracuni - userId from param:', userId, 'URL:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorMessage = await readApiError(response, 'Failed to fetch obracuni');
    console.error('getObracuni error:', {
      status: response.status,
      statusText: response.statusText,
      errorMessage,
      userId,
      url,
    });
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Transformiraj podatke iz API-ja u format koji dashboard/profit očekuje
  // API sada vraća flattened strukturu (artikli, rashodi, prihodi direktno), ali zadržavamo kompatibilnost sa starim nested formatom
  const transformedObracuni = (data.obracuni || []).map((ob: any) => {
    // Provjeri da li je flattened struktura (artikli je array) ili nested struktura (artikli je objekat sa artikliData.artikli)
    let artikliData: any;
    let artikli: any[];
    let rashodi: any[];
    let prihodi: any[];
    let ukupnoArtikli: number;
    let ukupnoRashod: number;
    let ukupnoPrihod: number;
    let neto: number;
    let isAzuriran: boolean;
    let imaUlaz: boolean;
    let invoiceImages: string[];
    
    if (Array.isArray(ob.artikli)) {
      // Flattened struktura (novi format) - API vraća artikli, rashodi, prihodi direktno
      artikli = ob.artikli;
      rashodi = Array.isArray(ob.rashodi) ? ob.rashodi : [];
      prihodi = Array.isArray(ob.prihodi) ? ob.prihodi : [];
      ukupnoArtikli = Number(ob.ukupnoArtikli) || 0;
      ukupnoRashod = Number(ob.ukupnoRashod) || 0;
      ukupnoPrihod = Number(ob.ukupnoPrihod) || 0;
      neto = Number(ob.neto) || 0;
      isAzuriran = ob.isAzuriran === true || ob.isAzuriran === 'true';
      imaUlaz = ob.imaUlaz === true || ob.imaUlaz === 'true';
      invoiceImages = Array.isArray(ob.invoiceImages) ? ob.invoiceImages : [];
    } else {
      // Nested struktura (stari format) - artikli je JSONB objekat
      artikliData = ob.artikli;
      if (typeof artikliData === 'string') {
        try {
          artikliData = JSON.parse(artikliData);
        } catch (e) {
          console.warn('Failed to parse artikli JSON:', e);
          artikliData = {};
        }
      }
      
      artikli = Array.isArray(artikliData?.artikli) ? artikliData.artikli : [];
      rashodi = Array.isArray(artikliData?.rashodi) ? artikliData.rashodi : [];
      prihodi = Array.isArray(artikliData?.prihodi) ? artikliData.prihodi : [];
      ukupnoArtikli = Number(artikliData?.ukupnoArtikli) || 0;
      ukupnoRashod = Number(artikliData?.ukupnoRashod) || 0;
      ukupnoPrihod = Number(artikliData?.ukupnoPrihod) || 0;
      neto = Number(artikliData?.neto) || 0;
      isAzuriran = artikliData?.isAzuriran === true || artikliData?.isAzuriran === 'true';
      imaUlaz = artikliData?.imaUlaz === true || artikliData?.imaUlaz === 'true';
      invoiceImages = Array.isArray(artikliData?.invoiceImages) ? artikliData.invoiceImages : [];
    }
    
    // Formatiraj datum - API sada vraća već formatiran datum (DD.MM.YYYY.), ali zadržavamo kompatibilnost
    let formattedDatum = ob.datum || '';
    
    // Ako je Date objekat, konvertuj u string
    if (formattedDatum instanceof Date) {
      const dan = String(formattedDatum.getDate()).padStart(2, '0');
      const mjesec = String(formattedDatum.getMonth() + 1).padStart(2, '0');
      const godina = formattedDatum.getFullYear();
      formattedDatum = `${dan}.${mjesec}.${godina}.`;
    } else if (typeof formattedDatum === 'string') {
      // Ako je ISO string format (2025-12-16T05:00:00.000Z), parsiraj ga
      if (formattedDatum.includes('T') && formattedDatum.includes('Z')) {
        const dateObj = new Date(formattedDatum);
        if (!isNaN(dateObj.getTime())) {
          const dan = String(dateObj.getDate()).padStart(2, '0');
          const mjesec = String(dateObj.getMonth() + 1).padStart(2, '0');
          const godina = dateObj.getFullYear();
          formattedDatum = `${dan}.${mjesec}.${godina}.`;
        }
      } else if (formattedDatum.includes('-') && formattedDatum.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Ako je string u YYYY-MM-DD formatu, konvertuj u DD.MM.YYYY.
        const parts = formattedDatum.split('-');
        if (parts.length >= 3) {
          const [godina, mjesec, dan] = parts;
          formattedDatum = `${dan}.${mjesec}.${godina}.`;
        }
      } else if (formattedDatum && !formattedDatum.endsWith('.')) {
        // Ako već ima format DD.MM.YYYY ali nema tačku na kraju, dodaj je
        formattedDatum = formattedDatum + '.';
      }
      // Ako već ima format DD.MM.YYYY., ostavi kako jeste
    }
    
    return {
      id: ob.id,
      datum: formattedDatum,
      createdAt: (ob as any).saved_at || (ob as any).createdAt || (ob as any).updatedAt, // Dodaj saved_at timestamp za prikaz satnice
      artikli: artikli,
      rashodi: rashodi,
      prihodi: prihodi,
      ukupnoArtikli: ukupnoArtikli,
      ukupnoRashod: ukupnoRashod,
      ukupnoPrihod: ukupnoPrihod,
      neto: neto,
      isAzuriran: isAzuriran,
      imaUlaz: imaUlaz,
      invoiceImages: invoiceImages,
      isDraft: ob.isDraft || false, // Dodaj isDraft flag
    };
  });
  
  return transformedObracuni;
}

/**
 * Get draft obracun for specific datum
 * Vraća draft obračun za određeni datum ili null ako ne postoji
 */
export async function getDraftObracun(userId: string, datum: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const url = `/api/users/${userId}/obracuni?datum=${encodeURIComponent(datum)}&is_draft=true`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Ako nema draft-a ili je problem sa userId format-om, to nije greška - vrati null
      if (response.status === 404 || response.status === 400) {
        // Draft ne postoji ili userId format nije validan - vrati null bez greške
        return null;
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.message || 'Failed to fetch draft obracun');
    }

    const data = await response.json();
    const draftObracuni = data.obracuni || [];
    
    if (draftObracuni.length === 0) {
      return null;
    }

    // Transformiraj draft obračun (isti format kao getObracuni)
    const draft = draftObracuni[0];
    let artikliData = draft.artikli;
    if (typeof artikliData === 'string') {
      try {
        artikliData = JSON.parse(artikliData);
      } catch (e) {
        console.warn('Failed to parse draft artikli JSON:', e);
        artikliData = {};
      }
    }

    return {
      id: draft.id,
      datum: draft.datum,
      artikli: Array.isArray(artikliData?.artikli) ? artikliData.artikli : [],
      rashodi: Array.isArray(artikliData?.rashodi) ? artikliData.rashodi : [],
      prihodi: Array.isArray(artikliData?.prihodi) ? artikliData.prihodi : [],
      ukupnoArtikli: Number(artikliData?.ukupnoArtikli) || 0,
      ukupnoRashod: Number(artikliData?.ukupnoRashod) || 0,
      ukupnoPrihod: Number(artikliData?.ukupnoPrihod) || 0,
      neto: Number(artikliData?.neto) || 0,
      isAzuriran: artikliData?.isAzuriran === true || artikliData?.isAzuriran === 'true',
      imaUlaz: artikliData?.imaUlaz === true || artikliData?.imaUlaz === 'true',
      invoiceImages: Array.isArray(artikliData?.invoiceImages) ? artikliData.invoiceImages : [],
      isDraft: true,
      updatedAt: draft.updatedAt,
    };
  } catch (error: any) {
    // Ako je greška, logiraj i vrati null (draft možda ne postoji)
    console.warn('getDraftObracun error:', error);
    return null;
  }
}

/**
 * Delete obracun
 */
export async function deleteObracun(userId: string, datum: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const url = `/api/users/${userId}/obracuni?datum=${encodeURIComponent(datum)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete obracun');
  }

  return true;
}

/**
 * Delete file by URL
 */
export async function deleteFile(fileUrl: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const url = `/api/files?url=${encodeURIComponent(fileUrl)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete file');
  }

  return true;
}

/**
 * Update current user (app name, etc.)
 */
export async function updateCurrentUser(updates: { appName?: string }) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const sendUpdateRequest = async () => {
    const response = await fetch('/api/users/me', {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const primaryMessage =
        error?.error && error.error !== 'Internal server error'
          ? error.error
          : (error?.message || error?.detail || error?.hint || `Failed to update user (HTTP ${response.status})`);
      throw new Error(primaryMessage);
    }

    return response.json();
  };

  // Server already retries lock-timeout cases for /api/users/me.
  // Avoid client-side retry loop which can multiply total wait time.
  return await sendUpdateRequest();
}

/**
 * Logout user
 */
/**
 * Get cjenovnik for user
 */
export async function getCjenovnik(userId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/cjenovnik`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to get cjenovnik'));
  }

  const data = await response.json();
  return data.cjenovnik || [];
}

/**
 * Save cjenovnik for user
 */
export async function saveCjenovnik(userId: string, cjenovnik: any[]) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/cjenovnik`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ cjenovnik }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to save cjenovnik'));
  }

  const data = await response.json();
  return data;
}

export async function deleteCjenovnikArtikal(userId: string, naziv: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/cjenovnik`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ naziv }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete artikal');
  }

  const data = await response.json();
  return data;
}

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

/**
 * Get subscription for user
 */
export async function getSubscription(userId?: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const endpoint = userId ? `/api/users/${userId}/subscription` : '/api/users/me/subscription';

  const response = await fetch(endpoint, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorMessage = await readApiError(response, 'Failed to get subscription');
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.subscription;
}

/**
 * Update subscription
 */
export async function updateSubscription(
  userId: string,
  subscriptionData: {
    monthlyPrice?: number;
    trialEndDate?: Date | null;
    graceEndDate?: Date | null;
    lastPaymentDate?: Date | null;
    isActive?: boolean;
    endDate?: Date | null;
    status?: string;
  }
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/subscription`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(subscriptionData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to update subscription');
  }

  const data = await response.json();
  notifySubscriptionUpdated(userId);
  return data.subscription;
}

/**
 * Add payment to subscription
 */
export async function addPaymentToSubscription(
  userId: string,
  amount: number,
  months: number = 1,
  note?: string
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/users/${userId}/subscription/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, months, note }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to add payment');
  }

  const data = await response.json();
  notifySubscriptionUpdated(userId);
  return data.payment;
}

/**
 * Admin: Adjust premium days (add or subtract days from subscription end date)
 */
export async function adminAdjustPremiumDays(userId: string, days: number) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}/subscription/adjust-days`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ days, type: 'premium' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to adjust premium days');
  }

  const data = await response.json();
  notifySubscriptionUpdated(userId);
  return data.subscription;
}

/**
 * Admin: Adjust trial days (add or subtract days from trial end date)
 */
export async function adminAdjustTrialDays(userId: string, days: number) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}/subscription/adjust-days`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ days, type: 'trial' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to adjust trial days');
  }

  const data = await response.json();
  notifySubscriptionUpdated(userId);
  return data.subscription;
}

/**
 * Admin: Change subscription status
 */
export async function adminChangeSubscriptionStatus(
  userId: string,
  status: "trial" | "premium" | "grace" | "inactive"
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}/subscription/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to change subscription status');
  }

  const data = await response.json();
  notifySubscriptionUpdated(userId);
  return data.subscription;
}

/**
 * Admin: Toggle subscription active status
 */
export async function adminToggleSubscription(userId: string, isActive: boolean) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}/subscription/toggle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to toggle subscription');
  }

  const data = await response.json();
  notifySubscriptionUpdated(userId);
  return data.subscription;
}

/**
 * Admin: Add payment for user
 */
export async function adminAddPayment(
  userId: string,
  amount: number,
  months: number = 1,
  note?: string
) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}/subscription/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, months, note }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to add payment');
  }

  const data = await response.json();
  return data.payment;
}

/**
 * Admin: Set user as owner
 */
export async function adminSetUserAsOwner(userId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}/set-owner`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to set user as owner');
  }

  const data = await response.json();
  return data.user;
}

/**
 * Admin: Delete user
 */
export async function adminDeleteUser(userId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const message =
      error?.error && error.error !== 'Internal server error'
        ? error.error
        : (error?.message || error?.detail || error?.hint || 'Failed to delete user');
    throw new Error(message);
  }

  return true;
}

// ========== SUPPORT CHAT API ==========

export interface SupportMessage {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  isAdminResponse: boolean;
  conversationId: string;
}

export interface Conversation {
  conversationId: string;
  userId: string;
  userEmail: string;
  appName: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage: {
    message: string;
    createdAt: string;
    isAdminResponse: boolean;
  } | null;
}

/**
 * Dohvati poruke za trenutnog korisnika
 */
export async function getSupportMessages(): Promise<SupportMessage[]> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('/api/support/messages', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch messages' }));
    throw new Error(error.error || 'Failed to fetch messages');
  }

  const data = await response.json();
  return data.messages || [];
}

/**
 * Pošalji poruku za podršku
 */
export async function sendSupportMessage(
  message: string,
  conversationId?: string
): Promise<SupportMessage> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('/api/support/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversationId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to send message' }));
    throw new Error(error.error || 'Failed to send message');
  }

  const data = await response.json();
  return data.message;
}

/**
 * Dohvati konverzacije (admin)
 */
export async function getConversations(): Promise<Conversation[]> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('/api/support/conversations', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch conversations' }));
    throw new Error(error.error || 'Failed to fetch conversations');
  }

  const data = await response.json();
  return data.conversations || [];
}

/**
 * Dohvati poruke za konverzaciju (admin)
 */
export async function getConversationMessages(conversationId: string): Promise<SupportMessage[]> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/support/conversations/${conversationId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch messages' }));
    throw new Error(error.error || 'Failed to fetch messages');
  }

  const data = await response.json();
  return data.messages || [];
}

/**
 * Admin odgovor na konverzaciju
 */
export async function replyToConversation(
  conversationId: string,
  message: string
): Promise<SupportMessage> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/support/conversations/${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to send reply' }));
    throw new Error(error.error || 'Failed to send reply');
  }

  const data = await response.json();
  return data.message;
}

/**
 * Dohvati broj nepročitanih poruka
 */
export async function getUnreadCount(): Promise<number> {
  const token = getAuthToken();
  if (!token) return 0;

  try {
    const response = await fetch('/api/support/unread-count', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.unreadCount || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

