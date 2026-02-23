import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFolder, FiUsers, FiShoppingCart, FiCommand } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    const navigate = useNavigate();
    const { state } = useApp();

    // Listen for Ctrl+K / Cmd+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Autofocus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Search logic
    const getResults = useCallback(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        const results = [];

        // Search projects
        state.projects.forEach(project => {
            if (
                project.name?.toLowerCase().includes(q) ||
                project.location?.toLowerCase().includes(q)
            ) {
                results.push({
                    type: 'project',
                    icon: FiFolder,
                    label: project.name,
                    sublabel: project.location || '',
                    path: `/projects/${project.id}`
                });
            }
        });

        // Search clients
        state.clients.forEach(client => {
            const name = client.name || client.fullName || '';
            if (
                name.toLowerCase().includes(q) ||
                client.document?.toLowerCase().includes(q) ||
                client.email?.toLowerCase().includes(q) ||
                client.phone?.includes(q)
            ) {
                results.push({
                    type: 'client',
                    icon: FiUsers,
                    label: name,
                    sublabel: client.document || client.email || '',
                    path: `/clients/${client.id}`
                });
            }
        });

        // Search sales (by lot, client name, project name)
        state.sales.forEach(sale => {
            const client = state.clients.find(c => c.id === sale.clientId);
            const project = state.projects.find(p => p.id === sale.projectId);
            const clientName = client?.name || client?.fullName || '';
            const projectName = project?.name || '';
            const lotLabel = `Lote ${sale.lotNumber || ''}`;

            if (
                clientName.toLowerCase().includes(q) ||
                projectName.toLowerCase().includes(q) ||
                lotLabel.toLowerCase().includes(q)
            ) {
                results.push({
                    type: 'sale',
                    icon: FiShoppingCart,
                    label: `${clientName} — ${lotLabel}`,
                    sublabel: projectName,
                    path: `/sales/${sale.id}`
                });
            }
        });

        return results.slice(0, 10);
    }, [query, state]);

    const results = getResults();

    const handleSelect = (path) => {
        setIsOpen(false);
        navigate(path);
    };

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
            <div className="command-palette" onClick={(e) => e.stopPropagation()}>
                <div className="command-palette-input-wrapper">
                    <FiSearch className="command-palette-search-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder="Buscar proyectos, clientes, ventas..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <kbd className="command-palette-kbd">ESC</kbd>
                </div>

                {query.trim() && (
                    <div className="command-palette-results">
                        {results.length === 0 ? (
                            <div className="command-palette-empty">
                                No se encontraron resultados para "{query}"
                            </div>
                        ) : (
                            results.map((result, i) => (
                                <button
                                    key={`${result.type}-${result.path}-${i}`}
                                    className="command-palette-item"
                                    onClick={() => handleSelect(result.path)}
                                >
                                    <result.icon className="command-palette-item-icon" />
                                    <div className="command-palette-item-content">
                                        <span className="command-palette-item-label">{result.label}</span>
                                        {result.sublabel && (
                                            <span className="command-palette-item-sublabel">{result.sublabel}</span>
                                        )}
                                    </div>
                                    <span className={`command-palette-item-type type-${result.type}`}>
                                        {result.type === 'project' ? 'Proyecto' :
                                            result.type === 'client' ? 'Cliente' : 'Venta'}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {!query.trim() && (
                    <div className="command-palette-hints">
                        <div className="command-palette-hint">
                            <FiFolder /> Escribe para buscar proyectos
                        </div>
                        <div className="command-palette-hint">
                            <FiUsers /> Buscar clientes por nombre, cédula o email
                        </div>
                        <div className="command-palette-hint">
                            <FiShoppingCart /> Buscar ventas por cliente o lote
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CommandPalette;
