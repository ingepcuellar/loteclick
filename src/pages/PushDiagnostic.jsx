import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { FiSmartphone, FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertTriangle, FiSend } from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * In-app Push Notification Diagnostic Panel
 * Shows the status of each step in the push notification flow
 * TEMPORARY - Remove after debugging
 */
function PushDiagnostic() {
    const [logs, setLogs] = useState([]);
    const [running, setRunning] = useState(false);
    const [token, setToken] = useState(null);

    const addLog = (step, status, detail) => {
        setLogs(prev => [...prev, { step, status, detail, time: new Date().toLocaleTimeString() }]);
    };

    const clearLogs = () => {
        setLogs([]);
        setToken(null);
    };

    const runDiagnostic = async () => {
        clearLogs();
        setRunning(true);

        // Step 1: Platform Check
        const platform = Capacitor.getPlatform();
        const isNative = Capacitor.isNativePlatform();
        addLog('1. Plataforma', isNative ? 'ok' : 'error',
            `Platform: ${platform}, isNative: ${isNative}`);

        if (!isNative) {
            addLog('⚠️ DIAGNÓSTICO', 'error',
                'Push NO funciona en web. Debes probar en dispositivo físico iOS.');
            setRunning(false);
            return;
        }

        // Step 2: Check Permissions
        try {
            let permStatus = await PushNotifications.checkPermissions();
            addLog('2. Permiso actual', permStatus.receive === 'granted' ? 'ok' : 'warn',
                `Estado: ${permStatus.receive}`);

            if (permStatus.receive === 'prompt') {
                addLog('2b. Solicitando permiso...', 'info', 'Esperando respuesta del usuario');
                permStatus = await PushNotifications.requestPermissions();
                addLog('2c. Resultado permiso', permStatus.receive === 'granted' ? 'ok' : 'error',
                    `Estado: ${permStatus.receive}`);
            }

            if (permStatus.receive !== 'granted') {
                addLog('⚠️ DIAGNÓSTICO', 'error',
                    'Permisos DENEGADOS. Ve a Ajustes > PredioClick > Notificaciones y activa los permisos.');
                setRunning(false);
                return;
            }
        } catch (err) {
            addLog('2. Permiso', 'error', `Error: ${err.message || JSON.stringify(err)}`);
            setRunning(false);
            return;
        }

        // Step 3: Register with APNs/FCM
        try {
            addLog('3. Registrando con APNs/FCM...', 'info', 'Esperando token del dispositivo...');

            // Set up a one-time listener for the token
            const tokenPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout: No se recibió token en 15 segundos'));
                }, 15000);

                PushNotifications.addListener('registration', (tokenResult) => {
                    clearTimeout(timeout);
                    resolve(tokenResult.value);
                });

                PushNotifications.addListener('registrationError', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            await PushNotifications.register();
            addLog('3b. register() llamado', 'ok', 'Esperando evento registration...');

            const deviceToken = await tokenPromise;
            setToken(deviceToken);
            addLog('3c. Token recibido ✅', 'ok',
                `Token: ${deviceToken.substring(0, 40)}...`);

            // Save it
            localStorage.setItem('push_device_token', deviceToken);

        } catch (err) {
            const errMsg = err.message || JSON.stringify(err);
            addLog('3. Registro FCM', 'error', `Error: ${errMsg}`);

            if (errMsg.includes('Timeout')) {
                addLog('⚠️ DIAGNÓSTICO', 'error',
                    'El dispositivo NO devolvió un token. Posibles causas:\n' +
                    '• APNs Key no configurado en Firebase Console\n' +
                    '• Capabilities de Push no están en el build\n' +
                    '• Problema de conexión a servidores de Apple');
            }
            setRunning(false);
            return;
        }

        // Step 4: Send token to backend
        try {
            const authToken = localStorage.getItem('loteclick_token');
            if (!authToken) {
                addLog('4. Auth Token', 'error', 'No hay token de autenticación. ¿Estás logueado?');
                setRunning(false);
                return;
            }

            addLog('4. Enviando token al backend...', 'info', `URL: ${API_URL}/endpoints/push-notifications.php`);

            const response = await fetch(`${API_URL}/endpoints/push-notifications.php?action=register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    token: token || localStorage.getItem('push_device_token'),
                    platform: Capacitor.getPlatform()
                })
            });

            const result = await response.json();
            addLog('4b. Respuesta backend', response.ok ? 'ok' : 'error',
                `HTTP ${response.status}: ${JSON.stringify(result)}`);

            if (result.error) {
                addLog('⚠️ Error backend', 'error', result.error);
            } else {
                addLog('✅ ÉXITO', 'ok', 'Token registrado correctamente en el servidor');
            }
        } catch (err) {
            addLog('4. Backend', 'error', `Error de red: ${err.message}`);
        }

        setRunning(false);
    };

    // Test sending a push to yourself
    const testSendPush = async () => {
        try {
            addLog('📤 Enviando push de prueba...', 'info', 'Usando endpoint de diagnóstico');
            const authToken = localStorage.getItem('loteclick_token');

            const response = await fetch(`${API_URL}/endpoints/push-notifications.php?action=test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });

            const result = await response.json();
            addLog('📤 Resultado push', response.ok ? 'ok' : 'error',
                JSON.stringify(result));
        } catch (err) {
            addLog('📤 Error', 'error', err.message);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ok': return <FiCheckCircle style={{ color: '#22c55e' }} />;
            case 'error': return <FiXCircle style={{ color: '#ef4444' }} />;
            case 'warn': return <FiAlertTriangle style={{ color: '#f59e0b' }} />;
            default: return <FiRefreshCw style={{ color: '#6366f1' }} />;
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-content">
                    <h1><FiSmartphone /> Push Diagnostic</h1>
                    <p>Panel de diagnóstico de notificaciones push — TEMPORAL</p>
                </div>
            </div>

            <div style={{ padding: '1rem', maxWidth: '700px' }}>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={runDiagnostic}
                        disabled={running}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <FiRefreshCw className={running ? 'spinning' : ''} />
                        {running ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={testSendPush}
                        disabled={running || !token}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <FiSend /> Enviar Push de Prueba
                    </button>

                    <button
                        className="btn btn-outline"
                        onClick={clearLogs}
                        style={{ marginLeft: 'auto' }}
                    >
                        Limpiar
                    </button>
                </div>

                {/* Info card */}
                <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary, #f1f5f9)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Plataforma:</strong> {Capacitor.getPlatform()} |
                        <strong> Nativo:</strong> {Capacitor.isNativePlatform() ? '✅ Sí' : '❌ No'} |
                        <strong> Token guardado:</strong> {localStorage.getItem('push_device_token') ? '✅ Sí' : '❌ No'}
                    </p>
                </div>

                {/* Logs */}
                {logs.length === 0 ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <FiSmartphone size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <p>Presiona "Ejecutar Diagnóstico" para verificar el flujo de push notifications</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {logs.map((log, i) => (
                            <div
                                key={i}
                                className="card"
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderLeft: `4px solid ${log.status === 'ok' ? '#22c55e' :
                                        log.status === 'error' ? '#ef4444' :
                                            log.status === 'warn' ? '#f59e0b' : '#6366f1'
                                        }`
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    {getStatusIcon(log.status)}
                                    <strong style={{ fontSize: '0.9rem' }}>{log.step}</strong>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {log.time}
                                    </span>
                                </div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.8rem',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}>
                                    {log.detail}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spinning {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
}

export default PushDiagnostic;
