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

        if (this.initialized) return true;

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

            // Register with APNs/FCM
            await PushNotifications.register();

            // Listen for registration success
            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token:', token.value);
                this.token = token.value;

                // Send token to backend
                await this.registerTokenWithBackend(authToken, token.value);
            });

            // Listen for registration errors
            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push registration error:', error);
            });

            // Listen for push notifications received while app is in foreground
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received in foreground:', notification);
                if (onNotificationReceived) {
                    onNotificationReceived(notification);
                }
            });

            // Listen for push notification action (user tapped the notification)
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('Push notification tapped:', action);
                // Navigate to notifications page
                const route = action.notification?.data?.route || '/notifications';
                window.location.href = route;
            });

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing push notifications:', error);
            return false;
        }
    }

    /**
     * Register device token with backend
     */
    static async registerTokenWithBackend(authToken, deviceToken) {
        try {
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
            console.log('Token registered with backend:', result);
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
        if (!Capacitor.isNativePlatform() || !this.token) return;

        try {
            await fetch(`${API_URL}/endpoints/push-notifications.php?action=unregister`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ token: this.token })
            });

            // Remove all listeners
            await PushNotifications.removeAllListeners();
            this.initialized = false;
            this.token = null;
        } catch (error) {
            console.error('Error unregistering push:', error);
        }
    }
}

export default PushNotificationService;
