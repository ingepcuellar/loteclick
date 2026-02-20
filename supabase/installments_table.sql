-- =============================================
-- LoteClick - Tabla de Cuotas (Installments)
-- =============================================
-- Ejecutar este script en Supabase SQL Editor
-- =============================================

-- Tabla para almacenar las cuotas individuales de cada venta
CREATE TABLE IF NOT EXISTS installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
    paid_amount DECIMAL(15,2) DEFAULT 0,
    paid_date DATE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sale_id, installment_number)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_installments_sale_id ON installments(sale_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_installment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_installment_updated ON installments;
CREATE TRIGGER trigger_installment_updated
    BEFORE UPDATE ON installments
    FOR EACH ROW
    EXECUTE FUNCTION update_installment_timestamp();

-- Trigger para marcar cuotas como vencidas automáticamente
CREATE OR REPLACE FUNCTION update_overdue_installments()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE installments 
    SET status = 'overdue'
    WHERE status = 'pending' 
    AND due_date < CURRENT_DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver cuotas" ON installments;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear cuotas" ON installments;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar cuotas" ON installments;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar cuotas" ON installments;

-- Crear políticas nuevas
CREATE POLICY "Usuarios autenticados pueden ver cuotas"
ON installments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden crear cuotas"
ON installments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar cuotas"
ON installments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar cuotas"
ON installments FOR DELETE TO authenticated USING (true);

-- =============================================
-- VERIFICACIÓN
-- =============================================
-- SELECT * FROM installments;
