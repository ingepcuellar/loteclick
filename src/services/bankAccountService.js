import { api } from '../lib/apiClient';

export const bankAccountService = {
    async getAll() {
        return api.get('endpoints/bank_accounts.php');
    },

    async create(account) {
        return api.post('endpoints/bank_accounts.php', account);
    },

    async delete(id) {
        return api.delete(`endpoints/bank_accounts.php?id=${id}`);
    }
};
