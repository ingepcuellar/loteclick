/**
 * White-Label Brand Configuration
 * 
 * Central configuration for all brand-specific values.
 * The active brand is determined by the VITE_BRAND environment variable.
 * 
 * To add a new client:
 * 1. Add a new entry in the `brands` object below
 * 2. Add a matching theme in `themes.js`
 * 3. Create a `.env.{brandKey}` file with VITE_BRAND={brandKey}
 * 4. Place the client's logo in `public/` directory
 */

const brands = {
  predioclick: {
    appName: 'PredioClick',
    subtitle: 'Gestión de Predios',
    description: 'Sistema de Gestión de Proyectos de Venta de Predios',
    emoji: '🏡',
    logo: '/logo.png',
    favicon: '/favicon.svg',
    tokenKey: 'loteclick_token',
    barcodePrefix: 'LCK',
    developer: {
      name: 'ITERA TECH',
      instagram: '@iteratech.co',
      instagramUrl: 'https://instagram.com/iteratech.co',
      web: 'www.iteratech.co',
      webUrl: 'https://www.iteratech.co',
    },
  },

  // ─── J.V.J. Constructores Inmobiliarios S.A.S ───────────────────
  jvj: {
    appName: 'J.V.J. Constructores',
    subtitle: 'Constructores Inmobiliarios S.A.S',
    description: 'Sistema de Gestión de Proyectos Inmobiliarios',
    emoji: '🏡',
    logo: '/logo-jvj.png',
    favicon: '/favicon-jvj.svg',
    tokenKey: 'jvj_token',
    barcodePrefix: 'JVJ',
    developer: {
      name: 'ITERA TECH',
      instagram: '@iteratech.co',
      instagramUrl: 'https://instagram.com/iteratech.co',
      web: 'www.iteratech.co',
      webUrl: 'https://www.iteratech.co',
    },
  },

  // ─── El Diamante Campestre ──────────────────────────────────────
  diamante: {
    appName: 'El Diamante Campestre',
    subtitle: 'Proyecto Campestre',
    description: 'Sistema de Gestión de Lotes - El Diamante Campestre',
    emoji: '💎',
    logo: '/logo-diamante.png',
    favicon: '/favicon-diamante.svg',
    tokenKey: 'diamante_token',
    barcodePrefix: 'EDC',
    legalName: 'Inversiones y Negocios De Los Llanos S.A.S',
    nit: 'NIT: 902073354',
    developer: {
      name: 'ITERA TECH',
      instagram: '@iteratech.co',
      instagramUrl: 'https://instagram.com/iteratech.co',
      web: 'www.iteratech.co',
      webUrl: 'https://www.iteratech.co',
    },
  },
};

const activeBrandKey = import.meta.env.VITE_BRAND || 'predioclick';

if (!brands[activeBrandKey]) {
  console.error(
    `[Brand] Unknown brand "${activeBrandKey}". Falling back to "predioclick". ` +
    `Available brands: ${Object.keys(brands).join(', ')}`
  );
}

/**
 * Active brand configuration.
 * Import this in any component that needs brand-specific values.
 * 
 * @example
 * import { brand } from '../../config/brandConfig';
 * <h1>{brand.appName}</h1>
 */
export const brand = brands[activeBrandKey] || brands.predioclick;

/**
 * All registered brands (for admin/debug purposes)
 */
export const allBrands = brands;
