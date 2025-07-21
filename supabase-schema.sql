-- Create PvP Wheel Database Schema
-- This schema supports the wheel game with players, games, and gift system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table to store user information
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    photo_url TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    language_code VARCHAR(10),
    total_games_played INTEGER DEFAULT 0,
    total_games_won INTEGER DEFAULT 0,
    total_ton_won DECIMAL(10, 6) DEFAULT 0,
    total_gifts_won INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table to store game sessions
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roll_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, spinning, completed, cancelled
    countdown_ends_at TIMESTAMP WITH TIME ZONE, -- when the countdown should end
    total_players INTEGER DEFAULT 0,
    total_pot_balance DECIMAL(10, 6) DEFAULT 0,
    total_gift_value DECIMAL(10, 6) DEFAULT 0,
    winner_id UUID REFERENCES players(id),
    winner_chance DECIMAL(5, 2), -- percentage with 2 decimal places
    spin_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Game participants table (junction table)
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),
    balance DECIMAL(10, 6) DEFAULT 0,
    gift_value DECIMAL(10, 6) DEFAULT 0,
    color VARCHAR(7) NOT NULL, -- hex color code
    position_index INTEGER NOT NULL,
    chance_percentage DECIMAL(5, 2),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

-- Gifts table to define available gifts
CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    emoji VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    base_value DECIMAL(10, 6) NOT NULL,
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    is_active BOOLEAN DEFAULT TRUE,
    is_nft BOOLEAN DEFAULT FALSE,
    nft_address VARCHAR(255), -- TON NFT collection address
    nft_item_id VARCHAR(255), -- Specific NFT item ID (optional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player gifts inventory
CREATE TABLE IF NOT EXISTS player_gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    gift_id UUID NOT NULL REFERENCES gifts(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    total_value DECIMAL(10, 6) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, gift_id)
);

-- Game participant gifts (gifts used in specific games)
CREATE TABLE IF NOT EXISTS game_participant_gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_participant_id UUID NOT NULL REFERENCES game_participants(id) ON DELETE CASCADE,
    gift_id UUID NOT NULL REFERENCES gifts(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    value_per_gift DECIMAL(10, 6) NOT NULL,
    total_value DECIMAL(10, 6) NOT NULL
);

-- NFT deposits tracking table (Telegram-based)
CREATE TABLE IF NOT EXISTS nft_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    telegram_username VARCHAR(255) NOT NULL,
    message_content TEXT,
    nft_gifts_description TEXT, -- Description of NFT gifts being deposited
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'processed')),
    processed_by UUID REFERENCES players(id), -- Admin who processed the request
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT, -- Admin notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game logs for tracking game events
CREATE TABLE IF NOT EXISTS game_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id),
    log_type VARCHAR(20) NOT NULL CHECK (log_type IN ('join', 'spin', 'winner', 'info')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_telegram_id ON players(telegram_id);
CREATE INDEX IF NOT EXISTS idx_games_roll_number ON games(roll_number);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_player_id ON game_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_player_gifts_player_id ON player_gifts(player_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON game_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_nft_deposits_player_id ON nft_deposits(player_id);
CREATE INDEX IF NOT EXISTS idx_nft_deposits_telegram_username ON nft_deposits(telegram_username);
CREATE INDEX IF NOT EXISTS idx_nft_deposits_status ON nft_deposits(status);
CREATE INDEX IF NOT EXISTS idx_nft_deposits_created_at ON nft_deposits(created_at);

-- Insert default gifts
INSERT INTO gifts (emoji, name, base_value, rarity, is_nft, nft_address) VALUES
('🎁', 'Gift Box', 0.1, 'common', FALSE, NULL),
('💎', 'Diamond', 0.5, 'rare', FALSE, NULL),
('⭐', 'Star', 0.3, 'common', FALSE, NULL),
('👑', 'Crown', 1.0, 'epic', FALSE, NULL),
('🏆', 'Trophy', 2.0, 'legendary', FALSE, NULL),
('💰', 'Money Bag', 0.8, 'epic', FALSE, NULL),
('🎊', 'Confetti', 0.2, 'common', FALSE, NULL),
('🚀', 'Rocket', 1.5, 'legendary', FALSE, NULL),
('🎪', 'Circus', 0.4, 'rare', FALSE, NULL),
('🌟', 'Golden Star', 0.6, 'rare', FALSE, NULL),
('💫', 'Shooting Star', 1.2, 'epic', FALSE, NULL),
('🎯', 'Target', 0.7, 'rare', FALSE, NULL),
('🎨', 'Art Palette', 0.9, 'epic', FALSE, NULL),
('🎭', 'Theater Mask', 0.5, 'rare', FALSE, NULL),
('🎪', 'Carnival', 1.8, 'legendary', FALSE, NULL),
('🦄', 'Unicorn NFT', 5.0, 'legendary', TRUE, 'EQD...example'),
('🐉', 'Dragon NFT', 3.5, 'epic', TRUE, 'EQD...example'),
('🎮', 'Gaming NFT', 1.8, 'rare', TRUE, 'EQD...example')
ON CONFLICT (emoji) DO NOTHING;

-- Function to update player stats after game completion
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total games played for all participants
    UPDATE players 
    SET total_games_played = total_games_played + 1,
        updated_at = NOW()
    WHERE id IN (
        SELECT player_id FROM game_participants WHERE game_id = NEW.id
    );
    
    -- Update winner stats if there's a winner
    IF NEW.winner_id IS NOT NULL THEN
        UPDATE players 
        SET total_games_won = total_games_won + 1,
            total_ton_won = total_ton_won + NEW.total_gift_value,
            updated_at = NOW()
        WHERE id = NEW.winner_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update player stats when game is completed
CREATE TRIGGER update_player_stats_trigger
    AFTER UPDATE ON games
    FOR EACH ROW
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION update_player_stats();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_gifts_updated_at BEFORE UPDATE ON player_gifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies can be added here if needed
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE games ENABLE ROW LEVEL SECURITY;
-- etc.
