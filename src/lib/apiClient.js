/**
 * White-Label - API Client con soporte Offline
 * Handles all HTTP requests to PHP backend with JWT auth.
 * Cuando no hay internet, encola las mutaciones y lee de IndexedDB.
 */
import { brand } from '../config/brandConfig';
import { saveAll, getAll, saveOne, clearStore } from './offlineDB';
import { addToQueue, getPendingCount } from './syncQueue';

const API_BASE = import.meta.env.VITE_API_URL || './api';

// Mapeo de endpoints a stores de IndexedDB
const ENDPOINT_STORE_MAP = {
    'endpoints/projects.php': 'projects',
    'endpoints/clients.php': 'clients',
    'endpoints/sales.php': 'sales',
    'endpoints/payments.php': 'payments',
    'endpoints/expenses.php': 'expenses',
    'endpoints/installments.php': 'installments',
    'endpoints/desistimientos.php': 'desistimientos',
    'endpoints/utilities.php': 'utilityRegistrations',
    'endpoints/lots.php': 'lots',
    'endpoints/partners.php': 'partners',
    'endpoints/bank_accounts.php': 'bankAccounts',
    'endpoints/commission_agents.php': 'commissionAgents',
    'endpoints/stages.php': 'stages',
    'endpoints/blocks.php': 'blocks',
};

/**
 * Obtener el store name de un endpoint
 */
function getStoreName(endpoint) {
    // Limpiar query params
    const cleanEndpoint = endpoint.split('?')[0];
    return ENDPOINT_STORE_MAP[cleanEndpoint] || null;
}

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
 * Make an API request — con fallback offline
 * Returns { data, error } format compatible with existing Supabase service pattern
 */
export async function request(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const isRead = method === 'GET';
    const isOnline = navigator.onLine;

    // Si estamos offline y es una escritura (POST, PUT, DELETE), encolar
    if (!isOnline && !isRead) {
        return handleOfflineWrite(endpoint, method, options);
    }

    // Si estamos offline y es una lectura, leer de IndexedDB
    if (!isOnline && isRead) {
        return handleOfflineRead(endpoint);
    }

    // Estamos online: hacer la petición normal
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

        // 1. Obtener respuesta como texto para evitar fallos de parseo
        const responseText = await response.text();

        // 2. Si es un 409 o el contenido parece HTML (inicia con < o contiene <script), redirigir
        // Evitamos redirecciones si estamos dentro de la app móvil (Capacitor) para no romper el WebView local
        const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
        if ((response.status === 409 || responseText.trim().startsWith('<') || responseText.includes('<script')) && !isCapacitor) {
            console.warn('[API] Desafío de seguridad o bloqueo detectado. Redirigiendo a verificar...');
            // Redirigir a test.php y traer de vuelta al usuario a la URL actual
            window.location.href = `${API_BASE}/test.php?redirect=${encodeURIComponent(window.location.href)}`;
            return new Promise(() => {}); // Detener flujo React colgando la promesa
        }

        // 3. Parsear JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseErr) {
            console.error('[API] Error parseando JSON:', parseErr, responseText);
            return { data: null, error: 'Respuesta inválida del servidor (No es JSON)' };
        }

        if (!response.ok) {
            return { data: null, error: result.error || `Error ${response.status}` };
        }

        // Si fue un GET exitoso, guardar en IndexedDB para uso offline
        if (isRead && result.data) {
            cacheResponse(endpoint, result.data);
        }

        return { data: result.data, error: null };
    } catch (err) {
        console.error(`[API] Error in ${endpoint}:`, err);

        // Si falla por red, intentar leer de caché
        if (isRead) {
            console.log('[API] Intentando leer desde caché offline...');
            return handleOfflineRead(endpoint);
        }

        // Si falla una escritura por red, encolar
        if (!isRead) {
            console.log('[API] Encolando mutación para sincronización posterior...');
            return handleOfflineWrite(endpoint, method, options);
        }

        return { data: null, error: err.message || 'Error de conexión' };
    }
}

/**
 * Guardar respuesta GET en IndexedDB para uso offline
 */
async function cacheResponse(endpoint, data) {
    try {
        const storeName = getStoreName(endpoint);
        if (!storeName) return; // No cacheable

        if (Array.isArray(data)) {
            await saveAll(storeName, data);
        } else if (data && data.id) {
            await saveOne(storeName, data);
        }
    } catch (err) {
        console.warn('[Offline Cache] Error guardando en caché:', err);
    }
}

/**
 * Leer datos desde IndexedDB cuando estamos offline
 */
async function handleOfflineRead(endpoint) {
    try {
        const storeName = getStoreName(endpoint);
        if (!storeName) {
            return { data: null, error: 'Datos no disponibles offline' };
        }

        // Verificar si el endpoint tiene un ID específico (ej: ?id=xxx)
        const url = new URL(endpoint, 'http://dummy');
        const id = url.searchParams.get('id');

        if (id) {
            const items = await getAll(storeName);
            const item = items.find(i => i.id === id);
            return { data: item || null, error: item ? null : 'No encontrado en caché offline' };
        }

        const data = await getAll(storeName);
        return { data: data || [], error: null };
    } catch (err) {
        console.error('[Offline Read] Error:', err);
        return { data: null, error: 'Error leyendo datos offline' };
    }
}

/**
 * Encolar una escritura cuando estamos offline
 */
async function handleOfflineWrite(endpoint, method, options) {
    try {
        // Parsear el body
        let bodyData = null;
        if (options.body && typeof options.body === 'string') {
            bodyData = JSON.parse(options.body);
        } else if (options.body instanceof FormData) {
            // Las subidas de archivos NO se pueden encolar
            return {
                data: null,
                error: '⚠️ No se pueden subir archivos sin conexión a internet. Por favor, intente cuando tenga conexión.'
            };
        }

        // Generar un ID temporal para items nuevos si es POST
        if (method === 'POST' && bodyData && !bodyData.id) {
            bodyData._tempId = crypto.randomUUID();
        }

        // Encolar la mutación
        await addToQueue({
            endpoint,
            method,
            data: bodyData,
        });

        // Guardar temporalmente en IndexedDB para que se refleje en la UI
        const storeName = getStoreName(endpoint);
        if (storeName && bodyData) {
            if (method === 'POST') {
                const tempItem = {
                    ...bodyData,
                    id: bodyData._tempId || bodyData.id || crypto.randomUUID(),
                    _offline: true,
                    _pendingSync: true,
                    created_at: new Date().toISOString(),
                };
                await saveOne(storeName, tempItem);
                return { data: tempItem, error: null };
            } else if (method === 'PUT' || method === 'PATCH') {
                if (bodyData.id) {
                    await saveOne(storeName, { ...bodyData, _offline: true, _pendingSync: true });
                }
                return { data: bodyData, error: null };
            }
        }

        const pendingCount = await getPendingCount();
        return {
            data: bodyData,
            error: null,
            _offlineQueued: true,
            _pendingCount: pendingCount,
        };
    } catch (err) {
        console.error('[Offline Write] Error encolando:', err);
        return { data: null, error: 'Error guardando datos offline' };
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

    upload: (endpoint, formData) => {
        // Bloquear subida de archivos si estamos offline
        if (!navigator.onLine) {
            return Promise.resolve({
                data: null,
                error: '⚠️ No se pueden subir archivos sin conexión a internet. Por favor, intente cuando tenga conexión.'
            });
        }
        return request(endpoint, {
            method: 'POST',
            body: formData,
        });
    },
};
