/**
 * offlineManager.js — Gestor central de conectividad y sincronización
 *
 * Responsabilidades:
 *  1. Monitorear el estado online/offline del navegador.
 *  2. Notificar a los suscriptores cuando cambia la conectividad.
 *  3. Al recuperar conexión, procesar la cola de mutaciones pendientes
 *     usando el mismo patrón de fetch + JWT de apiClient.js.
 *
 * @module offlineManager
 */
import { brand } from '../config/brandConfig';
import {
  getPendingQueue,
  updateStatus,
  removeFromQueue,
  getQueue,
} from './syncQueue';
import { getDB, SYNC_QUEUE_STORE } from './offlineDB';

// ─────────────────────────────────────────────
// Configuración del API (réplica de apiClient)
// ─────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || './api';

/** Endpoints válidos actuales — mutaciones con endpoints desconocidos son obsoletas */
const KNOWN_ENDPOINT_PATTERNS = [
  'projects.php', 'clients.php', 'sales.php', 'payments.php',
  'expenses.php', 'installments.php', 'desistimientos.php',
  'utilities.php', 'lots.php', 'partners.php', 'bank_accounts.php',
  'commission_agents.php', 'stages.php', 'blocks.php', 'auth.php',
  'users.php', 'push-notification', 'barcode',
];

/** Máximo de reintentos para una mutación fallida antes de marcarla como conflicto */
const MAX_RETRIES = 3;

/** Mutaciones más viejas que 30 días se limpian automáticamente */
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Obtiene el token JWT almacenado en localStorage.
 *
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem(brand.tokenKey);
}

// ─────────────────────────────────────────────
// Estado y suscriptores
// ─────────────────────────────────────────────

/** @type {Set<(online: boolean) => void>} */
const listeners = new Set();

/** Indica si el proceso de sincronización está en curso */
let isSyncing = false;

/**
 * Devuelve `true` si el navegador reporta conectividad.
 *
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Registra un callback que se ejecuta cada vez que cambia
 * el estado de conectividad.
 *
 * @param {(online: boolean) => void} callback
 * @returns {() => void} — Función para des-suscribirse
 */
export function onStatusChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Notifica a todos los suscriptores del cambio de estado.
 *
 * @param {boolean} online
 */
function notifyListeners(online) {
  for (const cb of listeners) {
    try {
      cb(online);
    } catch (err) {
      console.error('[OfflineManager] Error en listener:', err);
    }
  }
}

// ─────────────────────────────────────────────
// Eventos del navegador
// ─────────────────────────────────────────────

/**
 * Handler para el evento 'online'.
 * Notifica a los suscriptores y dispara la sincronización.
 */
function handleOnline() {
  console.info('[OfflineManager] 🟢 Conexión restaurada.');
  notifyListeners(true);
  syncPendingMutations();
}

/**
 * Handler para el evento 'offline'.
 * Notifica a los suscriptores.
 */
function handleOffline() {
  console.info('[OfflineManager] 🔴 Sin conexión.');
  notifyListeners(false);
}

// ─────────────────────────────────────────────
// Inicialización y limpieza
// ─────────────────────────────────────────────

/** Indica si los listeners del navegador ya fueron registrados */
let initialized = false;

/**
 * Elimina mutaciones obsoletas del IndexedDB:
 *  - Más viejas que STALE_MS (30 días)
 *  - Con endpoints de versiones antiguas del API (e.g. objectives.php)
 */
async function cleanupStaleMutations() {
  try {
    const db = await getDB();
    const all = await db.getAll(SYNC_QUEUE_STORE);
    const now = Date.now();
    let removed = 0;
    for (const m of all) {
      const isOldEndpoint = !KNOWN_ENDPOINT_PATTERNS.some(p => (m.endpoint || '').includes(p));
      const isStale = (now - m.timestamp) > STALE_MS;
      if (isOldEndpoint || isStale) {
        await db.delete(SYNC_QUEUE_STORE, m.id);
        removed++;
      }
    }
    if (removed > 0) {
      console.info(`[OfflineManager] 🧹 ${removed} mutación(es) obsoleta(s) eliminadas.`);
    }
  } catch (err) {
    console.warn('[OfflineManager] Error en limpieza de mutaciones:', err);
  }
}

/**
 * Inicializa el manager registrando los event listeners de
 * conectividad en el objeto `window`. Se puede llamar varias
 * veces sin efectos secundarios.
 */
export function init() {
  if (initialized) return;

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  initialized = true;

  console.info(
    `[OfflineManager] Inicializado. Estado actual: ${isOnline() ? '🟢 Online' : '🔴 Offline'}`
  );

  // Limpiar mutaciones obsoletas antes de sincronizar
  cleanupStaleMutations().then(() => {
    // Si ya estamos online al iniciar, intentar sincronizar pendientes
    if (isOnline()) {
      syncPendingMutations();
    }
  });
}

/**
 * Elimina los event listeners. Útil para limpieza en tests o al
 * desmontar la app.
 */
export function destroy() {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  listeners.clear();
  initialized = false;
}

// ─────────────────────────────────────────────
// Sincronización de la cola de mutaciones
// ─────────────────────────────────────────────

/**
 * Ejecuta una petición fetch al API con el mismo patrón de apiClient.
 * Devuelve `{ data, error, status }` para que el caller pueda
 * distinguir errores de red de errores de negocio.
 *
 * @param {string} endpoint — Ruta relativa del endpoint
 * @param {string} method   — Método HTTP
 * @param {Object|null} data — Cuerpo de la petición
 * @returns {Promise<{ data: any, error: string|null, status: number|null }>}
 */
async function replayRequest(endpoint, method, data) {
  const token = getToken();
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['Content-Type'] = 'application/json';

  const options = { method, headers };

  // Solo incluir body en métodos que lo soportan
  if (data && method !== 'GET' && method !== 'DELETE') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, options);
  const result = await response.json();

  if (!response.ok) {
    return {
      data: null,
      error: result.error || `Error ${response.status}`,
      status: response.status,
    };
  }

  return { data: result.data, error: null, status: response.status };
}

/**
 * Determina si un error HTTP indica un conflicto de negocio
 * que no se va a resolver con reintentos (e.g. lote ya vendido).
 *
 * @param {number|null} status — Código HTTP de la respuesta
 * @param {string|null} error  — Mensaje de error del backend
 * @returns {boolean}
 */
function isConflictError(status, error) {
  // HTTP 409 Conflict
  if (status === 409) return true;

  // Detectar mensajes comunes de conflicto del backend
  if (error && typeof error === 'string') {
    const conflictPatterns = [
      'ya vendido',
      'ya fue vendido',
      'already sold',
      'lote no disponible',
      'no está disponible',
      'ya existe',
      'duplicate',
    ];
    const lowerError = error.toLowerCase();
    return conflictPatterns.some((pattern) => lowerError.includes(pattern));
  }

  return false;
}

/**
 * Procesa la cola de mutaciones pendientes de forma secuencial (FIFO).
 *
 * Cada mutación se intenta enviar al API real. Si falla por un error
 * de red, se marca como 'failed' para reintento futuro. Si falla por
 * un conflicto de negocio (e.g. lote ya vendido, HTTP 409), se marca
 * como 'conflict' y no se reintenta.
 *
 * @returns {Promise<{ processed: number, failed: number, conflicts: number }>}
 */
export async function syncPendingMutations() {
  // Evitar ejecuciones concurrentes
  if (isSyncing) {
    console.info('[OfflineManager] Sincronización ya en curso, omitiendo.');
    return { processed: 0, failed: 0, conflicts: 0 };
  }

  if (!isOnline()) {
    console.info('[OfflineManager] Sin conexión, sincronización pospuesta.');
    return { processed: 0, failed: 0, conflicts: 0 };
  }

  isSyncing = true;
  const results = { processed: 0, failed: 0, conflicts: 0 };

  try {
    const queue = await getPendingQueue();

    if (queue.length === 0) {
      console.info('[OfflineManager] Cola de sincronización vacía.');
      return results;
    }

    console.info(`[OfflineManager] Procesando ${queue.length} mutación(es) pendiente(s)…`);

    for (const mutation of queue) {
      // Verificar que aún hay conexión antes de cada petición
      if (!isOnline()) {
        console.info('[OfflineManager] Conexión perdida durante sincronización. Pausando.');
        break;
      }

      // Verificar reintentos máximos
      if (mutation.retries >= MAX_RETRIES) {
        console.warn(
          `[OfflineManager] Mutación ${mutation.id} excedió ${MAX_RETRIES} reintentos. Marcando como conflicto.`
        );
        await updateStatus(mutation.id, 'conflict', 'Máximo de reintentos alcanzado');
        results.conflicts++;
        continue;
      }

      // Marcar como "syncing"
      await updateStatus(mutation.id, 'syncing');

      try {
        const { error, status } = await replayRequest(
          mutation.endpoint,
          mutation.method,
          mutation.data
        );

        if (error) {
          if (isConflictError(status, error)) {
            // Conflicto de negocio: no reintentar
            console.warn(
              `[OfflineManager] Conflicto en mutación ${mutation.id}: ${error}`
            );
            await updateStatus(mutation.id, 'conflict', error);
            results.conflicts++;
          } else {
            // Error recuperable: marcar como failed para reintento
            console.warn(
              `[OfflineManager] Error en mutación ${mutation.id}: ${error}`
            );
            await updateStatus(mutation.id, 'failed', error);
            results.failed++;
          }
        } else {
          // Éxito: eliminar de la cola
          await removeFromQueue(mutation.id);
          results.processed++;
          console.info(`[OfflineManager] ✅ Mutación ${mutation.id} sincronizada.`);
        }
      } catch (networkError) {
        // Error de red (fetch lanza excepción): marcar como failed
        console.error(
          `[OfflineManager] Error de red en mutación ${mutation.id}:`,
          networkError
        );
        await updateStatus(mutation.id, 'failed', networkError.message || 'Error de red');
        results.failed++;

        // Si hay error de red, no seguir intentando con las siguientes
        console.info('[OfflineManager] Pausando sincronización por error de red.');
        break;
      }
    }
  } finally {
    isSyncing = false;
  }

  console.info(
    `[OfflineManager] Sincronización completada: ` +
    `${results.processed} OK, ${results.failed} fallidas, ${results.conflicts} conflictos.`
  );

  // Notificar a los listeners para que actualicen UI (badge de pendientes, etc.)
  notifyListeners(isOnline());

  return results;
}

/**
 * Indica si hay un proceso de sincronización en curso.
 *
 * @returns {boolean}
 */
export function isSyncInProgress() {
  return isSyncing;
}
