-- =============================================
-- LoteClick - Agregar columna receipt_image a payments
-- =============================================
-- Ejecutar este script en Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Pegar y ejecutar
-- =============================================

-- Agregar columna para guardar URL de imagen de recibo
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS receipt_image TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN payments.receipt_image IS 'URL de la imagen del recibo de pago (Supabase Storage o base64)';

-- Verificar que la columna se agregó
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments';
