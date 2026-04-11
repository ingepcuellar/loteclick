/**
 * White-Label - API Client
 * Handles all HTTP requests to PHP backend with JWT auth.
 */
import { brand } from '../config/brandConfig';

const API_BASE = import.meta.env.VITE_API_URL || './api';

/**
 * Get stored JWT token
 */
function getToken() {
    return localStorage.getItem(brand.tokenKey);
}

/**
 * Set JWT token
 */
export function setToken(token) {
    if (token) {
        localStorage.setItem(brand.tokenKey, token);
    } else {
        localStorage.removeItem(brand.tokenKey);
    }
}

/**
 * Check if user is authenticated (has a token)
 */
export function isAuthenticated() {
    return !!getToken();
}

/**
 * Make an API request
 * Returns { data, error } format compatible with existing Supabase service pattern
 */
export async function request(endpoint, options = {}) {
    try {
        const token = getToken();
        const headers = {
            ...options.headers,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Don't set Content-Type for FormData (browser sets it with boundary)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_BASE}/${endpoint}`, {
            ...options,
            headers,
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || `Error ${response.status}` };
        }

        return { data: result.data, error: null };
    } catch (err) {
        console.error(`[API] Error in ${endpoint}:`, err);
        return { data: null, error: err.message || 'Error de conexión' };
    }
}

/**
 * Shorthand methods
 */
export const api = {
    get: (endpoint) => request(endpoint, { method: 'GET' }),

    post: (endpoint, data) => request(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    put: (endpoint, data) => request(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    patch: (endpoint, data) => request(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

    upload: (endpoint, formData) => request(endpoint, {
        method: 'POST',
        body: formData,
    }),
};
