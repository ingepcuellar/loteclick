import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiUser, FiPhone, FiMail, FiMapPin, FiFileText } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

function ClientForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { addClient, updateClient, getClientById } = useApp();

    const isEditing = !!id;

    const [formData, setFormData] = useState({
        fullName: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isEditing) {
            const client = getClientById(id);
            if (client) {
                setFormData({
                    fullName: client.name || client.fullName || '',
                    document: client.document || '',
                    phone: client.phone || '',
                    email: client.email || '',
                    address: client.address || '',
                    notes: client.notes || '',
                });
            } else {
                navigate('/clients');
            }
        }
    }, [id, isEditing]);

    const validate = () => {
        const newErrors = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'El nombre completo es requerido';
        }

        if (!formData.document.trim()) {
            newErrors.document = 'El documento es requerido';
        }

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'El email no es válido';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        if (isEditing) {
            await updateClient({ ...formData, id });
        } else {
            await addClient(formData);
        }

        navigate('/clients');
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/clients" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>
                    <p>{isEditing ? 'Actualiza la información del cliente' : 'Registra un nuevo cliente'}</p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiUser className="card-title-icon" />
                            Información del Cliente
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Nombre Completo</label>
                                <input
                                    type="text"
                                    className={`form-input ${errors.fullName ? 'error' : ''}`}
                                    placeholder="Juan Carlos Pérez González"
                                    value={formData.fullName}
                                    onChange={(e) => handleChange('fullName', e.target.value)}
                                />
                                {errors.fullName && <span className="form-error">{errors.fullName}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Documento de Identidad</label>
                                <input
                                    type="text"
                                    className={`form-input ${errors.document ? 'error' : ''}`}
                                    placeholder="CC 1234567890"
                                    value={formData.document}
                                    onChange={(e) => handleChange('document', e.target.value)}
                                />
                                {errors.document && <span className="form-error">{errors.document}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <FiPhone style={{ marginRight: '4px' }} />
                                    Teléfono
                                </label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="300 123 4567"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <FiMail style={{ marginRight: '4px' }} />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    className={`form-input ${errors.email ? 'error' : ''}`}
                                    placeholder="cliente@email.com"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                />
                                {errors.email && <span className="form-error">{errors.email}</span>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiMapPin style={{ marginRight: '4px' }} />
                                Dirección
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Calle 123 # 45-67, Barrio, Ciudad"
                                value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiFileText style={{ marginRight: '4px' }} />
                                Notas Adicionales
                            </label>
                            <textarea
                                className="form-textarea"
                                placeholder="Notas o comentarios sobre el cliente..."
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="card-footer">
                        <Link to="/clients" className="btn btn-secondary">
                            Cancelar
                        </Link>
                        <button type="submit" className="btn btn-primary">
                            <FiSave />
                            {isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default ClientForm;
