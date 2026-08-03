import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { OfflineProvider } from './context/OfflineContext.jsx'
import { brand } from './config/brandConfig.js'
import { applyTheme } from './config/themes.js'
import { init as initOfflineManager } from './lib/offlineManager.js'
import './index.css'

// Apply brand theme (CSS variable overrides)
applyTheme(import.meta.env.VITE_BRAND || 'predioclick');

// Inicializar el gestor offline (detecta conexión y auto-sincroniza)
initOfflineManager();

// Update document metadata from brand config
document.title = `${brand.appName} - ${brand.subtitle}`;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute('content', `${brand.appName} - ${brand.description}`);
const metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
if (metaAppleTitle) metaAppleTitle.setAttribute('content', brand.appName);
const faviconLink = document.querySelector('link[rel="icon"]');
if (faviconLink) faviconLink.setAttribute('href', brand.favicon);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <OfflineProvider>
                    <AppProvider>
                        <App />
                    </AppProvider>
                </OfflineProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>,
)

