/**
 * OfflineContext - Provee el estado de conexión y la cola de sincronización
 * a toda la aplicación.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onStatusChange, syncPendingMutations } from '../lib/offlineManager';
import { getPendingCount } from '../lib/syncQueue';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState(null);

    // Escuchar cambios de conexión
    useEffect(() => {
        const unsubscribe = onStatusChange((online) => {
            setIsOnline(online);
            if (online) {
                // Actualizar conteo de pendientes
                refreshPendingCount();
            }
        });

        // Cargar conteo inicial
        refreshPendingCount();

        return unsubscribe;
    }, []);

    // Refrescar el conteo de operaciones pendientes
    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await getPendingCount();
            setPendingCount(count);
        } catch (err) {
            console.warn('[OfflineContext] Error obteniendo pendientes:', err);
        }
    }, []);

    // Forzar sincronización manual
    const forceSync = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await syncPendingMutations();
            setLastSyncResult(result);
            await refreshPendingCount();

            if (result.conflicts > 0) {
                alert(`⚠️ Sincronización completada con ${result.conflicts} conflicto(s). Algunas operaciones no se pudieron procesar.`);
            }
        } catch (err) {
            console.error('[OfflineContext] Error sincronizando:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, refreshPendingCount]);

    // Auto-sincronizar cuando vuelve la conexión
    useEffect(() => {
        if (isOnline && pendingCount > 0 && !isSyncing) {
            // Esperar 2 segundos para confirmar que la conexión es estable
            const timer = setTimeout(() => {
                forceSync();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, pendingCount, isSyncing, forceSync]);

    // Cada vez que se hace una mutación offline, actualizar el conteo
    useEffect(() => {
        // Escuchar evento custom para actualizar el badge
        const handleMutationQueued = () => refreshPendingCount();
        window.addEventListener('offline-mutation-queued', handleMutationQueued);
        return () => window.removeEventListener('offline-mutation-queued', handleMutationQueued);
    }, [refreshPendingCount]);

    const value = {
        isOnline,
        pendingCount,
        isSyncing,
        lastSyncResult,
        forceSync,
        refreshPendingCount,
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
}

export function useOffline() {
    const ctx = useContext(OfflineContext);
    if (!ctx) {
        throw new Error('useOffline debe usarse dentro de un OfflineProvider');
    }
    return ctx;
}
