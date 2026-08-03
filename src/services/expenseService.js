/**
 * LoteClick - Expense Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const expenseService = {
    async getAll() {
        return api.get('endpoints/expenses.php');
    },

    async getById(id) {
        return api.get(`endpoints/expenses.php?id=${id}`);
    },

    async getByProject(projectId) {
        return api.get(`endpoints/expenses.php?action=byProject&projectId=${projectId}`);
    },

    async getByCategory(category) {
        return api.get(`endpoints/expenses.php?action=byCategory&category=${encodeURIComponent(category)}`);
    },

    async getTotalByProject(projectId) {
        return api.get(`endpoints/expenses.php?action=totalByProject&projectId=${projectId}`);
    },

    async getPendingCommissions() {
        return api.get('endpoints/expenses.php?action=pendingCommissions');
    },

    async create(expense) {
        return api.post('endpoints/expenses.php', expense);
    },

    async update(id, expense) {
        return api.put(`endpoints/expenses.php?id=${id}`, expense);
    },

    async delete(id) {
        return api.delete(`endpoints/expenses.php?id=${id}`);
    }
};
