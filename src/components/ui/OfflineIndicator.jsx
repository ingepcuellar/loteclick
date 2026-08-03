/**
 * OfflineIndicator - Componente visual que muestra el estado de conexión
 * y la cantidad de operaciones pendientes por sincronizar.
 */
import React, { useState, useEffect } from 'react';
import { FiWifi, FiWifiOff, FiRefreshCw, FiCloud, FiCloudOff } from 'react-icons/fi';

function OfflineIndicator({ pendingCount = 0, isSyncing = false, onForceSync }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showBanner, setShowBanner] = useState(false);
    const [justReconnected, setJustReconnected] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setJustReconnected(true);
            // Ocultar el banner de reconexión después de 5 segundos
            setTimeout(() => setJustReconnected(false), 5000);
        };
        const handleOffline = () => {
            setIsOnline(false);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Mostrar barra solo si está offline o hay pendientes o acaba de reconectar
    const shouldShow = !isOnline || pendingCount > 0 || justReconnected || isSyncing;

    if (!shouldShow) return null;

    const getBannerStyle = () => {
        if (!isOnline) {
            return {
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
            };
        }
        if (isSyncing) {
            return {
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
            };
        }
        if (pendingCount > 0) {
            return {
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
            };
        }
        if (justReconnected) {
            return {
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
            };
        }
        return {};
    };

    const getMessage = () => {
        if (!isOnline) {
            return (
                <>
                    <FiWifiOff size={16} />
                    <span>Sin conexión a internet — Modo Offline activado</span>
                    {pendingCount > 0 && (
                        <span style={{
                            background: 'rgba(255,255,255,0.25)',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                        }}>
                            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                        </span>
                    )}
                </>
            );
        }
        if (isSyncing) {
            return (
                <>
                    <FiRefreshCw size={16} className="spin-animation" />
                    <span>Sincronizando datos con el servidor...</span>
                </>
            );
        }
        if (pendingCount > 0) {
            return (
                <>
                    <FiCloud size={16} />
                    <span>{pendingCount} operación{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''} de sincronizar</span>
                    {onForceSync && (
                        <button
                            onClick={onForceSync}
                            style={{
                                background: 'rgba(255,255,255,0.25)',
                                border: 'none',
                                color: '#fff',
                                padding: '2px 12px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            <FiRefreshCw size={12} /> Sincronizar ahora
                        </button>
                    )}
                </>
            );
        }
        if (justReconnected) {
            return (
                <>
                    <FiWifi size={16} />
                    <span>¡Conexión restaurada!</span>
                </>
            );
        }
        return null;
    };

    return (
        <div
            id="offline-indicator"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
                ...getBannerStyle(),
            }}
        >
            {getMessage()}
        </div>
    );
}

export default OfflineIndicator;
