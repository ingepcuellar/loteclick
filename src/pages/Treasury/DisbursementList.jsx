import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FiPlus,
    FiDollarSign,
    FiSearch,
    FiFilter,
    FiCalendar,
    FiUser,
    FiFolder,
    FiTrash2,
    FiEye,
    FiImage,
    FiDownload,
    FiCheck,
    FiClock
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { disbursementService } from '../../services/disbursementService';
import { formatCurrency, formatDate } from '../../lib/formatters';
import ConfirmModal from '../../components/ui/ConfirmModal';

function DisbursementList() {
    const navigate = useNavigate();
    const { state } = useApp();
    const { currentUser, isPartner, isAdmin } = useAuth();
    const projects = state.projects || [];
    const [disbursements, setDisbursements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterPartner, setFilterPartner] = useState(''); // Ítem 18
    const [filterMonth, setFilterMonth] = useState('');   // Ítem 18 (YYYY-MM)
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedImageTitle, setSelectedImageTitle] = useState('');

    useEffect(() => {
        loadDisbursements();
    }, []);

    const loadDisbursements = async () => {
        setLoading(true);
        const { data, error } = await disbursementService.getAll();
        if (!error && data) {
            setDisbursements(data);
        }
        setLoading(false);
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDelete = (id) => {
        setConfirmDeleteId(id);
    };

    const executeDelete = async () => {
        const { error } = await disbursementService.delete(confirmDeleteId);
        if (!error) {
            setDisbursements(prev => prev.filter(d => d.id !== confirmDeleteId));
        }
        setConfirmDeleteId(null);
    };

    const openImageModal = (imageUrl, title) => {
        setSelectedImage(imageUrl);
        setSelectedImageTitle(title || 'Comprobante');
        setShowImageModal(true);
    };

    // Ítem 1: Socio acepta entrega
    const handleAccept = async (id) => {
        const { data, error } = await disbursementService.accept(id);
        if (!error && data) {
            setDisbursements(prev => prev.map(d => d.id === id ? { ...d, status: 'accepted' } : d));
        } else {
            alert(error || 'No se pudo aceptar la entrega');
        }
    };

    const filteredDisbursements = disbursements.filter(d => {
        const matchesSearch = !searchTerm ||
            (d.partner?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = !filterProject || d.project_id === filterProject;
        // Ítem 18: filtros adicionales
        const matchesPartner = !filterPartner || d.partner_id === filterPartner;
        const matchesMonth = !filterMonth || (d.disbursement_date || '').startsWith(filterMonth);
        return matchesSearch && matchesProject && matchesPartner && matchesMonth;
    });

    const totalDisbursed = filteredDisbursements.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Cargando entregas...</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1><FiDollarSign /> Entregas a Socios</h1>
                    <p className="page-subtitle">Registre entregas de dinero a los socios del proyecto</p>
                </div>
                <Link to="/disbursements/new" className="btn btn-primary">
                    <FiPlus /> Nueva Entrega
                </Link>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="stat-value">{filteredDisbursements.length}</div>
                    <div className="stat-label">Total Entregas</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{formatCurrency(totalDisbursed)}</div>
                    <div className="stat-label">Total Desembolsado</div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por socio o notas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-control"
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
                <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="form-control"
                    style={{ maxWidth: '200px' }}
                >
                    <option value="">Todos los proyectos</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                {/* Ítem 18: filtro por socio */}
                <select
                    value={filterPartner}
                    onChange={(e) => setFilterPartner(e.target.value)}
                    className="form-control"
                    style={{ maxWidth: '200px' }}
                >
                    <option value="">Todos los socios</option>
                    {[...new Map(disbursements
                        .filter(d => d.partner_id && d.partner?.name)
                        .map(d => [d.partner_id, d.partner?.name])
                    ).entries()].map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                    ))}
                </select>
                {/* Ítem 18: filtro por mes */}
                <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="form-control"
                    style={{ maxWidth: '160px' }}
                    title="Filtrar por mes"
                />
                {(filterProject || filterPartner || filterMonth || searchTerm) && (
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setFilterProject(''); setFilterPartner(''); setFilterMonth(''); setSearchTerm(''); }}
                    >Limpiar</button>
                )}
            </div>

            {/* Table */}
            {filteredDisbursements.length === 0 ? (
                <div className="empty-state">
                    <FiDollarSign size={48} />
                    <h3>No hay entregas registradas</h3>
                    <p>Registre la primera entrega de dinero a un socio</p>
                    <Link to="/disbursements/new" className="btn btn-primary">
                        <FiPlus /> Nueva Entrega
                    </Link>
                </div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Socio</th>
                                    <th>Proyecto</th>
                                    <th>Monto</th>
                                    <th>Modalidad</th>
                                    <th>Estado</th>
                                    <th>Comprobante</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDisbursements.map(d => (
                                    <tr key={d.id}>
                                        <td>
                                            <FiCalendar style={{ marginRight: '0.5rem' }} />
                                            {formatDate(d.disbursement_date)}
                                        </td>
                                        <td>
                                            <FiUser style={{ marginRight: '0.5rem' }} />
                                            {d.partner?.name || 'N/A'}
                                        </td>
                                        <td>
                                            <FiFolder style={{ marginRight: '0.5rem' }} />
                                            {d.project?.name || 'N/A'}
                                        </td>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                            {formatCurrency(d.amount)}
                                        </td>
                                        <td>
                                            {(() => {
                                                const m = d.payment_method || 'cash';
                                                if (m === 'transfer') return <span className="badge badge-info">🏦 Transferencia</span>;
                                                if (m === 'check')    return <span className="badge badge-warning">📋 Cheque</span>;
                                                return <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>💵 Efectivo</span>;
                                            })()}
                                        </td>
                                        <td>
                                            {(d.status === 'accepted') ? (
                                                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <FiCheck size={11} /> Aceptado
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <FiClock size={11} /> Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {(d.receipt_image || d.signature_image) ? (
                                                <span className="badge badge-success">
                                                    <FiImage /> Sí
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning">Sin comprobante</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {/* Ítem 1: Botón Aceptar solo para el socio receptor */}
                                                {!isAdmin() && isPartner() && (d.status || 'pending') !== 'accepted' && (
                                                    <button
                                                        onClick={() => handleAccept(d.id)}
                                                        className="btn btn-sm btn-success"
                                                        title="Aceptar esta entrega"
                                                    >
                                                        <FiCheck /> Aceptar
                                                    </button>
                                                )}
                                                {d.receipt_image && (
                                                    <button onClick={() => openImageModal(d.receipt_image, `Recibo - ${d.partner?.name}`)} className="btn btn-sm btn-outline">
                                                        <FiEye /> Recibo
                                                    </button>
                                                )}
                                                {d.signature_image && (
                                                    <button onClick={() => openImageModal(d.signature_image, `Firma - ${d.partner?.name}`)} className="btn btn-sm btn-outline">
                                                        <FiEye /> Firma
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(d.id)} className="btn btn-sm btn-danger">
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="mobile-card-list">
                        {filteredDisbursements.map(d => (
                            <div key={d.id} className="mobile-card-item">
                                <div className="mobile-card-header">
                                    <div className="mobile-card-main">
                                        <div className="mobile-card-avatar">
                                            {(d.partner?.name)?.charAt(0).toUpperCase() || 'S'}
                                        </div>
                                        <div>
                                            <div className="mobile-card-title">{d.partner?.name || 'N/A'}</div>
                                            <div className="mobile-card-subtitle">{d.project?.name || 'N/A'}</div>
                                        </div>
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'var(--color-primary-400)' }}>
                                        {formatCurrency(d.amount)}
                                    </span>
                                </div>
                                <div className="mobile-card-body">
                                    <div className="mobile-card-row">
                                        <span className="mobile-card-label">Fecha</span>
                                        <span className="mobile-card-value">{formatDate(d.disbursement_date)}</span>
                                    </div>
                                    <div className="mobile-card-row">
                                        <span className="mobile-card-label">Comprobante</span>
                                        <span className="mobile-card-value">
                                            {(d.receipt_image || d.signature_image) ? (
                                                <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    <FiImage /> Sí
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning" style={{ fontSize: 'var(--font-size-xs)' }}>Sin comprobante</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--spacing-3)' }}>
                                    {d.receipt_image && (
                                        <button onClick={() => openImageModal(d.receipt_image, `Recibo - ${d.partner?.name}`)} className="btn btn-sm btn-outline" style={{ flex: 1 }}>
                                            <FiEye /> Recibo
                                        </button>
                                    )}
                                    {d.signature_image && (
                                        <button onClick={() => openImageModal(d.signature_image, `Firma - ${d.partner?.name}`)} className="btn btn-sm btn-outline" style={{ flex: 1 }}>
                                            <FiEye /> Firma
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(d.id)} className="btn btn-sm btn-danger" style={{ flex: 1 }}>
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {/* Image Modal */}
            {showImageModal && selectedImage && (
                <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
                    <div
                        className="modal modal-lg"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <FiImage style={{ marginRight: '8px' }} />
                                {selectedImageTitle}
                            </h3>
                            <button className="modal-close" onClick={() => setShowImageModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            background: 'var(--bg-tertiary)',
                            padding: 'var(--spacing-4)',
                            maxHeight: '70vh',
                            overflow: 'auto'
                        }}>
                            <img
                                src={selectedImage}
                                alt={selectedImageTitle}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: 'var(--radius-lg)',
                                    boxShadow: 'var(--shadow-lg)'
                                }}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowImageModal(false)}>
                                Cerrar
                            </button>
                            <a
                                href={selectedImage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                <FiDownload /> Abrir en nueva pestaña
                            </a>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmDeleteId}
                title="¿Eliminar esta entrega?"
                message="Esta acción no se puede deshacer."
                confirmText="Eliminar"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}

export default DisbursementList;
