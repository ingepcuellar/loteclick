/**
 * LoteClick - Project Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const projectService = {
    async getAll() {
        return api.get('endpoints/projects.php');
    },

    async getById(id) {
        return api.get(`endpoints/projects.php?id=${id}`);
    },

    async create(project) {
        return api.post('endpoints/projects.php', project);
    },

    async update(id, project) {
        return api.put(`endpoints/projects.php?id=${id}`, project);
    },

    async delete(id) {
        return api.delete(`endpoints/projects.php?id=${id}`);
    }
};
