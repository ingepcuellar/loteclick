/**
 * PredioClick - Notification Service (PHP API)
 */
import { api } from '../lib/apiClient';

export const notificationService = {
    async getAll() {
        return api.get('endpoints/notifications.php');
    },

    async getById(id) {
        return api.get(`endpoints/notifications.php?id=${id}`);
    },

    async getByPartner(partnerId) {
        return api.get(`endpoints/notifications.php?action=byPartner&partnerId=${partnerId}`);
    },

    async getUnreadCount(recipientId = null) {
        const params = recipientId ? `&recipientId=${recipientId}` : '';
        return api.get(`endpoints/notifications.php?action=count${params}`);
    },

    async create(notification) {
        return api.post('endpoints/notifications.php', notification);
    },

    async markAsRead(id) {
        return api.put('endpoints/notifications.php?action=markRead', { id });
    },

    async updateDiscountStatus(saleId, status) {
        return api.put('endpoints/notifications.php?action=updateDiscount', {
            sale_id: saleId,
            status
        });
    }
};
