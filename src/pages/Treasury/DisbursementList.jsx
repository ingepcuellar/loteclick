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
    FiImage
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { disbursementService } from '../../services/disbursementService';

function DisbursementList() {
    const navigate = useNavigate();
    const { state } = useApp();
    const projects = state.projects || [];
    const [disbursements, setDisbursements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');

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

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta entrega?')) return;
        const { error } = await disbursementService.delete(id);
        if (!error) {
            setDisbursements(prev => prev.filter(d => d.id !== id));
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
    };

    const filteredDisbursements = disbursements.filter(d => {
        const matchesSearch = !searchTerm ||
            (d.partner?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = !filterProject || d.project_id === filterProject;
        return matchesSearch && matchesProject;
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
                    style={{ maxWidth: '250px' }}
                >
                    <option value="">Todos los proyectos</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
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
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Socio</th>
                                <th>Proyecto</th>
                                <th>Monto</th>
                                <th>Comprobante</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDisbursements.map(d => (
                                <tr key={d.id}>
                                    <td>
                                        <FiCalendar style={{ marginRight: '0.5rem' }} />
                                        {new Date(d.disbursement_date).toLocaleDateString('es-CO')}
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
                                            {(d.receipt_image || d.signature_image) && (
                                                <a href={d.receipt_image || d.signature_image} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                                                    <FiEye />
                                                </a>
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
            )}
        </div>
    );
}

export default DisbursementList;
