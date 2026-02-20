-- =============================================
-- LoteClick - Configuración de Supabase Storage para Recibos
-- =============================================
-- Ejecutar este script en Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Pegar y ejecutar
-- =============================================

-- =============================================
-- CREAR BUCKET "receipts" para almacenar recibos de pago
-- =============================================
-- NOTA: También puedes crear el bucket desde el Dashboard:
-- Storage > New Bucket > Nombre: "receipts" > Public: ON
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    true,  -- Bucket público para que las imágenes se puedan ver
    5242880,  -- 5MB límite
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- =============================================
-- POLÍTICAS DE ACCESO (RLS) PARA EL BUCKET
-- =============================================

-- Permitir a usuarios autenticados subir archivos
CREATE POLICY "Usuarios autenticados pueden subir recibos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Permitir a usuarios autenticados ver sus archivos
CREATE POLICY "Usuarios autenticados pueden ver recibos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Permitir acceso público de lectura (para mostrar imágenes)
CREATE POLICY "Acceso público de lectura a recibos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Permitir a usuarios autenticados eliminar archivos
CREATE POLICY "Usuarios autenticados pueden eliminar recibos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- =============================================
-- VERIFICACIÓN
-- =============================================
-- Para verificar que el bucket se creó correctamente:
-- SELECT * FROM storage.buckets WHERE id = 'receipts';
-- 
-- Para verificar las políticas:
-- SELECT * FROM pg_policies WHERE tablename = 'objects';
