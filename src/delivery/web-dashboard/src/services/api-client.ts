const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('singularity_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('singularity_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('singularity_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>)
  };

  // Only set Content-Type: application/json if there is an actual body payload and it's not FormData
  if (options.body !== undefined && options.body !== null) {
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errMsg = `Error de API (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data.message && typeof data.message === 'string') {
        errMsg = data.message;
      } else if (data.error && typeof data.error === 'string') {
        errMsg = data.error;
      }
    } catch {
      // ignore
    }
    if (res.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent('singularity-auth-expired'));
    }
    throw new ApiError(res.status, errMsg);
  }

  if (res.status === 204) {
    return {} as T;
  }
  const text = await res.text();
  if (!text || text.trim() === '') {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    let errMsg = `Error al descargar archivo (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errMsg = data.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errMsg);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: 'POST',
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined
    }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: 'PUT',
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined
    }),
  upload: <T>(url: string, formData: FormData) =>
    request<T>(url, {
      method: 'POST',
      body: formData
    }),
  download: (url: string, filename: string) => downloadFile(url, filename),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' })
};
