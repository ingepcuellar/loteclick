import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Push Notification Service for LoteClick
 * Handles registration, permissions, and push events on iOS/Android
 */
class PushNotificationService {
    static initialized = false;
    static token = null;

    /**
     * Initialize push notifications
     * Should be called once when the app starts and user is logged in
     */
    static async initialize(authToken, onNotificationReceived) {
        if (!Capacitor.isNativePlatform()) {
            console.log('Push notifications only available on native platforms');
            return false;
        }

        if (this.initialized) {
            // Even if already initialized, try to re-register saved token
            await this.retryRegistration(authToken);
            return true;
        }

        try {
            // Check current permission status
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.log('Push notification permission not granted');
                return false;
            }

            // Set up listeners BEFORE calling register
            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token:', token.value);
                this.token = token.value;

                // Save token locally for retry on next app start
                localStorage.setItem('push_device_token', token.value);

                // Send token to backend
                await this.registerTokenWithBackend(authToken, token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push registration error:', JSON.stringify(error));
            });

            // Foreground notifications
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received in foreground:', notification);
                if (onNotificationReceived) {
                    onNotificationReceived(notification);
                }
            });

            // Notification tap
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('Push notification tapped:', action);
                const route = action.notification?.data?.route || '/notifications';
                window.location.href = route;
            });

            // Register with APNs/FCM
            await PushNotifications.register();

            this.initialized = true;

            // Also retry registration with saved token after a delay
            // (in case the 'registration' event doesn't fire again)
            setTimeout(() => this.retryRegistration(authToken), 3000);

            return true;
        } catch (error) {
            console.error('Error initializing push notifications:', error);
            return false;
        }
    }

    /**
     * Retry registration with a previously saved token
     */
    static async retryRegistration(authToken) {
        try {
            const savedToken = localStorage.getItem('push_device_token');
            if (savedToken && authToken) {
                console.log('Retrying push token registration with saved token...');
                this.token = savedToken;
                await this.registerTokenWithBackend(authToken, savedToken);
            }
        } catch (err) {
            console.error('Retry registration failed:', err);
        }
    }

    /**
     * Register device token with backend
     */
    static async registerTokenWithBackend(authToken, deviceToken) {
        try {
            console.log('Registering push token with backend...');
            const response = await fetch(`${API_URL}/endpoints/push-notifications.php?action=register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    token: deviceToken,
                    platform: Capacitor.getPlatform()
                })
            });

            const result = await response.json();
            console.log('Token registration result:', JSON.stringify(result));

            if (result.error) {
                console.error('Token registration error:', result.error);
            }

            return result;
        } catch (error) {
            console.error('Error registering token with backend:', error);
            return null;
        }
    }

    /**
     * Unregister device token (call on logout)
     */
    static async unregister(authToken) {
        if (!Capacitor.isNativePlatform()) return;

        const tokenToUnregister = this.token || localStorage.getItem('push_device_token');
        if (!tokenToUnregister) return;

        try {
            await fetch(`${API_URL}/endpoints/push-notifications.php?action=unregister`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ token: tokenToUnregister })
            });

            await PushNotifications.removeAllListeners();
            localStorage.removeItem('push_device_token');
            this.initialized = false;
            this.token = null;
        } catch (error) {
            console.error('Error unregistering push:', error);
        }
    }
}

export default PushNotificationService;
