-- =============================================
-- PredioClick - Migration V6
-- Multi-Role Support
-- Run this AFTER migration_v5.sql
-- =============================================

-- 1. Change role column from ENUM to VARCHAR to support JSON arrays like '["seller","treasurer"]'
ALTER TABLE profiles MODIFY COLUMN role VARCHAR(100) NOT NULL DEFAULT 'seller';

-- 2. Migrate existing 'seller_treasurer' combo roles to JSON array format
UPDATE profiles SET role = '["seller","treasurer"]' WHERE role = 'seller_treasurer';
