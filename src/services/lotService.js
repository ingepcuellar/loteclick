/**
 * LoteClick - Individual Lot Service
 */
import { api } from '../lib/apiClient';

export const lotService = {
    async create(lot) {
        return api.post('endpoints/lots.php', lot);
    },
    async update(id, lot) {
        return api.put(`endpoints/lots.php?id=${id}`, lot);
    },
    async delete(id) {
        return api.delete(`endpoints/lots.php?id=${id}`);
    },
};
