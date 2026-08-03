/**
 * LoteClick — Bank Reconciliation Service (Ítem 4b)
 * Comunica el frontend con los endpoints de movimientos bancarios y conciliación.
 */
import { api } from '../lib/apiClient';

const BASE = 'endpoints/bank_movements.php';
const ACCOUNTS = 'endpoints/bank_accounts.php';

export const bankReconciliationService = {
    // ---- Movimientos bancarios ----
    async getAll(filters = {}) {
        const params = new URLSearchParams();
        if (filters.projectId)  params.append('project_id',  filters.projectId);
        if (filters.accountId)  params.append('account_id',  filters.accountId);
        if (filters.month)      params.append('month',        filters.month);
        if (filters.tipo)       params.append('tipo',         filters.tipo);
        if (filters.conciliado !== undefined) params.append('conciliado', filters.conciliado ? '1' : '0');
        const qs = params.toString();
        return api.get(`${BASE}${qs ? '?' + qs : ''}`);
    },

    async getById(id) {
        return api.get(`${BASE}?id=${id}`);
    },

    async create(data) {
        return api.post(BASE, data);
    },

    async update(id, data) {
        return api.put(`${BASE}?id=${id}`, data);
    },

    async delete(id) {
        return api.delete(`${BASE}?id=${id}`);
    },

    // ---- Conciliación ----
    /** Vincula el movimiento con un pago o gasto del sistema y lo marca conciliado */
    async reconcile(id, { pagoId = null, gastoId = null } = {}) {
        return api.put(`${BASE}?action=reconcile&id=${id}`, {
            pago_id:  pagoId,
            gasto_id: gastoId,
        });
    },

    /** Resumen comparativo Sistema vs Banco */
    async getSummary(projectId, month) {
        const params = new URLSearchParams({ action: 'summary' });
        if (projectId) params.append('project_id', projectId);
        if (month)     params.append('month', month);
        return api.get(`${BASE}?${params.toString()}`);
    },

    // ---- Cuentas Bancarias ----
    async getAccounts(projectId = '') {
        const qs = projectId ? `?project_id=${projectId}` : '';
        return api.get(`${ACCOUNTS}${qs}`);
    },

    async createAccount(data) {
        return api.post(ACCOUNTS, data);
    },

    async deleteAccount(id) {
        return api.delete(`${ACCOUNTS}?id=${id}`);
    },
};
