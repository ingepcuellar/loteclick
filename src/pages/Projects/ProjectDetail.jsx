import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    FiEdit2,
    FiTrash2,
    FiMapPin,
    FiUsers,
    FiGrid,
    FiDollarSign,
    FiArrowLeft,
    FiShoppingCart,
    FiPlus,
    FiX
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { getLotLabel, groupLotsByManzana, groupLotsByHierarchy, getBlockTypeLabel } from '../../lib/lotLabel';
import ConfirmModal from '../../components/ui/ConfirmModal';

function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getProjectById, deleteProject, getSalesByProject, addLot, state } = useApp();
    const { isSeller, isAdmin } = useAuth();

    const project = getProjectById(id);
    const sales = getSalesByProject(id);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [filterStage, setFilterStage] = useState('');
    const [filterBlock, setFilterBlock] = useState('');
    const [searchLot, setSearchLot] = useState('');

    // Add Lot modal state
    const [showAddLotModal, setShowAddLotModal] = useState(false);
    const [addLotForm, setAddLotForm] = useState({ number: '', manzana: '', area: '', price: '' });
    const [addLotError, setAddLotError] = useState('');
    const [addLotLoading, setAddLotLoading] = useState(false);

    const handleAddLot = async (e) => {
        e.preventDefault();
        if (!addLotForm.number.trim()) {
            setAddLotError('El número de lote es requerido');
            return;
        }
        setAddLotLoading(true);
        setAddLotError('');
        try {
            await addLot({
                project_id: id,
                number: addLotForm.number.trim().toUpperCase(),
                manzana: addLotForm.manzana.trim() || null,
                area: addLotForm.area ? parseFloat(addLotForm.area) : null,
                price: addLotForm.price ? parseFloat(addLotForm.price.replace(/[^0-9.]/g, '')) : null,
            });
            setAddLotForm({ number: '', manzana: '', area: '', price: '' });
            setShowAddLotModal(false);
        } catch (err) {
            setAddLotError(err.message || 'Error al crear el lote');
        } finally {
            setAddLotLoading(false);
        }
    };

    if (state.isLoading) {
        return (
            <div className="card">
                <div className="empty-state" style={{ padding: '3rem' }}>
                    <div className="spinner"></div>
                    <h3 style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando datos del proyecto...</h3>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="card">
                <div className="empty-state">
                    <h3>Proyecto no encontrado</h3>
                    <p>El proyecto que buscas no existe o fue eliminado</p>
                    <Link to="/projects" className="btn btn-primary">
                        <FiArrowLeft /> Volver a Proyectos
                    </Link>
                </div>
            </div>
        );
    }


    const handleDelete = () => {
        setShowConfirmDelete(true);
    };

    const executeDelete = () => {
        deleteProject(id);
        navigate('/projects');
    };



    // Stats
    const totalLots = project.lots?.length || 0;
    const soldLots = project.lots?.filter(l => l.status === 'sold' || l.status === 'pending_initial').length || 0;
    const pendingLots = project.lots?.filter(l => l.status === 'pending_initial').length || 0;
    const availableLots = totalLots - soldLots;
    const totalValue = project.lots?.reduce((sum, l) => sum + parseFloat(l.price || 0), 0) || 0;
    const soldValue = sales.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/projects" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>{project.name}</h1>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <FiMapPin />
                        {project.location}
                    </p>
                </div>
                <div className="page-header-actions">
                    {!isSeller() && (
                        <>
                            <Link to={`/projects/${id}/edit`} className="btn btn-secondary">
                                <FiEdit2 /> Editar
                            </Link>
                            {isAdmin() && (
                                <button className="btn btn-danger" onClick={handleDelete}>
                                    <FiTrash2 /> Eliminar
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-4 mb-6">
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <FiGrid />
                        </div>
                        <div className="stat-content">
                            <h3>{totalLots}</h3>
                            <p>Total Lotes</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <FiGrid />
                        </div>
                        <div className="stat-content">
                            <h3>{availableLots}</h3>
                            <p>Disponibles</p>
                        </div>
                    </div>
                </div>
                {!isSeller() && (
                    <>
                        <div className="card">
                            <div className="stat-card">
                                <div className="stat-icon accent">
                                    <FiShoppingCart />
                                </div>
                                <div className="stat-content">
                                    <h3>{soldLots}</h3>
                                    <p>Vendidos</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                    <FiGrid />
                                </div>
                                <div className="stat-content">
                                    <h3>{pendingLots}</h3>
                                    <p>Pend. Cuota Inicial</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card">
                                <div className="stat-icon info">
                                    <FiDollarSign />
                                </div>
                                <div className="stat-content">
                                    <h3>{formatCurrency(soldValue)}</h3>
                                    <p>Vendido</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className={isSeller() ? '' : 'grid grid-2'}>
                {/* Partners - hidden for sellers */}
                {!isSeller() && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiUsers className="card-title-icon" />
                                Socios ({project.partners?.length || 0})
                            </h3>
                        </div>
                        <div className="card-body">
                            {project.partners?.length > 0 ? (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>ParticipaciÃ³n</th>
                                                <th>Documento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {project.partners.map(partner => (
                                                <tr key={partner.id}>
                                                    <td>{partner.name}</td>
                                                    <td>
                                                        <span className="badge badge-success">{partner.percentage}%</span>
                                                    </td>
                                                    <td>{partner.document || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted">No hay socios registrados</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Lots Grid */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title">
                            <FiGrid className="card-title-icon" />
                            Lotes
                        </h3>
                        {!isSeller() && (
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => { setAddLotError(''); setShowAddLotModal(true); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <FiPlus size={14} /> Agregar Lote
                            </button>
                        )}
                    </div>
                <div className="card-body">
                        {/* Filter Bar */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="🔍 Buscar lote..."
                                value={searchLot}
                                onChange={(e) => setSearchLot(e.target.value)}
                                className="form-input"
                                style={{ maxWidth: '180px', padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                            />
                            {project.stages && project.stages.length > 0 && (
                                <>
                                    <select
                                        value={filterStage}
                                        onChange={(e) => { setFilterStage(e.target.value); setFilterBlock(''); }}
                                        className="form-select"
                                        style={{ maxWidth: '180px', padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                                    >
                                        <option value="">Todas las etapas</option>
                                        {project.stages.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={filterBlock}
                                        onChange={(e) => setFilterBlock(e.target.value)}
                                        className="form-select"
                                        style={{ maxWidth: '180px', padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                                    >
                                        <option value="">Todas las manzanas</option>
                                        {(project.blocks || [])
                                            .filter(b => !filterStage || b.stage_id === filterStage)
                                            .map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                    </select>
                                </>
                            )}
                            {(filterStage || filterBlock || searchLot) && (
                                <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStage(''); setFilterBlock(''); setSearchLot(''); }}>
                                    ✕ Limpiar filtros
                                </button>
                            )}
                        </div>

                        {project.stages && project.stages.length > 0 ? (
                            // Render hierarchically (stages -> blocks -> lots)
                            (() => {
                                const hierarchy = groupLotsByHierarchy(project.lots || [], project.blocks || [], project.stages || []);
                                const searchTerm = searchLot.toLowerCase().trim();
                                const allLots = project.lots || [];

                                // Support both field names: DB returns 'etapa_id', JS wizard sends 'stage_id'
                                const getLotStageId = (lot) => lot.etapa_id || lot.stage_id || null;

                                // Build map of stage_id -> direct lots (no block_id)
                                const directLotsByStage = new Map();
                                for (const lot of allLots.filter(l => !l.block_id && getLotStageId(l))) {
                                    const sId = getLotStageId(lot);
                                    if (!directLotsByStage.has(sId)) directLotsByStage.set(sId, []);
                                    directLotsByStage.get(sId).push(lot);
                                }

                                const hasBlockedLots = allLots.some(l => l.block_id);
                                const hasDirectStageLots = allLots.some(l => !l.block_id && getLotStageId(l));

                                // Completely flat (no stage structure at all)
                                if (!hasBlockedLots && !hasDirectStageLots) {
                                    const sorted = [...allLots].sort((a, b) => parseInt(a.number) - parseInt(b.number));
                                    const visible = searchTerm ? sorted.filter(l => String(l.number).toLowerCase().includes(searchTerm)) : sorted;
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 'var(--spacing-2)' }}>
                                            {visible.map(lot => {
                                                const sale = (lot.status === 'sold' || lot.status === 'pending_initial') ? sales.find(s => s.lotId === lot.id) : null;
                                                const client = sale ? state.clients.find(c => c.id === sale.clientId) : null;
                                                const getLotStyle = () => {
                                                    if (lot.status === 'sold') return { bg: 'linear-gradient(135deg, rgba(16,185,129,0.3),rgba(16,185,129,0.1))', border: 'var(--color-success)', textColor: 'var(--color-success)', label: 'Vendido' };
                                                    if (lot.status === 'pending_initial') return { bg: 'linear-gradient(135deg, rgba(245,158,11,0.3),rgba(245,158,11,0.1))', border: '#f59e0b', textColor: '#f59e0b', label: 'Pend. Cuota' };
                                                    return { bg: 'var(--bg-tertiary)', border: 'var(--border-color)', textColor: 'var(--text-muted)', label: `${lot.area || '?'} m²` };
                                                };
                                                const st = getLotStyle();
                                                return (
                                                    <div key={lot.id}
                                                        title={lot.status === 'sold' ? `Vendido a: ${client?.name || 'Cliente'}` : lot.status === 'pending_initial' ? `Pendiente: ${client?.name || 'Cliente'}` : `Disponible - ${formatCurrency(lot.price)}`}
                                                        onClick={() => { if (lot.status === 'available' || !lot.status) navigate(`/sales/new?projectId=${project.id}&lotId=${lot.id}`); else if (sale) navigate(`/sales/${sale.id}`); }}
                                                        style={{ padding: 'var(--spacing-3)', background: st.bg, border: `2px solid ${st.border}`, borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', transition: 'all var(--transition-base)' }}>
                                                        <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{lot.number}</div>
                                                        <div style={{ fontSize: 'var(--font-size-xs)', color: st.textColor }}>{st.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                // Shared lot card renderer
                                const renderLotCard = (lot) => {
                                    const sale = (lot.status === 'sold' || lot.status === 'pending_initial') ? sales.find(s => s.lotId === lot.id) : null;
                                    const client = sale ? state.clients.find(c => c.id === sale.clientId) : null;
                                    const getLotStyle = () => {
                                        if (lot.status === 'sold') return { bg: 'linear-gradient(135deg, rgba(16,185,129,0.3),rgba(16,185,129,0.1))', border: 'var(--color-success)', textColor: 'var(--color-success)', label: 'Vendido' };
                                        if (lot.status === 'pending_initial') return { bg: 'linear-gradient(135deg, rgba(245,158,11,0.3),rgba(245,158,11,0.1))', border: '#f59e0b', textColor: '#f59e0b', label: 'Pend. Cuota' };
                                        return { bg: 'var(--bg-tertiary)', border: 'var(--border-color)', textColor: 'var(--text-muted)', label: `${lot.area || '?'} m²` };
                                    };
                                    const st = getLotStyle();
                                    return (
                                        <div key={lot.id}
                                            title={lot.status === 'sold' ? `Vendido a: ${client?.name || client?.fullName || 'Cliente'}` : lot.status === 'pending_initial' ? `Pendiente cuota inicial: ${client?.name || client?.fullName || 'Cliente'}` : `Disponible - ${formatCurrency(lot.price)}`}
                                            onClick={() => { if (lot.status === 'available' || !lot.status) navigate(`/sales/new?projectId=${project.id}&lotId=${lot.id}`); else if (sale) { if (lot.status === 'sold') alert('Este lote ya ha sido vendido.'); navigate(`/sales/${sale.id}`); } }}
                                            style={{ padding: 'var(--spacing-3)', background: st.bg, border: `2px solid ${st.border}`, borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', transition: 'all var(--transition-base)' }}>
                                            <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{lot.number}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: st.textColor }}>{st.label}</div>
                                        </div>
                                    );
                                };

                                // Per-stage rendering: handles mixed (blocks + direct lots per stage)
                                return project.stages
                                    .filter(stage => !filterStage || stage.id === filterStage)
                                    .map(stage => {
                                        const stageEntry = hierarchy.get(stage.id);
                                        const blockEntries = stageEntry
                                            ? Array.from(stageEntry.blockMap.values()).filter(e => e.lots.length > 0)
                                            : [];
                                        const directLots = directLotsByStage.get(stage.id) || [];
                                        const filteredDirect = [...directLots]
                                            .sort((a, b) => parseInt(a.number) - parseInt(b.number))
                                            .filter(l => !searchTerm || String(l.number).toLowerCase().includes(searchTerm));

                                        if (blockEntries.length === 0 && filteredDirect.length === 0) return null;

                                        return (
                                            <div key={stage.id} style={{ marginBottom: 'var(--spacing-8)' }}>
                                                <h4 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                                                    {stage.name}
                                                </h4>
                                                {/* Block (manzana) lots */}
                                                {blockEntries
                                                    .filter(({ block }) => !filterBlock || block.id === filterBlock)
                                                    .map(({ block, lots: blockLots }) => {
                                                        const sorted = [...blockLots].sort((a, b) => parseInt(a.number) - parseInt(b.number));
                                                        const visible = searchTerm ? sorted.filter(l => String(l.number).toLowerCase().includes(searchTerm)) : sorted;
                                                        if (visible.length === 0) return null;
                                                        return (
                                                            <div key={block.id} style={{ marginBottom: 'var(--spacing-6)', paddingLeft: 'var(--spacing-4)' }}>
                                                                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-400)', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                                    <FiGrid size={13} />
                                                                    Manzana {block.name}
                                                                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({visible.length} lotes)</span>
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 'var(--spacing-2)' }}>
                                                                    {visible.map(lot => renderLotCard(lot))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                {/* Direct lots (no manzana) within this stage */}
                                                {filteredDirect.length > 0 && (
                                                    <div style={{ paddingLeft: blockEntries.length > 0 ? 'var(--spacing-4)' : '0' }}>
                                                        {blockEntries.length > 0 && (
                                                            <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-400)', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                                <FiGrid size={13} />
                                                                Sin Manzana
                                                                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({filteredDirect.length} lotes)</span>
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 'var(--spacing-2)' }}>
                                                            {filteredDirect.map(lot => renderLotCard(lot))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                            })()
                        ) : project.block_type ? (
                            // Lotes agrupados por manzana/etapa
                            (() => {
                                const grouped = groupLotsByManzana(project.lots || []);
                                const blockLabel = getBlockTypeLabel(project.block_type);
                                return Array.from(grouped.entries()).map(([manzana, lots]) => (
                                    <div key={manzana ?? '__none__'} style={{ marginBottom: 'var(--spacing-6)' }}>
                                        <div style={{
                                            fontWeight: '600',
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--color-primary-400)',
                                            marginBottom: 'var(--spacing-3)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-2)'
                                        }}>
                                            <FiGrid size={13} />
                                            {manzana ? `${blockLabel} ${manzana}` : 'Sin agrupaciÃ³n'}
                                            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({lots.length} lotes)</span>
                                        </div>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                            gap: 'var(--spacing-2)'
                                        }}>
                                            {[...lots].sort((a, b) => parseInt(a.number) - parseInt(b.number)).map(lot => {
                                                const sale = (lot.status === 'sold' || lot.status === 'pending_initial') ? sales.find(s => s.lotId === lot.id) : null;
                                                const client = sale ? state.clients.find(c => c.id === sale.clientId) : null;
                                                const getLotStyle = () => {
                                                    if (lot.status === 'sold') return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))', border: 'var(--color-success)', textColor: 'var(--color-success)', label: 'Vendido' };
                                                    if (lot.status === 'pending_initial') return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.1))', border: '#f59e0b', textColor: '#f59e0b', label: 'Pend. Cuota' };
                                                    return { bg: 'var(--bg-tertiary)', border: 'var(--border-color)', textColor: 'var(--text-muted)', label: `${lot.area || '?'} mÂ²` };
                                                };
                                                const style = getLotStyle();
                                                return (
                                                    <div
                                                        key={lot.id}
                                                        title={lot.status === 'sold' ? `Vendido a: ${client?.name || 'Cliente'}` : lot.status === 'pending_initial' ? `Pendiente cuota inicial: ${client?.name || 'Cliente'}` : `Disponible - ${formatCurrency(lot.price)}`}
                                                        onClick={() => {
                                                            if (lot.status === 'available' || !lot.status) navigate(`/sales/new?projectId=${project.id}&lotId=${lot.id}`);
                                                            else if (sale) navigate(`/sales/${sale.id}`);
                                                        }}
                                                        style={{ padding: 'var(--spacing-3)', background: style.bg, border: `2px solid ${style.border}`, borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', transition: 'all var(--transition-base)' }}
                                                    >
                                                        <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{lot.number}</div>
                                                        <div style={{ fontSize: 'var(--font-size-xs)', color: style.textColor }}>{style.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()
                        ) : (
                            // Lotes sin agrupaciÃ³n (comportamiento original)
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                gap: 'var(--spacing-2)'
                            }}>
                            {[...(project.lots || [])].sort((a, b) => parseInt(a.number) - parseInt(b.number)).map(lot => {
                                const sale = (lot.status === 'sold' || lot.status === 'pending_initial') ? sales.find(s => s.lotId === lot.id) : null;
                                const client = sale ? state.clients.find(c => c.id === sale.clientId) : null;

                                const getLotStyle = () => {
                                    if (lot.status === 'sold') return {
                                        bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))',
                                        border: 'var(--color-success)',
                                        textColor: 'var(--color-success)',
                                        label: 'Vendido'
                                    };
                                    if (lot.status === 'pending_initial') return {
                                        bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.1))',
                                        border: '#f59e0b',
                                        textColor: '#f59e0b',
                                        label: 'Pend. Cuota'
                                    };
                                    return {
                                        bg: 'var(--bg-tertiary)',
                                        border: 'var(--border-color)',
                                        textColor: 'var(--text-muted)',
                                        label: `${lot.area || '?'} mÂ²`
                                    };
                                };
                                const style = getLotStyle();

                                return (
                                    <div
                                        key={lot.id}
                                        title={lot.status === 'sold' ? `Vendido a: ${client?.name || client?.fullName || 'Cliente'}` : lot.status === 'pending_initial' ? `Pendiente cuota inicial: ${client?.name || client?.fullName || 'Cliente'}` : `Disponible - ${formatCurrency(lot.price)} - Click para vender`}
                                        onClick={() => {
                                            if (lot.status === 'available' || !lot.status) {
                                                navigate(`/sales/new?projectId=${project.id}&lotId=${lot.id}`);
                                            } else if (sale) {
                                                navigate(`/sales/${sale.id}`);
                                            }
                                        }}
                                        style={{
                                            padding: 'var(--spacing-3)',
                                            background: style.bg,
                                            border: `2px solid ${style.border}`,
                                            borderRadius: 'var(--radius-lg)',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-base)'
                                        }}
                                    >
                                        <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>
                                            {lot.number}
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: style.textColor
                                        }}>
                                            {style.label}
                                        </div>
                                    </div>
                                );
                            })}
                            </div>
                        )}

                        {/* Legend */}
                        <div className="flex gap-4 mt-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    background: 'var(--bg-tertiary)',
                                    border: '2px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Disponible</span>
                            </div>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    background: 'rgba(245, 158, 11, 0.3)',
                                    border: '2px solid #f59e0b',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Pend. Cuota Inicial</span>
                            </div>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    background: 'rgba(16, 185, 129, 0.3)',
                                    border: '2px solid var(--color-success)',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Vendido</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Sales */}
            {sales.length > 0 && (
                <div className="card mt-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiShoppingCart className="card-title-icon" />
                            Ventas del Proyecto
                        </h3>
                        <Link to="/sales" className="btn btn-ghost btn-sm">Ver todas</Link>
                    </div>
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Lote</th>
                                        <th>Cliente</th>
                                        <th>Precio</th>
                                        <th>Fecha</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.map(sale => {
                                        const client = state.clients.find(c => c.id === sale.clientId);
                                        return (
                                            <tr key={sale.id}>
                                                <td>{getLotLabel({ number: sale.lotNumber, manzana: sale.lotManzana }, project)}</td>
                                                <td>{client?.name || client?.fullName || '-'}</td>
                                                <td>{formatCurrency(sale.totalPrice)}</td>
                                                <td>{formatDate(sale.createdAt)}</td>
                                                <td>
                                                    <Link to={`/sales/${sale.id}`} className="btn btn-ghost btn-sm">
                                                        Ver detalle
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmDelete}
                title={`¿Eliminar proyecto "${project.name}"?`}
                message="Esta acción no se puede deshacer."
                confirmText="Eliminar"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setShowConfirmDelete(false)}
            />

            {/* Add Lot Modal */}
            {showAddLotModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 'var(--spacing-4)'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '440px', margin: 0 }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title" style={{ margin: 0 }}>
                                <FiPlus className="card-title-icon" /> Agregar Lote
                            </h3>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowAddLotModal(false)}
                                style={{ padding: '4px' }}
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="card-body">
                            <form onSubmit={handleAddLot}>
                                <div className="form-group">
                                    <label className="form-label">Número de Lote *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej: E1-16, 25, A-5..."
                                        value={addLotForm.number}
                                        onChange={e => setAddLotForm(f => ({ ...f, number: e.target.value }))}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Manzana / Bloque <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej: A, B, Manzana 1..."
                                        value={addLotForm.manzana}
                                        onChange={e => setAddLotForm(f => ({ ...f, manzana: e.target.value }))}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Área (m²)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="150"
                                            min="0"
                                            step="0.01"
                                            value={addLotForm.area}
                                            onChange={e => setAddLotForm(f => ({ ...f, area: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Precio ($)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="5000000"
                                            min="0"
                                            step="1000"
                                            value={addLotForm.price}
                                            onChange={e => setAddLotForm(f => ({ ...f, price: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {addLotError && (
                                    <div style={{
                                        background: 'var(--color-error-bg, #fee2e2)',
                                        color: 'var(--color-error, #dc2626)',
                                        padding: 'var(--spacing-3)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        marginBottom: 'var(--spacing-3)'
                                    }}>
                                        ⚠️ {addLotError}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowAddLotModal(false)}
                                        disabled={addLotLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={addLotLoading}
                                    >
                                        {addLotLoading ? 'Guardando...' : '✓ Agregar Lote'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default ProjectDetail;
