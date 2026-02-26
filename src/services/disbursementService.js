/**
 * PredioClick - Disbursement Service (PHP API)
 * Entregas de dinero a socios
 */
import { api } from '../lib/apiClient';

export const disbursementService = {
    async getAll() {
        return api.get('endpoints/disbursements.php');
    },

    async getById(id) {
        return api.get(`endpoints/disbursements.php?id=${id}`);
    },

    async getByProject(projectId) {
        return api.get(`endpoints/disbursements.php?action=byProject&projectId=${projectId}`);
    },

    async getByPartner(partnerId) {
        return api.get(`endpoints/disbursements.php?action=byPartner&partnerId=${partnerId}`);
    },

    async create(data) {
        return api.post('endpoints/disbursements.php', data);
    },

    async update(id, data) {
        return api.put(`endpoints/disbursements.php?id=${id}`, data);
    },

    async delete(id) {
        return api.delete(`endpoints/disbursements.php?id=${id}`);
    }
};
