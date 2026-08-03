/**
 * syncQueue.js — Cola de mutaciones offline
 *
 * Almacena las operaciones de escritura (POST, PUT, PATCH, DELETE)
 * que el usuario realiza mientras está sin conexión. Cuando se
 * recupera la conectividad, el offlineManager procesa esta cola
 * en orden FIFO.
 *
 * Cada mutación se persiste en el object store 'syncQueue' de IndexedDB.
 *
 * @module syncQueue
 */
import { getDB, SYNC_QUEUE_STORE } from './offlineDB';

/**
 * @typedef {'pending'|'syncing'|'failed'|'done'|'conflict'} MutationStatus
 */

/**
 * @typedef {Object} QueuedMutation
 * @property {string}         id        — UUID único de la mutación
 * @property {number}         timestamp — Epoch ms en que se creó
 * @property {string}         endpoint  — Ruta relativa del API (e.g. 'sales.php')
 * @property {string}         method    — Método HTTP (POST, PUT, PATCH, DELETE)
 * @property {Object|null}    data      — Cuerpo de la petición (se serializará a JSON)
 * @property {MutationStatus} status    — Estado actual de la mutación
 * @property {string|null}    error     — Mensaje de error (si status === 'failed' o 'conflict')
 * @property {number}         retries   — Número de reintentos realizados
 */

/**
 * Agrega una nueva mutación a la cola.
 *
 * @param {Object} mutation
 * @param {string} mutation.endpoint — Ruta relativa del endpoint
 * @param {string} mutation.method   — Método HTTP
 * @param {Object} [mutation.data]   — Datos del body
 * @returns {Promise<QueuedMutation>} — La mutación creada con id y timestamp
 */
export async function addToQueue({ endpoint, method, data = null }) {
  const db = await getDB();

  /** @type {QueuedMutation} */
  const entry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    endpoint,
    method: method.toUpperCase(),
    data,
    status: 'pending',
    error: null,
    retries: 0,
  };

  await db.put(SYNC_QUEUE_STORE, entry);
  return entry;
}

/**
 * Obtiene todas las mutaciones de la cola, ordenadas por timestamp (FIFO).
 *
 * @returns {Promise<QueuedMutation[]>}
 */
export async function getQueue() {
  const db = await getDB();
  const all = await db.getAll(SYNC_QUEUE_STORE);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Obtiene solo las mutaciones pendientes o fallidas (candidatas a reintento),
 * ordenadas por timestamp (FIFO).
 *
 * @returns {Promise<QueuedMutation[]>}
 */
export async function getPendingQueue() {
  const all = await getQueue();
  return all.filter((m) => m.status === 'pending' || m.status === 'failed');
}

/**
 * Actualiza el estado de una mutación en la cola.
 *
 * @param {string}         id     — UUID de la mutación
 * @param {MutationStatus} status — Nuevo estado
 * @param {string|null}    [error=null] — Mensaje de error (opcional)
 * @returns {Promise<void>}
 */
export async function updateStatus(id, status, error = null) {
  const db = await getDB();
  const entry = await db.get(SYNC_QUEUE_STORE, id);

  if (!entry) {
    console.warn(`[SyncQueue] Mutación con id "${id}" no encontrada.`);
    return;
  }

  entry.status = status;
  entry.error = error;

  if (status === 'syncing') {
    entry.retries += 1;
  }

  await db.put(SYNC_QUEUE_STORE, entry);
}

/**
 * Elimina una mutación de la cola por su id.
 *
 * @param {string} id — UUID de la mutación
 * @returns {Promise<void>}
 */
export async function removeFromQueue(id) {
  const db = await getDB();
  return db.delete(SYNC_QUEUE_STORE, id);
}

/**
 * Elimina todas las mutaciones de la cola.
 *
 * @returns {Promise<void>}
 */
export async function clearQueue() {
  const db = await getDB();
  return db.clear(SYNC_QUEUE_STORE);
}

/**
 * Devuelve la cantidad total de mutaciones en la cola.
 *
 * @returns {Promise<number>}
 */
export async function getQueueCount() {
  const db = await getDB();
  return db.count(SYNC_QUEUE_STORE);
}

/**
 * Devuelve la cantidad de mutaciones pendientes (pending + failed).
 *
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
  const pending = await getPendingQueue();
  return pending.length;
}
