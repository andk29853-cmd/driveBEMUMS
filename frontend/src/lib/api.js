const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'drive_token';

let token = localStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
}

export function setToken(value) {
  token = value;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}/api${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 0);
  }

  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    setToken(null);
    window.dispatchEvent(new Event('drive:unauthorized'));
  }
  if (!res.ok) {
    throw new ApiError(data?.message || `Terjadi kesalahan (${res.status}).`, res.status, data);
  }
  return data;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  patch: (path, body = {}) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

/** Resolve URL relatif dari backend (Local Disk) terhadap BASE API. */
export function resolveUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE}${url}`;
}
