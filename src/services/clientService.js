/**
 * PredioClick - Client Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const clientService = {
    async getAll() {
        return api.get('endpoints/clients.php');
    },

    async getById(id) {
        return api.get(`endpoints/clients.php?id=${id}`);
    },

    async create(client) {
        // Map frontend field names to backend
        const data = {
            name: client.fullName || client.name,
            document: client.document,
            phone: client.phone,
            email: client.email,
            address: client.address,
            notes: client.notes,
        };
        return api.post('endpoints/clients.php', data);
    },

    async update(id, client) {
        const data = {
            name: client.fullName || client.name,
            document: client.document,
            phone: client.phone,
            email: client.email,
            address: client.address,
            notes: client.notes,
        };
        return api.put(`endpoints/clients.php?id=${id}`, data);
    },

    async delete(id) {
        return api.delete(`endpoints/clients.php?id=${id}`);
    },

    async search(query) {
        return api.get(`endpoints/clients.php?action=search&q=${encodeURIComponent(query)}`);
    }
};
