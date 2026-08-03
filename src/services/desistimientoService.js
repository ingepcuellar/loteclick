/**
 * LoteClick - Desistimiento Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const desistimientoService = {
    async getAll() {
        return api.get('endpoints/desistimientos.php');
    },

    async getById(id) {
        return api.get(`endpoints/desistimientos.php?id=${id}`);
    },

    async getByProject(projectId) {
        return api.get(`endpoints/desistimientos.php?action=byProject&projectId=${projectId}`);
    },

    /**
     * Crea el desistimiento Y elimina la venta en una sola llamada (transacción en el servidor).
     * @param {object} data - { sale_id, amount_retained, desistimiento_date, reason, notes }
     */
    async create(data) {
        return api.post('endpoints/desistimientos.php', data);
    },

    async update(id, data) {
        return api.put(`endpoints/desistimientos.php?id=${id}`, data);
    },

    async delete(id) {
        return api.delete(`endpoints/desistimientos.php?id=${id}`);
    }
};
