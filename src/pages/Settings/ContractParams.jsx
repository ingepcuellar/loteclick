import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    FiArrowLeft,
    FiSave,
    FiUser,
    FiMapPin,
    FiFileText,
    FiHash,
    FiHome,
    FiCheck
} from 'react-icons/fi';
import { contractParamsService } from '../../services/contractParamsService';

function ContractParams() {
    const [form, setForm] = useState({
        vendorName: '',
        vendorDocument: '',
        vendorPhone: '',
        vendorAddress: '',
        vendorCiudadCC: '',
        vendorEmail: '',
        empresaNombre: '',
        empresaNit: '',
        numeroCuenta: '',
        matriculaInmobiliaria: '',
        porcentajeCuota: '0.052%',
        ciudad: 'Villavicencio - Meta',
        notariaNombre: '',
        notariaCiudad: '',
        escrituraFecha: '',
        escrituraHora: '03:00 PM',
        tituloPropiedad: '',
        ultimoNumeroPromesa: 0,
        initialPaymentPct: 20
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState('');
    const [hasExistingRecord, setHasExistingRecord] = useState(false);

    useEffect(() => {
        loadParams();
    }, []);

    const loadParams = async () => {
        setIsLoading(true);
        try {
            const { data } = await contractParamsService.getParams();
            const p = data?.data || data;
            if (p) {
                setForm({
                    vendorName: p.vendor_name || '',
                    vendorDocument: p.vendor_document || '',
                    vendorPhone: p.vendor_phone || '',
                    vendorAddress: p.vendor_address || '',
                    vendorCiudadCC: p.vendor_ciudad_cc || '',
                    vendorEmail: p.vendor_email || '',
                    empresaNombre: p.empresa_nombre || '',
                    empresaNit: p.empresa_nit || '',
                    numeroCuenta: p.numero_cuenta || '',
                    matriculaInmobiliaria: p.matricula_inmobiliaria || '',
                    porcentajeCuota: p.porcentaje_cuota || '0.052%',
                    ciudad: p.ciudad || 'Villavicencio - Meta',
                    notariaNombre: p.notaria_nombre || '',
                    notariaCiudad: p.notaria_ciudad || '',
                    escrituraFecha: p.escritura_fecha || '',
                    escrituraHora: p.escritura_hora || '03:00 PM',
                    tituloPropiedad: p.titulo_propiedad || '',
                    ultimoNumeroPromesa: parseInt(p.ultimo_numero_promesa) || 0,
                    initialPaymentPct: parseFloat(p.initial_payment_pct) || 20
                });
                setHasExistingRecord(!!p.id);
            }
        } catch (err) {
            console.error('Error loading contract params:', err);
            setError('Error al cargar los parámetros');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setSaveSuccess(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        setSaveSuccess(false);

        try {
            if (hasExistingRecord) {
                await contractParamsService.updateParams(form);
            } else {
                await contractParamsService.createParams(form);
                setHasExistingRecord(true);
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving contract params:', err);
            setError('Error al guardar los parámetros');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: 'var(--spacing-4)', color: 'var(--text-muted)' }}>
                        Cargando parámetros...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>Parámetros de Contrato</h1>
                    <p>Configura los datos que aparecerán en las promesas de compraventa</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="card mb-4" style={{ borderColor: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)' }}>
                        <div className="card-body" style={{ color: 'var(--color-error)' }}>
                            ⚠️ {error}
                        </div>
                    </div>
                )}

                {/* Vendedor */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiUser className="card-title-icon" />
                            Datos del Promitente Vendedor
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
                            Persona que aparecerá como vendedor en todas las promesas de compraventa.
                        </p>
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label className="form-label">Nombre Completo *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="vendorName"
                                    value={form.vendorName}
                                    onChange={handleChange}
                                    placeholder="Ej: NOMBRE COMPLETO DEL VENDEDOR"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cédula de Ciudadanía *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="vendorDocument"
                                    value={form.vendorDocument}
                                    onChange={handleChange}
                                    placeholder="Ej: 1.000.000.000"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ciudad expedición C.C.</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="vendorCiudadCC"
                                    value={form.vendorCiudadCC}
                                    onChange={handleChange}
                                    placeholder="Ej: Villavicencio"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Celular</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="vendorPhone"
                                    value={form.vendorPhone}
                                    onChange={handleChange}
                                    placeholder="Ej: 3100000000"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección / Residencia</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="vendorAddress"
                                    value={form.vendorAddress}
                                    onChange={handleChange}
                                    placeholder="Ej: Calle 10 # 20-30, Ciudad"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Correo electrónico</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    name="vendorEmail"
                                    value={form.vendorEmail}
                                    onChange={handleChange}
                                    placeholder="Ej: vendedor@empresa.com"
                                />
                            </div>
                        </div>

                        {/* Empresa */}
                        <hr style={{ margin: 'var(--spacing-4) 0', borderColor: 'var(--border-color)' }} />
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                            🏢 Empresa representada (aparece en los documentos Word)
                        </p>
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label className="form-label">Nombre de la Empresa</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="empresaNombre"
                                    value={form.empresaNombre}
                                    onChange={handleChange}
                                    placeholder="Ej: MI EMPRESA INMOBILIARIA S.A.S"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">NIT de la Empresa</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="empresaNit"
                                    value={form.empresaNit}
                                    onChange={handleChange}
                                    placeholder="Ej: 900123456-7"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">N° Cuenta Bancaria (para transferencias)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="numeroCuenta"
                                    value={form.numeroCuenta}
                                    onChange={handleChange}
                                    placeholder="Ej: 38800007636 (Bancolombia Ahorros)"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ventas */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiHash className="card-title-icon" />
                            Parámetros de Ventas
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
                            Estos valores se usan como valores predeterminados al registrar una nueva venta.
                        </p>
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label className="form-label">% Cuota Inicial Predeterminada</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                    <input
                                        type="number"
                                        className="form-input"
                                        name="initialPaymentPct"
                                        value={form.initialPaymentPct}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        step="1"
                                        placeholder="20"
                                        style={{ maxWidth: '120px' }}
                                    />
                                    <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '1.2rem' }}>%</span>
                                </div>
                                <span className="form-hint">
                                    Al registrar una venta a crédito, la cuota inicial se calculará automáticamente como este porcentaje del precio del lote.
                                    El vendedor puede modificarla manualmente. Valor recomendado: 20%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inmueble */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiHome className="card-title-icon" />
                            Datos del Inmueble
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label className="form-label">Matrícula Inmobiliaria</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="matriculaInmobiliaria"
                                    value={form.matriculaInmobiliaria}
                                    onChange={handleChange}
                                    placeholder="Ej: M.I. 230-159636"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Porcentaje Cuota Parte</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="porcentajeCuota"
                                    value={form.porcentajeCuota}
                                    onChange={handleChange}
                                    placeholder="Ej: 0.052%"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Ciudad</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="ciudad"
                                    value={form.ciudad}
                                    onChange={handleChange}
                                    placeholder="Ej: Villavicencio - Meta"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notaría */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiFileText className="card-title-icon" />
                            Notaría y Escritura
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label className="form-label">Nombre de la Notaría</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="notariaNombre"
                                    value={form.notariaNombre}
                                    onChange={handleChange}
                                    placeholder="Ej: Notaría Primera del Círculo de la Ciudad"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ciudad de la Notaría</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="notariaCiudad"
                                    value={form.notariaCiudad}
                                    onChange={handleChange}
                                    placeholder="Ej: Villavicencio"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha de Escritura</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    name="escrituraFecha"
                                    value={form.escrituraFecha}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hora de la Escritura</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="escrituraHora"
                                    value={form.escrituraHora}
                                    onChange={handleChange}
                                    placeholder="Ej: 03:00 PM"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Título de Propiedad */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiFileText className="card-title-icon" />
                            Título de Propiedad (Cláusula Segunda)
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
                            Texto que describe cómo adquirió el vendedor la propiedad del inmueble. Se incluirá en la cláusula SEGUNDA del contrato.
                        </p>
                        <div className="form-group">
                            <textarea
                                className="form-input"
                                name="tituloPropiedad"
                                value={form.tituloPropiedad}
                                onChange={handleChange}
                                rows={5}
                                placeholder="Ej: Por compraventa que le hiciera el señor NOMBRE VENDEDOR ANTERIOR, identificado con CC. X.XXX.XXX.XXX de Ciudad, mediante documento de compraventa otorgado el día DD de mes de AAAA..."
                                style={{ resize: 'vertical', minHeight: '100px' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Consecutivo */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiHash className="card-title-icon" />
                            Consecutivo de Promesa
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
                            Número del último contrato generado. Al crear un nuevo contrato, se asignará el siguiente número automáticamente.
                        </p>
                        <div className="form-group" style={{ maxWidth: '200px' }}>
                            <label className="form-label">Último N° de Promesa</label>
                            <input
                                type="number"
                                className="form-input"
                                name="ultimoNumeroPromesa"
                                value={form.ultimoNumeroPromesa}
                                onChange={handleChange}
                                min={0}
                                style={{ fontWeight: '700', fontSize: 'var(--font-size-xl)', textAlign: 'center' }}
                            />
                            <small style={{ color: 'var(--text-muted)' }}>
                                El próximo contrato será el N°{String(parseInt(form.ultimoNumeroPromesa || 0) + 1).padStart(3, '0')}
                            </small>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex gap-4" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                            {saveSuccess && (
                                <span style={{
                                    color: 'var(--color-success)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: '500',
                                    animation: 'fadeIn 0.3s ease'
                                }}>
                                    <FiCheck /> Parámetros guardados correctamente
                                </span>
                            )}
                            <Link to="/" className="btn btn-secondary">
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <span className="spinner" style={{ width: 16, height: 16 }}></span>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <FiSave /> Guardar Parámetros
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default ContractParams;
