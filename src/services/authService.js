/**
 * LoteClick - Auth Service (PHP API)
 */
import { api, setToken } from '../lib/apiClient';

export const authService = {
    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
        const result = await api.post('endpoints/auth.php?action=login', { email, password });
        if (result.data?.token) {
            setToken(result.data.token);
        }
        return result;
    },

    /**
     * Register a new user (requires admin auth)
     */
    async signUp(userData) {
        return api.post('endpoints/auth.php?action=register', userData);
    },

    /**
     * Sign out - clear token
     */
    async signOut() {
        setToken(null);
        return { error: null };
    },

    /**
     * Get current session (check if token is valid)
     */
    async getSession() {
        const token = localStorage.getItem('loteclick_token');
        if (!token) return { data: null, error: null };

        const result = await api.get('endpoints/auth.php?action=me');
        if (result.error) {
            setToken(null);
            return { data: null, error: result.error };
        }
        return { data: { user: result.data }, error: null };
    },

    /**
     * Get current user profile
     */
    async getUser() {
        return api.get('endpoints/auth.php?action=me');
    },

    /**
     * Get user profile
     */
    async getProfile(userId) {
        return api.get(`endpoints/auth.php?action=me`);
    },

    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        return api.put('endpoints/auth.php?action=update', { id: userId, ...updates });
    },

    /**
     * Get all users (admin)
     */
    async getAllUsers() {
        return api.get('endpoints/auth.php?action=users');
    },

    /**
     * Listen for auth state changes - not needed with JWT.
     * Returns a dummy unsubscribe function for compatibility.
     */
    onAuthStateChange(callback) {
        // Check initial state
        const token = localStorage.getItem('loteclick_token');
        if (token) {
            // Verify token is valid
            this.getSession().then(result => {
                if (result.data) {
                    callback('SIGNED_IN', result.data);
                } else {
                    callback('SIGNED_OUT', null);
                }
            });
        } else {
            setTimeout(() => callback('SIGNED_OUT', null), 0);
        }

        return { data: { subscription: { unsubscribe: () => { } } } };
    }
};
