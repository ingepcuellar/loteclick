import React from 'react';

const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const strVal = val.toString().split('.')[0];
    const num = parseInt(strVal.replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';
    return num.toLocaleString('es-CO');
};

function CurrencyInput({ value, onChange, name, className, placeholder, ...props }) {
    const displayValue = formatCurrency(value);

    const handleChange = (e) => {
        // Elimina todo lo que no sea número
        const rawValue = e.target.value.replace(/\D/g, '');
        const numValue = rawValue === '' ? '' : parseInt(rawValue, 10);
        
        // Simula el evento nativo para que el padre lo maneje igual
        if (onChange) {
            onChange({
                target: {
                    name: name || '',
                    value: numValue
                }
            });
        }
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            name={name}
            className={className}
            placeholder={placeholder}
            value={displayValue}
            onChange={handleChange}
            {...props}
        />
    );
}

export default CurrencyInput;
