import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { FiLogIn, FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { brand } from '../../config/brandConfig';

function Login() {
    const navigate = useNavigate();
    const { login, isAuthenticated, isLoading } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Redirect if already authenticated
    if (isAuthenticated && !isLoading) {
        return <Navigate to="/" replace />;
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        if (!formData.email || !formData.password) {
            setError('Por favor ingresa tu correo y contraseña');
            setSubmitting(false);
            return;
        }

        const result = await login(formData.email, formData.password);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error);
        }

        setSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="spinner"></div>
                        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Cargando...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card">
                {/* Logo and Title */}
                <div className="login-header">
                    <div className="login-logo">
                        <img src={brand.logo} alt={brand.appName} />
                    </div>
                    <h1>{brand.appName}</h1>
                    <p>{brand.subtitle}</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="alert alert-error">
                        <FiAlertCircle />
                        <span>{error}</span>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label">
                            <FiMail style={{ marginRight: '0.5rem' }} />
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            name="email"
                            className="form-control"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tu@correo.com"
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <FiLock style={{ marginRight: '0.5rem' }} />
                            Contraseña
                        </label>
                        <input
                            type="password"
                            name="password"
                            className="form-control"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-login"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner-sm"></span>
                                Ingresando...
                            </>
                        ) : (
                            <>
                                <FiLogIn />
                                Iniciar Sesión
                            </>
                        )}
                    </button>
                </form>

                {/* Developer Branding */}
                <div className="login-help" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Aplicación desarrollada por
                    </p>
                    <p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        ITERA TECH
                    </p>
                    <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                    }}>
                        <span>Instagram: <a href="https://instagram.com/iteratech.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-500)', textDecoration: 'none' }}>@iteratech.co</a></span>
                        <span>Web: <a href="https://www.iteratech.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-500)', textDecoration: 'none' }}>www.iteratech.co</a></span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
