/**
 * LoteClick - Payment Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const paymentService = {
    async getAll() {
        return api.get('endpoints/payments.php');
    },

    async getById(id) {
        return api.get(`endpoints/payments.php?id=${id}`);
    },

    async getBySale(saleId) {
        return api.get(`endpoints/payments.php?action=bySale&saleId=${saleId}`);
    },

    async getTotalBySale(saleId) {
        return api.get(`endpoints/payments.php?action=totalBySale&saleId=${saleId}`);
    },

    async create(payment) {
        return api.post('endpoints/payments.php', payment);
    },

    async update(id, payment) {
        return api.put(`endpoints/payments.php?id=${id}`, payment);
    },

    async delete(id) {
        return api.delete(`endpoints/payments.php?id=${id}`);
    }
};
