/**
 * PredioClick - Sale Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const saleService = {
    async getAll() {
        return api.get('endpoints/sales.php');
    },

    async getById(id) {
        return api.get(`endpoints/sales.php?id=${id}`);
    },

    async getByProject(projectId) {
        return api.get(`endpoints/sales.php?action=byProject&projectId=${projectId}`);
    },

    async create(sale) {
        return api.post('endpoints/sales.php', sale);
    },

    async update(id, sale) {
        return api.put(`endpoints/sales.php?id=${id}`, sale);
    },

    async delete(id) {
        return api.delete(`endpoints/sales.php?id=${id}`);
    }
};
