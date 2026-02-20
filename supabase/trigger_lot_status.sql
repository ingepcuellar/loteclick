-- =============================================
-- LoteClick - Trigger para Sincronizar Estado de Lotes
-- =============================================
-- Ejecutar este script en Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Pegar y ejecutar
-- =============================================

-- =============================================
-- FUNCIÓN: Marcar lote como vendido al crear venta
-- =============================================
CREATE OR REPLACE FUNCTION update_lot_status_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuando se crea una venta, marcar el lote como 'sold'
    IF TG_OP = 'INSERT' THEN
        UPDATE lots 
        SET status = 'sold', 
            updated_at = NOW() 
        WHERE id = NEW.lot_id;
        RETURN NEW;
    
    -- Cuando se elimina una venta, marcar el lote como 'available'
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE lots 
        SET status = 'available', 
            updated_at = NOW() 
        WHERE id = OLD.lot_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGER: Ejecutar después de INSERT en sales
-- =============================================
DROP TRIGGER IF EXISTS trigger_lot_sold_on_sale_insert ON sales;
CREATE TRIGGER trigger_lot_sold_on_sale_insert
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_lot_status_on_sale();

-- =============================================
-- TRIGGER: Ejecutar después de DELETE en sales
-- =============================================
DROP TRIGGER IF EXISTS trigger_lot_available_on_sale_delete ON sales;
CREATE TRIGGER trigger_lot_available_on_sale_delete
    AFTER DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_lot_status_on_sale();

-- =============================================
-- VERIFICACIÓN: Consultar triggers existentes
-- =============================================
-- Ejecuta esto para verificar que los triggers se crearon:
-- SELECT tgname, tgrelid::regclass, tgenabled 
-- FROM pg_trigger 
-- WHERE tgrelid = 'sales'::regclass;

-- =============================================
-- NOTA IMPORTANTE
-- =============================================
-- Después de ejecutar este script, cuando crees una venta:
-- 1. El lote automáticamente cambiará a status = 'sold'
-- 2. Cuando elimines una venta, el lote volverá a status = 'available'
-- 
-- Para probar manualmente:
-- INSERT INTO sales (project_id, lot_id, client_id, sale_price, payment_type) 
-- VALUES ('uuid-proyecto', 'uuid-lote', 'uuid-cliente', 1000000, 'cash');
-- 
-- Luego verificar:
-- SELECT id, number, status FROM lots WHERE id = 'uuid-lote';
