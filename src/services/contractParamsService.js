/**
 * LoteClick - Contract Parameters Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const contractParamsService = {
    async getParams() {
        return api.get('endpoints/contract_params.php');
    },

    async updateParams(data) {
        return api.put('endpoints/contract_params.php', data);
    },

    async createParams(data) {
        return api.post('endpoints/contract_params.php', data);
    },

    /**
     * Get the next promesa number (auto-increments)
     * @returns {{ data: { numero_promesa: number } }}
     */
    async getNextPromesa() {
        return api.post('endpoints/contract_params.php?action=nextPromesa', {});
    }
};
