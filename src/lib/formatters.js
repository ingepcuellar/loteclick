/**
 * Shared formatting utilities for PredioClick
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
 * Format a date string to short Spanish locale format.
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date string (e.g., "22 feb 2026")
 */
export const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
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
    return new Date(dateString).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};
