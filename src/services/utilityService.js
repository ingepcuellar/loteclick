/**
 * PredioClick - Utility Registration Service (PHP API)
 * Matrículas de Servicios Públicos
 */
import { api } from '../lib/apiClient';

export const utilityService = {
    async getAll() {
        return api.get('endpoints/utility_registrations.php');
    },

    async getById(id) {
        return api.get(`endpoints/utility_registrations.php?id=${id}`);
    },

    async getBySale(saleId) {
        return api.get(`endpoints/utility_registrations.php?action=bySale&saleId=${saleId}`);
    },

    async getSummary() {
        return api.get('endpoints/utility_registrations.php?action=summary');
    },

    async create(data) {
        return api.post('endpoints/utility_registrations.php', data);
    },

    async update(id, data) {
        return api.put(`endpoints/utility_registrations.php?id=${id}`, data);
    },

    async delete(id) {
        return api.delete(`endpoints/utility_registrations.php?id=${id}`);
    }
};
