export const API_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' && window.location.port === '5173') {
      return 'http://localhost:5000';
    }
    // Direct live Render backend
    return 'https://student-information-management-system-7zv9.onrender.com';
  }
  return 'http://localhost:5000';
})();

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error(
      `Unable to reach the backend API at ${API_URL}. The Render server may be waking up from sleep (takes 30-45s) or restarting. Please click Retry.`
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return payload;
}

export async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    // Render API returns 200 on /api/students or /
    const res = await fetch(`${API_URL}/api/students`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) return { online: true };
    
    // Fallback check root /
    const rootRes = await fetch(`${API_URL}/`, { signal: controller.signal });
    return { online: rootRes.ok };
  } catch (err) {
    return { online: false, message: err.message };
  }
}
