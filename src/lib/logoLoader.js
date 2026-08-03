import { resolveImageUrl } from './barcodeUtils';

let logoCache = {};

/**
 * Carga una imagen desde una URL y la convierte a base64
 * @param {string} url - URL de la imagen (relativa o absoluta)
 * @returns {Promise<string|null>} - base64 string o null si falla
 */
export async function loadImageAsBase64(url) {
    if (!url) return null;
    if (logoCache[url]) return logoCache[url];
    
    try {
        const fullUrl = resolveImageUrl(url);

        const response = await fetch(fullUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result;
                logoCache[url] = base64;
                resolve(base64);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

/**
 * Carga el logo de la marca y el del proyecto (si existe)
 * @returns {Promise<{brandLogo: string|null, projectLogo: string|null}>}
 */
export async function loadLogos(brandLogoUrl, projectLogoUrl) {
    const [brandLogo, projectLogo] = await Promise.all([
        loadImageAsBase64(brandLogoUrl),
        projectLogoUrl ? loadImageAsBase64(projectLogoUrl) : null
    ]);
    return { brandLogo, projectLogo };
}

/**
 * Obtiene las dimensiones de una imagen base64
 */
export function getImageDimensions(base64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 100, height: 50 });
        img.src = base64;
    });
}
