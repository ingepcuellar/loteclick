import { Link } from 'react-router-dom';
import { FiPlus, FiFolder, FiMapPin, FiUsers, FiGrid, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

function ProjectList() {
    const { state, deleteProject } = useApp();
    const { isSeller, isAdmin } = useAuth();

    const handleDelete = (projectId, projectName) => {
        if (window.confirm(`¿Estás seguro de eliminar el proyecto "${projectName}"? Esto también eliminará todas las ventas asociadas.`)) {
            deleteProject(projectId);
        }
    };

    const getProjectStats = (project) => {
        const totalLots = project.lots?.length || 0;
        const soldLots = project.lots?.filter(l => l.status === 'sold').length || 0;
        const availableLots = totalLots - soldLots;
        const progress = totalLots > 0 ? (soldLots / totalLots) * 100 : 0;

        return { totalLots, soldLots, availableLots, progress };
    };

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Proyectos</h1>
                    <p>Gestiona tus proyectos de venta de lotes</p>
                </div>
                <div className="page-header-actions">
                    <Link to="/projects/new" className="btn btn-primary">
                        <FiPlus />
                        Nuevo Proyecto
                    </Link>
                </div>
            </div>

            {/* Projects Grid */}
            {state.projects.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiFolder />
                        </div>
                        <h3>No hay proyectos</h3>
                        <p>Crea tu primer proyecto para comenzar a gestionar la venta de lotes</p>
                        <Link to="/projects/new" className="btn btn-primary">
                            <FiPlus />
                            Crear Proyecto
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-3">
                    {state.projects.map(project => {
                        const stats = getProjectStats(project);

                        return (
                            <div key={project.id} className="card" style={{ overflow: 'hidden' }}>
                                {/* Project Header */}
                                <div style={{
                                    background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-accent-600))',
                                    padding: 'var(--spacing-6)',
                                    margin: 'calc(-1 * var(--spacing-6))',
                                    marginBottom: 'var(--spacing-4)'
                                }}>
                                    <h3 style={{ color: 'white', marginBottom: 'var(--spacing-1)' }}>
                                        {project.name}
                                    </h3>
                                    <p style={{
                                        color: 'rgba(255,255,255,0.8)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-1)',
                                        margin: 0,
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        <FiMapPin size={14} />
                                        {project.location}
                                    </p>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-3" style={{ gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-2xl)',
                                            fontWeight: '700',
                                            color: 'var(--color-primary-400)'
                                        }}>
                                            {stats.totalLots}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                            Total
                                        </div>
                                    </div>
                                    {!isSeller() && (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                fontSize: 'var(--font-size-2xl)',
                                                fontWeight: '700',
                                                color: 'var(--color-success)'
                                            }}>
                                                {stats.soldLots}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                                Vendidos
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-2xl)',
                                            fontWeight: '700',
                                            color: 'var(--color-warning)'
                                        }}>
                                            {stats.availableLots}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                            Disponibles
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Bar - hidden for sellers */}
                                {!isSeller() && (
                                    <div style={{ marginTop: 'var(--spacing-4)' }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 'var(--spacing-1)',
                                            fontSize: 'var(--font-size-sm)'
                                        }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Progreso de ventas</span>
                                            <span style={{ color: 'var(--text-primary)' }}>{Math.round(stats.progress)}%</span>
                                        </div>
                                        <div style={{
                                            height: '8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-full)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${stats.progress}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-accent-500))',
                                                borderRadius: 'var(--radius-full)',
                                                transition: 'width var(--transition-slow)'
                                            }} />
                                        </div>
                                    </div>
                                )}

                                {/* Partners Count - hidden for sellers */}
                                {!isSeller() && (
                                    <div style={{
                                        marginTop: 'var(--spacing-4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-2)',
                                        color: 'var(--text-muted)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        <FiUsers size={14} />
                                        {project.partners?.length || 0} socios
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="card-footer" style={{ marginTop: 'var(--spacing-4)' }}>
                                    <Link
                                        to={`/projects/${project.id}`}
                                        className="btn btn-secondary btn-sm"
                                    >
                                        <FiEye /> Ver
                                    </Link>
                                    {!isSeller() && (
                                        <Link
                                            to={`/projects/${project.id}/edit`}
                                            className="btn btn-ghost btn-sm"
                                        >
                                            <FiEdit2 /> Editar
                                        </Link>
                                    )}
                                    {isAdmin() && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(project.id, project.name)}
                                            style={{ color: 'var(--color-error)' }}
                                        >
                                            <FiTrash2 />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ProjectList;
