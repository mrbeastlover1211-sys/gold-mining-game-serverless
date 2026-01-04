-- Admin Gifts Table - Track all free rewards given by admins
-- This ensures complete transparency and prevents abuse

CREATE TABLE IF NOT EXISTS admin_gifts (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Admin who gave the gift
    admin_username TEXT NOT NULL,
    admin_ip TEXT,
    
    -- Recipient
    recipient_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    
    -- Gift details
    gold_amount NUMERIC(20, 4) DEFAULT 0 CHECK (gold_amount >= 0),
    pickaxe_type TEXT CHECK (pickaxe_type IN ('silver', 'gold', 'diamond', 'netherite', NULL)),
    pickaxe_quantity INTEGER DEFAULT 0 CHECK (pickaxe_quantity >= 0),
    
    -- Mining power calculation (for proper game balance)
    mining_power_added INTEGER DEFAULT 0,
    
    -- Reason and notes
    reason TEXT,
    notes TEXT,
    
    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'revoked')),
    revoked_at TIMESTAMP,
    revoked_by TEXT,
    revoke_reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_admin_gifts_recipient ON admin_gifts(recipient_address);
CREATE INDEX idx_admin_gifts_admin ON admin_gifts(admin_username);
CREATE INDEX idx_admin_gifts_created ON admin_gifts(created_at);
CREATE INDEX idx_admin_gifts_status ON admin_gifts(status);

-- Add comment
COMMENT ON TABLE admin_gifts IS 'Tracks all free rewards (gold and pickaxes) given by admins to users';
