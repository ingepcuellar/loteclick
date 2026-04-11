-- =============================================
-- PredioClick - Migration V3
-- Entrega Final - Mejoras
-- Run this AFTER migration_v2.sql
-- =============================================

-- 1. Expand expense categories to match frontend values
ALTER TABLE expenses MODIFY COLUMN category VARCHAR(50) NOT NULL DEFAULT 'other';

-- 2. Add selected_lots JSON column for "Firmas y Escrituras" multi-lot tracking
ALTER TABLE expenses ADD COLUMN selected_lots JSON DEFAULT NULL AFTER attachment;

-- 3. Add 'seller_treasurer' combined role to profiles
ALTER TABLE profiles MODIFY COLUMN role ENUM('admin', 'seller', 'treasurer', 'seller_treasurer', 'partner') NOT NULL DEFAULT 'seller';
