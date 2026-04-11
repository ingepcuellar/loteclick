/**
 * Shared formatting utilities for LoteClick
 * Centralizes currency and date formatting to avoid duplication across components.
 */

/**
 * Format a number as Colombian Peso (COP) currency.
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string (e.g., "$ 1.500.000")
 */
export const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(num);
};

/**
 * Safely parse a date string, avoiding the UTC-midnight timezone bug.
 * Date-only strings like "2024-05-15" are parsed as UTC midnight by JS,
 * which in negative-offset timezones (e.g. UTC-5 Colombia) becomes the
 * previous day. Appending T12:00:00 anchors at noon, preventing this.
 * @param {string|Date} dateString
 * @returns {Date}
 */
export const safeParseDate = (dateString) => {
    if (dateString instanceof Date) return dateString;
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString + 'T12:00:00');
    }
    return new Date(dateString);
};

/**
 * Format a date string to short Spanish locale format.
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date string (e.g., "22 feb 2026")
 */
export const formatDate = (dateString) => {
    return safeParseDate(dateString).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Format a date string to long Spanish locale format.
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date string (e.g., "22 de febrero de 2026")
 */
export const formatDateLong = (dateString) => {
    return safeParseDate(dateString).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};
