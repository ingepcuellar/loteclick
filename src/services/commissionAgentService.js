/**
 * LoteClick - Commission Agent Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const commissionAgentService = {
    async getAll() {
        return api.get('endpoints/commission_agents.php');
    },

    async getById(id) {
        return api.get(`endpoints/commission_agents.php?id=${id}`);
    },

    async create(agentData) {
        return api.post('endpoints/commission_agents.php', agentData);
    },

    async update(id, agentData) {
        return api.patch(`endpoints/commission_agents.php?id=${id}`, agentData);
    },

    async delete(id) {
        return api.delete(`endpoints/commission_agents.php?id=${id}`);
    }
};
