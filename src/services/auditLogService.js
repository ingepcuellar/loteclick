import { api } from '../lib/apiClient';

export const auditLogService = {
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        return api.get(`endpoints/audit_logs.php${query ? '?' + query : ''}`);
    },

    async getByEntity(entity, entityId) {
        return api.get(`endpoints/audit_logs.php?action=byEntity&entity=${entity}&entityId=${entityId}`);
    },

    async create(log) {
        return api.post('endpoints/audit_logs.php', log);
    }
};
