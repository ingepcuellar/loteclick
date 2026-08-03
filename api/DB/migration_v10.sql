-- Migration v10: Fix audit_logs table missing columns
-- Adds user_name, field_name, old_value, new_value columns required by logAudit()

ALTER TABLE audit_logs 
    ADD COLUMN IF NOT EXISTS user_name VARCHAR(255) DEFAULT NULL AFTER user_id,
    ADD COLUMN IF NOT EXISTS field_name VARCHAR(255) DEFAULT NULL AFTER entity_id,
    ADD COLUMN IF NOT EXISTS old_value TEXT DEFAULT NULL AFTER field_name,
    ADD COLUMN IF NOT EXISTS new_value TEXT DEFAULT NULL AFTER old_value;

-- Update audit_logs.php to support filtering by action, user, date
-- (handled in PHP endpoint)
