/**
 * PredioClick - Installment Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const installmentService = {
    async getBySale(saleId) {
        return api.get(`endpoints/installments.php?action=bySale&saleId=${saleId}`);
    },

    async generateInstallments(saleId, totalAmount, numInstallments, startDate, downPayment = 0) {
        return api.post('endpoints/installments.php?action=generate', {
            saleId,
            totalAmount,
            numInstallments,
            startDate,
            downPayment
        });
    },

    async markAsPaid(installmentId, paymentId = null) {
        return api.patch('endpoints/installments.php?action=markAsPaid', {
            id: installmentId,
            paymentId
        });
    },

    async markAsPartial(installmentId, paidAmount) {
        return api.patch('endpoints/installments.php?action=markAsPartial', {
            id: installmentId,
            paidAmount
        });
    },

    async update(id, data) {
        return api.put(`endpoints/installments.php?id=${id}`, data);
    },

    async delete(id) {
        return api.delete(`endpoints/installments.php?id=${id}`);
    },

    async deleteBySale(saleId) {
        return api.post('endpoints/installments.php?action=deleteBySale', { saleId });
    },

    async recalculateInstallments(saleId) {
        return api.post('endpoints/installments.php?action=recalculate', { saleId });
    },

    async restructurePayments(saleId, newNumInstallments, startDate) {
        return api.post('endpoints/installments.php?action=restructure', {
            saleId,
            newNumInstallments,
            startDate
        });
    },

    async calculateRestructure(saleId, paymentAmount) {
        return api.post('endpoints/installments.php?action=calculateRestructure', {
            saleId,
            paymentAmount
        });
    },

    async autoRedistribute(saleId, paymentAmount, paymentId) {
        return api.post('endpoints/installments.php?action=autoRedistribute', {
            saleId,
            paymentAmount,
            paymentId
        });
    },

    async getOverdue() {
        return api.get('endpoints/installments.php?action=overdue');
    }
};
