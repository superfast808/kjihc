
-- Parent Portal Update Script

-- Table for magic login tokens
CREATE TABLE IF NOT EXISTS parent_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL
);

-- Add guardian policy confirmation if not exists
ALTER TABLE kjihc_members 
ADD COLUMN IF NOT EXISTS guardian_policy_confirmed DATETIME NULL;
