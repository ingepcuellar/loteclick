import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../ui/CommandPalette';

function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Header */}
            <Header onMenuClick={() => setSidebarOpen(true)} />

            {/* Main Content */}
            <main className="main-content">
                {children}
            </main>

            {/* Global Search */}
            <CommandPalette />
        </div>
    );
}

export default Layout;
