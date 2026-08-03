import { useState, useCallback, useRef } from 'react';
import { FiUpload, FiDownload, FiCheckCircle, FiAlertTriangle, FiX, FiFileText, FiGrid, FiUsers, FiFolder, FiMapPin, FiShoppingCart, FiDollarSign, FiCreditCard } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { api } from '../../lib/apiClient';

// ─── Entity definitions ──────────────────────────────────────────

const ENTITIES = [
    { key: 'clients', label: 'Clientes', icon: FiUsers, color: '#6366f1', order: 1 },
    { key: 'projects', label: 'Proyectos', icon: FiFolder, color: '#059669', order: 2 },
    { key: 'partners', label: 'Socios', icon: FiUsers, color: '#7c3aed', order: 3 },
    { key: 'lots', label: 'Lotes', icon: FiMapPin, color: '#0891b2', order: 4 },
    { key: 'sales', label: 'Ventas', icon: FiShoppingCart, color: '#d97706', order: 5 },
    { key: 'payments', label: 'Pagos', icon: FiCreditCard, color: '#2563eb', order: 6 },
    { key: 'expenses', label: 'Gastos', icon: FiDollarSign, color: '#ef4444', order: 7 },
];

const TEMPLATES = {
    clients: {
        columns: ['Nombre', 'Documento', 'Teléfono', 'Email', 'Dirección', 'Notas'],
        keys: ['nombre', 'documento', 'telefono', 'email', 'direccion', 'notas'],
        required: ['nombre'],
        example: ['Juan Pérez', '1234567890', '3001234567', 'juan@email.com', 'Calle 10 #20-30', ''],
    },
    projects: {
        columns: ['Nombre', 'Ubicación', 'Descripción'],
        keys: ['nombre', 'ubicacion', 'descripcion'],
        required: ['nombre', 'ubicacion'],
        example: ['Bosque Medina', 'Villavicencio, Meta', 'Proyecto de 50 lotes'],
    },
    partners: {
        columns: ['Proyecto', 'Nombre', 'Porcentaje (%)', 'Documento', 'Teléfono'],
        keys: ['proyecto', 'nombre', 'porcentaje', 'documento', 'telefono'],
        required: ['proyecto', 'nombre', 'porcentaje'],
        example: ['Bosque Medina', 'Carlos López', '25', '9876543210', '3109876543'],
    },
    lots: {
        columns: ['Proyecto', 'Número', 'Manzana / Etapa', 'Área (m²)', 'Precio', 'Estado (available/reserved/sold)'],
        keys: ['proyecto', 'numero', 'manzana', 'area', 'precio', 'estado'],
        required: ['proyecto', 'numero'],
        example: ['Bosque Medina', '9', '2', '200', '35000000', 'available'],
    },
    sales: {
        columns: ['Proyecto', 'Nro Lote', 'Cliente (nombre)', 'Precio Venta', 'Fecha Venta (YYYY-MM-DD)', 'Tipo Pago (contado/credito)', 'Cuota Inicial', 'Nro Cuotas'],
        keys: ['proyecto', 'numero_lote', 'cliente', 'precio_venta', 'fecha_venta', 'tipo_pago', 'cuota_inicial', 'num_cuotas'],
        required: ['proyecto', 'numero_lote', 'cliente', 'precio_venta', 'fecha_venta'],
        example: ['Bosque Medina', '1', 'Juan Pérez', '35000000', '2026-01-15', 'credito', '5000000', '36'],
    },
    payments: {
        columns: ['Proyecto', 'Nro Lote', 'Monto', 'Fecha Pago (YYYY-MM-DD)', 'Método (efectivo/transferencia/cheque/tarjeta/otro)', 'Notas'],
        keys: ['proyecto', 'numero_lote', 'monto', 'fecha_pago', 'metodo', 'notas'],
        required: ['proyecto', 'numero_lote', 'monto', 'fecha_pago'],
        example: ['Bosque Medina', '1', '1000000', '2026-02-01', 'transferencia', 'Pago cuota 1'],
    },
    expenses: {
        columns: ['Proyecto', 'Descripción', 'Monto', 'Categoría (infrastructure/legal/marketing/administrative/other)', 'Fecha (YYYY-MM-DD)', 'Notas'],
        keys: ['proyecto', 'descripcion', 'monto', 'categoria', 'fecha', 'notas'],
        required: ['proyecto', 'descripcion', 'monto', 'categoria', 'fecha'],
        example: ['Bosque Medina', 'Compra de materiales', '500000', 'infrastructure', '2026-03-01', ''],
    },
};

function BulkImport() {
    const [selectedEntity, setSelectedEntity] = useState('clients');
    const [parsedData, setParsedData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const template = TEMPLATES[selectedEntity];
    const entity = ENTITIES.find(e => e.key === selectedEntity);

    // ─── Download template ───────────────────────────────────────

    const downloadTemplate = useCallback(() => {
        const t = TEMPLATES[selectedEntity];
        const ws = XLSX.utils.aoa_to_sheet([
            t.columns,
            t.example,
        ]);

        // Set column widths
        ws['!cols'] = t.columns.map(col => ({ wch: Math.max(col.length + 5, 18) }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, ENTITIES.find(e => e.key === selectedEntity).label);
        XLSX.writeFile(wb, `plantilla_${selectedEntity}.xlsx`);
    }, [selectedEntity]);

    // ─── Parse uploaded file ─────────────────────────────────────

    const parseFile = useCallback((file) => {
        setResult(null);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                if (jsonData.length < 2) {
                    alert('El archivo no contiene datos (solo el encabezado).');
                    return;
                }

                // Map header row to keys
                const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
                const t = TEMPLATES[selectedEntity];
                const keyMap = {};
                
                // Try to match headers to template columns
                headers.forEach((header, idx) => {
                    const colIdx = t.columns.findIndex(c => 
                        c.toLowerCase().trim() === header ||
                        c.toLowerCase().trim().startsWith(header) ||
                        header.startsWith(c.toLowerCase().trim().split(' ')[0])
                    );
                    if (colIdx !== -1) {
                        keyMap[idx] = t.keys[colIdx];
                    } else if (idx < t.keys.length) {
                        // Fallback: use position
                        keyMap[idx] = t.keys[idx];
                    }
                });

                const rows = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i];
                    if (!rowData || rowData.every(cell => cell === undefined || cell === null || String(cell).trim() === '')) continue;

                    const obj = {};
                    Object.entries(keyMap).forEach(([colIdx, key]) => {
                        const val = rowData[parseInt(colIdx)];
                        obj[key] = val !== undefined && val !== null ? String(val).trim() : '';
                    });
                    rows.push(obj);
                }

                setParsedData(rows);
            } catch (err) {
                alert('Error al leer el archivo: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [selectedEntity]);

    // ─── Drag & Drop handlers ────────────────────────────────────

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) parseFile(file);
    }, [parseFile]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => setDragOver(false), []);

    const handleFileInput = useCallback((e) => {
        const file = e.target.files[0];
        if (file) parseFile(file);
    }, [parseFile]);

    // ─── Import data ─────────────────────────────────────────────

    const handleImport = async () => {
        if (parsedData.length === 0) return;
        setImporting(true);
        setResult(null);

        try {
            const { data, error } = await api.post(
                `endpoints/bulk-import.php?action=${selectedEntity}`,
                { rows: parsedData }
            );

            if (error) {
                setResult({ success: false, message: error });
            } else {
                setResult({
                    success: true,
                    imported: data.imported,
                    total: data.total,
                    errors: data.errors || [],
                });
            }
        } catch (err) {
            setResult({ success: false, message: err.message });
        } finally {
            setImporting(false);
        }
    };

    // ─── Reset ───────────────────────────────────────────────────

    const handleReset = () => {
        setParsedData([]);
        setFileName('');
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ─── Validate row (frontend check) ───────────────────────────

    const getRowErrors = (row) => {
        const errors = [];
        template.required.forEach(key => {
            if (!row[key] || String(row[key]).trim() === '') {
                const colName = template.columns[template.keys.indexOf(key)] || key;
                errors.push(`${colName} es requerido`);
            }
        });
        return errors;
    };

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>📥 Carga Masiva</h1>
                    <p>Importa datos desde archivos Excel (.xlsx) o CSV</p>
                </div>
            </div>

            {/* Entity Selector */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiGrid className="card-title-icon" />
                        Selecciona la Entidad
                    </h3>
                </div>
                <div className="card-body">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '0.75rem',
                    }}>
                        {ENTITIES.map(ent => (
                            <button
                                key={ent.key}
                                onClick={() => {
                                    setSelectedEntity(ent.key);
                                    handleReset();
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem 0.5rem',
                                    borderRadius: 'var(--radius-lg)',
                                    border: selectedEntity === ent.key
                                        ? `2px solid ${ent.color}`
                                        : '2px solid var(--border-color)',
                                    background: selectedEntity === ent.key
                                        ? `${ent.color}15`
                                        : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    fontWeight: selectedEntity === ent.key ? '600' : '400',
                                    color: selectedEntity === ent.key ? ent.color : 'var(--text-secondary)',
                                }}
                            >
                                <ent.icon size={24} />
                                <span style={{ fontSize: '0.8rem' }}>{ent.label}</span>
                                <span style={{
                                    fontSize: '0.65rem',
                                    background: 'var(--bg-tertiary)',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: 'var(--radius-full)',
                                    color: 'var(--text-muted)',
                                }}>#{ent.order}</span>
                            </button>
                        ))}
                    </div>
                    <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.75rem',
                        textAlign: 'center',
                    }}>
                        ⚠️ Respetar el orden de importación: Clientes → Proyectos → Socios → Lotes → Ventas → Pagos → Gastos
                    </p>
                </div>
            </div>

            {/* Download & Upload */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--spacing-4)',
                marginBottom: 'var(--spacing-6)',
            }}>
                {/* Download Template */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiDownload className="card-title-icon" />
                            1. Descargar Plantilla
                        </h3>
                    </div>
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Descarga la plantilla de <strong>{entity.label}</strong>, 
                            llénala con tus datos y súbela en el paso 2.
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Columnas:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: 'center' }}>
                                {template.columns.map((col, i) => (
                                    <span key={i} style={{
                                        fontSize: '0.7rem',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: 'var(--radius-full)',
                                        background: template.required.includes(template.keys[i])
                                            ? `${entity.color}20`
                                            : 'var(--bg-tertiary)',
                                        color: template.required.includes(template.keys[i])
                                            ? entity.color
                                            : 'var(--text-muted)',
                                        fontWeight: template.required.includes(template.keys[i]) ? '600' : '400',
                                    }}>
                                        {col}{template.required.includes(template.keys[i]) ? ' *' : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={downloadTemplate}
                            style={{ background: entity.color }}
                        >
                            <FiDownload /> Descargar plantilla_{selectedEntity}.xlsx
                        </button>
                    </div>
                </div>

                {/* Upload File */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiUpload className="card-title-icon" />
                            2. Subir Archivo
                        </h3>
                    </div>
                    <div className="card-body">
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: `2px dashed ${dragOver ? entity.color : 'var(--border-color)'}`,
                                borderRadius: 'var(--radius-lg)',
                                padding: '2rem 1rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: dragOver ? `${entity.color}10` : 'var(--bg-tertiary)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <FiUpload size={32} color={dragOver ? entity.color : 'var(--text-muted)'} />
                            <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {fileName
                                    ? <>📄 <strong>{fileName}</strong> ({parsedData.length} filas)</>
                                    : 'Arrastra tu archivo aquí o haz clic para seleccionar'
                                }
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Formatos: .xlsx, .xls, .csv
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileInput}
                            style={{ display: 'none' }}
                        />
                        {fileName && (
                            <button
                                className="btn btn-secondary"
                                onClick={handleReset}
                                style={{ marginTop: '0.5rem', width: '100%' }}
                            >
                                <FiX /> Limpiar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Table */}
            {parsedData.length > 0 && (
                <div className="card mb-6">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 className="card-title">
                            <FiFileText className="card-title-icon" />
                            Vista Previa — {parsedData.length} registros
                        </h3>
                        <button
                            className="btn btn-primary"
                            onClick={handleImport}
                            disabled={importing}
                            style={{ background: entity.color }}
                        >
                            {importing ? (
                                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Importando...</>
                            ) : (
                                <><FiUpload /> Importar {parsedData.length} {entity.label}</>
                            )}
                        </button>
                    </div>
                    <div className="card-body" style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    {template.columns.map((col, i) => (
                                        <th key={i} style={{
                                            color: template.required.includes(template.keys[i]) ? entity.color : undefined,
                                        }}>
                                            {col.split('(')[0].trim()}
                                            {template.required.includes(template.keys[i]) && ' *'}
                                        </th>
                                    ))}
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData.slice(0, 100).map((row, idx) => {
                                    const rowErrors = getRowErrors(row);
                                    return (
                                        <tr key={idx} style={{
                                            background: rowErrors.length > 0 ? '#fef2f210' : undefined,
                                        }}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 2}</td>
                                            {template.keys.map((key, i) => (
                                                <td key={i} style={{
                                                    color: template.required.includes(key) && !row[key] ? '#ef4444' : undefined,
                                                    fontSize: '0.85rem',
                                                    maxWidth: '200px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {row[key] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>
                                            ))}
                                            <td>
                                                {rowErrors.length > 0 ? (
                                                    <span className="badge badge-warning" title={rowErrors.join(', ')}>
                                                        ⚠️ {rowErrors.length}
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-success">✓</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {parsedData.length > 100 && (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                                Mostrando 100 de {parsedData.length} filas...
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            {result.success ? (
                                <><FiCheckCircle className="card-title-icon" style={{ color: '#059669' }} /> Resultados de Importación</>
                            ) : (
                                <><FiAlertTriangle className="card-title-icon" style={{ color: '#ef4444' }} /> Error de Importación</>
                            )}
                        </h3>
                    </div>
                    <div className="card-body">
                        {result.success ? (
                            <>
                                {/* Summary */}
                                <div style={{
                                    display: 'flex',
                                    gap: '1rem',
                                    flexWrap: 'wrap',
                                    marginBottom: '1rem',
                                }}>
                                    <div style={{
                                        flex: 1,
                                        minWidth: '150px',
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-lg)',
                                        background: '#ecfdf5',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#059669' }}>
                                            {result.imported}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#065f46' }}>Importados</div>
                                    </div>
                                    {result.errors.length > 0 && (
                                        <div style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-lg)',
                                            background: '#fef2f2',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>
                                                {result.errors.length}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#991b1b' }}>Errores</div>
                                        </div>
                                    )}
                                    <div style={{
                                        flex: 1,
                                        minWidth: '150px',
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-lg)',
                                        background: 'var(--bg-tertiary)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {result.total}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total</div>
                                    </div>
                                </div>

                                {/* Error details */}
                                {result.errors.length > 0 && (
                                    <div style={{
                                        maxHeight: '300px',
                                        overflow: 'auto',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '60px' }}>Fila</th>
                                                    <th>Error</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.errors.map((err, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <span className="badge badge-warning">{err.row}</span>
                                                        </td>
                                                        <td style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                                                            {err.message}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{
                                padding: '1rem',
                                background: '#fef2f2',
                                borderRadius: 'var(--radius-lg)',
                                color: '#991b1b',
                            }}>
                                {result.message}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default BulkImport;
