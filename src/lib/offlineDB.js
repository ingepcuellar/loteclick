/**
 * offlineDB.js — Capa de persistencia offline con IndexedDB
 *
 * Utiliza la librería `idb` para crear y gestionar la base de datos
 * 'predioclick-offline'. Provee funciones genéricas y reutilizables
 * para cualquier object store definido en el esquema.
 *
 * @module offlineDB
 */
import { openDB } from 'idb';

/** Nombre de la base de datos */
const DB_NAME = 'predioclick-offline';

/** Versión actual del esquema */
const DB_VERSION = 1;

/**
 * Lista de object stores de dominio.
 * Cada uno usa 'id' como keyPath.
 */
const DOMAIN_STORES = [
  'projects',
  'clients',
  'sales',
  'payments',
  'expenses',
  'installments',
  'desistimientos',
  'utilityRegistrations',
  'lots',
  'partners',
  'bankAccounts',
  'commissionAgents',
  'stages',
  'blocks',
];

/** Store para la cola de sincronización */
const SYNC_QUEUE_STORE = 'syncQueue';

/** Store para metadatos (e.g. lastSyncTime por entidad) */
const METADATA_STORE = 'metadata';

/**
 * Promesa singleton de la conexión a la base de datos.
 * Se inicializa una sola vez y se reutiliza en todas las llamadas.
 * @type {Promise<import('idb').IDBPDatabase> | null}
 */
let dbPromise = null;

/**
 * Abre (o crea) la base de datos y devuelve la conexión.
 * En la primera invocación ejecuta el upgrade para crear los stores.
 *
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // — Stores de dominio —
        for (const storeName of DOMAIN_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }

        // — Cola de sincronización —
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        }

        // — Metadatos —
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ─────────────────────────────────────────────
// Operaciones genéricas sobre stores de dominio
// ─────────────────────────────────────────────

/**
 * Guarda un arreglo completo de registros en un store,
 * reemplazando los existentes con la misma clave.
 *
 * @param {string} storeName — Nombre del object store
 * @param {Array<Object>} items — Registros a guardar (cada uno debe tener `id`)
 * @returns {Promise<void>}
 */
export async function saveAll(storeName, items) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const item of items) {
    await store.put(item);
  }
  await tx.done;
}

/**
 * Obtiene todos los registros de un store.
 *
 * @param {string} storeName — Nombre del object store
 * @returns {Promise<Array<Object>>}
 */
export async function getAll(storeName) {
  const db = await getDB();
  return db.getAll(storeName);
}

/**
 * Obtiene un registro por su id.
 *
 * @param {string} storeName — Nombre del object store
 * @param {string|number} id — Clave primaria del registro
 * @returns {Promise<Object|undefined>}
 */
export async function getOne(storeName, id) {
  const db = await getDB();
  return db.get(storeName, id);
}

/**
 * Guarda (o actualiza) un único registro en un store.
 *
 * @param {string} storeName — Nombre del object store
 * @param {Object} item — Registro a guardar (debe tener `id`)
 * @returns {Promise<IDBValidKey>}
 */
export async function saveOne(storeName, item) {
  const db = await getDB();
  return db.put(storeName, item);
}

/**
 * Elimina un registro por su id.
 *
 * @param {string} storeName — Nombre del object store
 * @param {string|number} id — Clave primaria del registro a eliminar
 * @returns {Promise<void>}
 */
export async function deleteOne(storeName, id) {
  const db = await getDB();
  return db.delete(storeName, id);
}

/**
 * Elimina todos los registros de un store específico.
 *
 * @param {string} storeName — Nombre del object store
 * @returns {Promise<void>}
 */
export async function clearStore(storeName) {
  const db = await getDB();
  return db.clear(storeName);
}

/**
 * Elimina todos los registros de TODOS los stores de dominio,
 * la cola de sincronización y los metadatos.
 * Útil al cerrar sesión.
 *
 * @returns {Promise<void>}
 */
export async function clearAll() {
  const db = await getDB();
  const allStores = [...DOMAIN_STORES, SYNC_QUEUE_STORE, METADATA_STORE];
  const tx = db.transaction(allStores, 'readwrite');
  for (const name of allStores) {
    tx.objectStore(name).clear();
  }
  await tx.done;
}

// ─────────────────────────────────────────────
// Metadatos de sincronización
// ─────────────────────────────────────────────

/**
 * Guarda la fecha/hora del último sync exitoso para una entidad.
 *
 * @param {string} storeName — Nombre del store sincronizado
 * @param {Date} [date=new Date()] — Fecha del último sync
 * @returns {Promise<void>}
 */
export async function setLastSyncTime(storeName, date = new Date()) {
  const db = await getDB();
  await db.put(METADATA_STORE, {
    key: `lastSync_${storeName}`,
    value: date.toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Obtiene la fecha del último sync exitoso para una entidad.
 *
 * @param {string} storeName — Nombre del store
 * @returns {Promise<string|null>} — ISO string o null si nunca se sincronizó
 */
export async function getLastSyncTime(storeName) {
  const db = await getDB();
  const record = await db.get(METADATA_STORE, `lastSync_${storeName}`);
  return record?.value ?? null;
}

/**
 * Guarda un valor de metadatos genérico.
 *
 * @param {string} key — Clave del metadato
 * @param {*} value — Valor a almacenar
 * @returns {Promise<void>}
 */
export async function setMetadata(key, value) {
  const db = await getDB();
  await db.put(METADATA_STORE, {
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Obtiene un valor de metadatos genérico.
 *
 * @param {string} key — Clave del metadato
 * @returns {Promise<*>} — El valor almacenado o undefined
 */
export async function getMetadata(key) {
  const db = await getDB();
  const record = await db.get(METADATA_STORE, key);
  return record?.value;
}

// ─────────────────────────────────────────────
// Exportaciones de constantes (para uso interno)
// ─────────────────────────────────────────────

export { DOMAIN_STORES, SYNC_QUEUE_STORE, METADATA_STORE, DB_NAME, DB_VERSION };

/**
 * Exporta la función getDB para módulos internos que necesiten
 * acceso directo a la conexión (e.g. syncQueue).
 */
export { getDB };
