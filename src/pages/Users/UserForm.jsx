import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    FiSave,
    FiX,
    FiUser,
    FiMail,
    FiLock,
    FiShield,
    FiFolder,
    FiArrowLeft,
    FiEye,
    FiEyeOff
} from 'react-icons/fi';
import { useAuth, ROLES, ROLE_LABELS } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

function UserForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { registerUser, updateUser, getUserById, isAdmin } = useAuth();
    const { state } = useApp();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: ROLES.SELLER,
        isActive: true,
        associatedProjects: []
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [apiError, setApiError] = useState('');

    // Redirect if not admin
    useEffect(() => {
        if (!isAdmin()) {
            navigate('/');
        }
    }, [isAdmin, navigate]);

    // Load existing user if editing
    useEffect(() => {
        if (isEditing) {
            const user = getUserById(id);
            if (user) {
                setFormData({
                    name: user.name || '',
                    email: user.email || '',
                    password: '',
                    confirmPassword: '',
                    role: user.role || ROLES.SELLER,
                    isActive: user.isActive !== false,
                    associatedProjects: user.associatedProjects || []
                });
            } else {
                navigate('/users');
            }
        }
    }, [id, isEditing, getUserById, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        setApiError('');
    };

    const handleProjectToggle = (projectId) => {
        setFormData(prev => ({
            ...prev,
            associatedProjects: prev.associatedProjects.includes(projectId)
                ? prev.associatedProjects.filter(id => id !== projectId)
                : [...prev.associatedProjects, projectId]
        }));
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'El nombre es requerido';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'El correo es requerido';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Ingresa un correo válido';
        }

        if (!isEditing) {
            if (!formData.password) {
                newErrors.password = 'La contraseña es requerida';
            } else if (formData.password.length < 6) {
                newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
            }

            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Las contraseñas no coinciden';
            }
        } else if (formData.password && formData.password.length > 0) {
            if (formData.password.length < 6) {
                newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
            }
            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Las contraseñas no coinciden';
            }
        }

        if (!formData.role) {
            newErrors.role = 'Selecciona un rol';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setSubmitting(true);
        setApiError('');

        try {
            const userData = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                isActive: formData.isActive,
                associatedProjects: formData.role === ROLES.PARTNER ? formData.associatedProjects : []
            };

            // Only include password if provided
            if (formData.password) {
                userData.password = formData.password;
            }

            let result;

            if (isEditing) {
                const existingUser = getUserById(id);
                result = await updateUser({
                    ...existingUser,
                    ...userData
                });
            } else {
                result = await registerUser(userData);
            }

            if (result.success) {
                navigate('/users');
            } else {
                setApiError(result.error);
            }
        } catch (error) {
            console.error('Error saving user:', error);
            setApiError('Error al guardar el usuario');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/users" className="btn btn-secondary btn-sm" style={{ marginBottom: '0.5rem' }}>
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</h1>
                    <p>{isEditing ? 'Modifica la información del usuario' : 'Registra un nuevo usuario en el sistema'}</p>
                </div>
            </div>

            {apiError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    {apiError}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div className="card">
                    <div className="card-header">
                        <h3><FiUser /> Información Básica</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiUser style={{ marginRight: '0.5rem' }} />
                                    Nombre Completo *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    className={`form-control ${errors.name ? 'error' : ''}`}
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Nombre del usuario"
                                />
                                {errors.name && <span className="form-error">{errors.name}</span>}
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiMail style={{ marginRight: '0.5rem' }} />
                                    Correo Electrónico *
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    className={`form-control ${errors.email ? 'error' : ''}`}
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="correo@ejemplo.com"
                                />
                                {errors.email && <span className="form-error">{errors.email}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiLock style={{ marginRight: '0.5rem' }} />
                                    Contraseña {!isEditing && '*'}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        className={`form-control ${errors.password ? 'error' : ''}`}
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder={isEditing ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                                        style={{ paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        {showPassword ? <FiEyeOff /> : <FiEye />}
                                    </button>
                                </div>
                                {errors.password && <span className="form-error">{errors.password}</span>}
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiLock style={{ marginRight: '0.5rem' }} />
                                    Confirmar Contraseña {!isEditing && '*'}
                                </label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    className={`form-control ${errors.confirmPassword ? 'error' : ''}`}
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Repite la contraseña"
                                />
                                {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Role and Permissions */}
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header">
                        <h3><FiShield /> Rol y Permisos</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiShield style={{ marginRight: '0.5rem' }} />
                                    Rol del Usuario *
                                </label>
                                <select
                                    name="role"
                                    className={`form-control ${errors.role ? 'error' : ''}`}
                                    value={formData.role}
                                    onChange={handleChange}
                                >
                                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                                {errors.role && <span className="form-error">{errors.role}</span>}

                                {/* Role Description */}
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                    {formData.role === ROLES.ADMIN && (
                                        <span>🔐 <strong>Administrador:</strong> Acceso total a todas las funcionalidades del sistema.</span>
                                    )}
                                    {formData.role === ROLES.SELLER && (
                                        <span>💼 <strong>Vendedor:</strong> Puede gestionar clientes, ventas y pagos. Acceso limitado a gastos y usuarios.</span>
                                    )}
                                    {formData.role === ROLES.PARTNER && (
                                        <span>🤝 <strong>Socio:</strong> Solo puede ver los proyectos asociados, sus ventas y gastos relacionados.</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Estado</label>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            name="isActive"
                                            checked={formData.isActive}
                                            onChange={handleChange}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span>Usuario activo</span>
                                    </label>
                                    <span className="form-hint">
                                        Los usuarios inactivos no pueden iniciar sesión
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Partner Projects */}
                        {formData.role === ROLES.PARTNER && (
                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label className="form-label">
                                    <FiFolder style={{ marginRight: '0.5rem' }} />
                                    Proyectos Asociados
                                </label>
                                <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
                                    Selecciona los proyectos a los que el socio tendrá acceso
                                </p>

                                {state.projects.length === 0 ? (
                                    <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>No hay proyectos disponibles</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                        {state.projects.map(project => (
                                            <label
                                                key={project.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.75rem',
                                                    background: formData.associatedProjects.includes(project.id)
                                                        ? 'var(--primary-color-light)'
                                                        : 'var(--bg-secondary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    border: formData.associatedProjects.includes(project.id)
                                                        ? '2px solid var(--primary-color)'
                                                        : '2px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.associatedProjects.includes(project.id)}
                                                    onChange={() => handleProjectToggle(project.id)}
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                                <span style={{ fontWeight: 500 }}>{project.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <Link to="/users" className="btn btn-secondary">
                        <FiX /> Cancelar
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        <FiSave /> {submitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Usuario')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default UserForm;
