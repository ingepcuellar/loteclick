-- =============================================
-- PredioClick - Migration V3
-- Commission Agents table
-- Run this BEFORE deploying new code
-- =============================================

-- 1. Create commission_agents table
CREATE TABLE IF NOT EXISTS commission_agents (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    document VARCHAR(50) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Migrate existing commission_agent names from sales into the new table
-- This will create unique entries for each distinct commission agent name
INSERT IGNORE INTO commission_agents (id, name)
SELECT UUID(), commission_agent 
FROM sales 
WHERE commission_agent IS NOT NULL AND commission_agent != ''
GROUP BY commission_agent;

-- 3. Add commission_agent_id FK to sales (keep old column for now)
ALTER TABLE sales ADD COLUMN commission_agent_id CHAR(36) DEFAULT NULL AFTER commission_agent;

-- 4. Link existing sales to the new commission_agents records
UPDATE sales s
JOIN commission_agents ca ON s.commission_agent = ca.name
SET s.commission_agent_id = ca.id
WHERE s.commission_agent IS NOT NULL AND s.commission_agent != '';
