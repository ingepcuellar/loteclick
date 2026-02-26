/**
 * PredioClick - Storage Service (PHP API)
 * Handles file uploads to cPanel server instead of Supabase Storage
 */
import { api } from '../lib/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || './api';

export const storageService = {
    /**
     * Upload a file (receipt image)
     */
    async uploadFile(file, path = '') {
        const formData = new FormData();
        formData.append('file', file);
        if (path) formData.append('path', path);

        return api.upload('endpoints/upload.php', formData);
    },

    /**
     * Delete a file
     */
    async deleteFile(url) {
        return api.post('endpoints/upload.php?action=delete', { url });
    },

    /**
     * Get public URL for a file
     * The PHP API returns relative URLs, so we prepend the API base
     */
    getPublicUrl(path) {
        if (!path) return null;
        // If it's already an absolute URL, return as is
        if (path.startsWith('http')) return path;
        // Build URL relative to API base
        return `${API_BASE}/${path}`;
    }
};
