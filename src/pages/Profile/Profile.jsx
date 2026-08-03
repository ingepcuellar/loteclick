import { useState } from 'react';
import { FiUser, FiMail, FiShield, FiLock, FiSave, FiCheck, FiArrowLeft, FiEdit3, FiUpload } from 'react-icons/fi';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { storageService } from '../../services/storageService';
import { pickImage } from '../../lib/cameraUtils';
import { api } from '../../lib/apiClient';
import { resolveImageUrl } from '../../lib/barcodeUtils';


function Profile() {
    const { currentUser } = useAuth();
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [saving, setSaving] = useState(false);
    const [signatureSaving, setSignatureSaving] = useState(false);
    const [signatureError, setSignatureError] = useState('');
    const [signatureSuccess, setSignatureSuccess] = useState('');

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordData.newPassword.length < 6) {
            setPasswordError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Las contraseñas no coinciden');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/endpoints/auth.php?action=update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jvj_token') || localStorage.getItem('loteclick_token')}`
                },
                body: JSON.stringify({
                    id: currentUser.id,
                    password: passwordData.newPassword
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al actualizar la contraseña');
            }

            setPasswordSuccess('Contraseña actualizada correctamente');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordSuccess('');
            }, 2000);
        } catch (err) {
            setPasswordError(err.message || 'Error al actualizar la contraseña');
        } finally {
            setSaving(false);
        }
    };

    const ROLE_COLORS = {
        admin: '#3b82f6',
        seller: '#10b981',
        partner: '#8b5cf6'
    };

    const roleColor = ROLE_COLORS[currentUser?.role] || '#6b7280';

    const handleSignatureUpload = async () => {
        try {
            setSignatureError('');
            setSignatureSuccess('');
            const result = await pickImage({ allowPdf: false });
            if (!result) return;

            setSignatureSaving(true);

            // Upload image
            const { data: uploadData, error: uploadError } = await storageService.uploadFile(result.file, 'signatures');
            if (uploadError) throw new Error(uploadError);

            const signatureUrl = uploadData.url || uploadData;

            // Save to profile via apiClient (handles auth token automatically)
            const { data: updateData, error: updateError } = await api.put('endpoints/auth.php?action=update', {
                id: currentUser.id,
                signature_image: signatureUrl
            });

            if (updateError) throw new Error(updateError);

            // Force refresh user data
            window.location.reload();
            
        } catch (err) {
            setSignatureError(err.message || 'Error al procesar la firma');
        } finally {
            setSignatureSaving(false);
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>Mi Perfil</h1>
                    <p>Información de tu cuenta</p>
                </div>
            </div>

            <div className="grid grid-2">
                {/* User Info Card */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiUser className="card-title-icon" />
                            Información Personal
                        </h3>
                    </div>
                    <div className="card-body">
                        {/* Avatar */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-4)',
                            marginBottom: 'var(--spacing-6)',
                            padding: 'var(--spacing-4)',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${roleColor}, ${roleColor}80)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '24px',
                                fontWeight: '700',
                                flexShrink: 0
                            }}>
                                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>
                                    {currentUser?.name || 'Usuario'}
                                </div>
                                <div style={{
                                    display: 'inline-block',
                                    padding: '2px 10px',
                                    borderRadius: '12px',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: '500',
                                    background: `${roleColor}20`,
                                    color: roleColor,
                                    marginTop: '4px'
                                }}>
                                    {ROLE_LABELS[currentUser?.role] || 'Usuario'}
                                </div>
                            </div>
                        </div>

                        {/* Info Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-3)',
                                padding: 'var(--spacing-3)',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <FiUser style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre</div>
                                    <div style={{ fontWeight: '500' }}>{currentUser?.name || '-'}</div>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-3)',
                                padding: 'var(--spacing-3)',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <FiMail style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Correo Electrónico</div>
                                    <div style={{ fontWeight: '500' }}>{currentUser?.email || '-'}</div>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-3)',
                                padding: 'var(--spacing-3)'
                            }}>
                                <FiShield style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol</div>
                                    <div style={{ fontWeight: '500' }}>{ROLE_LABELS[currentUser?.role] || currentUser?.role || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Signature Section */}
                        <div style={{ marginTop: 'var(--spacing-6)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    <FiEdit3 style={{ marginRight: '0.5rem' }} />
                                    Firma Digitalizada
                                </div>
                                <button 
                                    className="btn btn-outline btn-sm" 
                                    onClick={handleSignatureUpload}
                                    disabled={signatureSaving}
                                >
                                    <FiUpload /> {signatureSaving ? 'Guardando...' : 'Cargar Firma'}
                                </button>
                            </div>
                            
                            {signatureError && <div className="form-error mb-2">{signatureError}</div>}
                            {signatureSuccess && <div style={{ color: 'var(--color-success)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{signatureSuccess}</div>}
                            
                            <div style={{ 
                                background: 'var(--bg-secondary)', 
                                padding: 'var(--spacing-4)', 
                                borderRadius: 'var(--radius-md)', 
                                textAlign: 'center',
                                minHeight: '100px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px dashed var(--border-color)'
                            }}>
                                {currentUser?.signature_image || currentUser?.signatureImage ? (
                                    <img 
                                        src={resolveImageUrl(currentUser?.signature_image || currentUser?.signatureImage)} 
                                        alt="Firma del usuario" 
                                        style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} 
                                    />
                                ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                        No has configurado tu firma. Se usará solo tu nombre en los documentos.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Card */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiLock className="card-title-icon" />
                            Seguridad
                        </h3>
                    </div>
                    <div className="card-body">
                        {!showPasswordForm ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                                <FiLock style={{ fontSize: '40px', color: 'var(--text-muted)', marginBottom: 'var(--spacing-3)' }} />
                                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)' }}>
                                    Puedes cambiar tu contraseña en cualquier momento
                                </p>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowPasswordForm(true)}
                                >
                                    <FiLock /> Cambiar Contraseña
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handlePasswordChange}>
                                {passwordError && (
                                    <div style={{
                                        padding: 'var(--spacing-3)',
                                        background: 'var(--color-error)15',
                                        border: '1px solid var(--color-error)40',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--color-error)',
                                        marginBottom: 'var(--spacing-4)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        {passwordError}
                                    </div>
                                )}

                                {passwordSuccess && (
                                    <div style={{
                                        padding: 'var(--spacing-3)',
                                        background: 'var(--color-success)15',
                                        border: '1px solid var(--color-success)40',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--color-success)',
                                        marginBottom: 'var(--spacing-4)',
                                        fontSize: 'var(--font-size-sm)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-2)'
                                    }}>
                                        <FiCheck /> {passwordSuccess}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label required">Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Mínimo 6 caracteres"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label required">Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Repite la contraseña"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)' }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            setShowPasswordForm(false);
                                            setPasswordError('');
                                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Guardando...' : <><FiSave /> Guardar</>}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
