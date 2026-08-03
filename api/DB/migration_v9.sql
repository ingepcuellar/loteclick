-- =============================================
-- LoteClick - Migration v9: Manzanas y Etapas
-- =============================================
-- Ejecutar en producción (cPanel MySQL)
-- Permite que los lotes pertenezcan a una manzana o etapa

-- 1. Cambiar lots.number de INT a VARCHAR(50) para soportar identificadores
--    alfanuméricos como '1', 'A', '2 ETAPA-1', 'MzA-1', etc.
ALTER TABLE lots MODIFY COLUMN number VARCHAR(50) NOT NULL;

-- 2. Agregar columna manzana (identificador de agrupación: "A", "B", "1", etc.)
ALTER TABLE lots ADD COLUMN manzana VARCHAR(50) DEFAULT NULL AFTER number;

-- 3. Agregar tipo de agrupación a nivel de proyecto
ALTER TABLE projects ADD COLUMN block_type ENUM('manzana','etapa') DEFAULT NULL;

-- 4. Reemplazar unique key para permitir mismo número en diferente manzana
ALTER TABLE lots DROP INDEX uk_lot_project;
ALTER TABLE lots ADD UNIQUE KEY uk_lot_project_manzana (project_id, number, manzana);

-- 5. Índice para búsqueda por manzana
CREATE INDEX idx_lots_manzana ON lots(manzana);
