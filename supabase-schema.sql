-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table: players
CREATE TABLE IF NOT EXISTS public.players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id bigint UNIQUE NOT NULL,
    username text,
    first_name text,
    last_name text,
    photo_url text,
    last_active timestamp with time zone DEFAULT now(),
    total_games_played integer DEFAULT 0,
    total_games_won integer DEFAULT 0,
    total_ton_won numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: games
CREATE TABLE IF NOT EXISTS public.games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_number bigint UNIQUE NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    total_pot_balance numeric DEFAULT 0 NOT NULL,
    total_players integer DEFAULT 0 NOT NULL,
    winner_player_id uuid REFERENCES public.players(id),
    winner_chance numeric,
    countdown_ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

-- Table: game_participants
CREATE TABLE IF NOT EXISTS public.game_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_name text NOT NULL, -- Store player name for historical purposes
    gift_value numeric DEFAULT 0 NOT NULL,
    chance_percentage numeric DEFAULT 0 NOT NULL,
    color text,
    position integer,
    gifts_array text[] DEFAULT '{}'::text[] NOT NULL, -- Array of gift emojis
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (game_id, player_id)
);

-- Table: gifts
CREATE TABLE IF NOT EXISTS public.gifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    emoji text UNIQUE NOT NULL,
    name text UNIQUE NOT NULL,
    base_value numeric NOT NULL,
    rarity text NOT NULL,
    nft_address text,
    nft_item_id text,
    is_nft boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: player_gifts (Inventory)
CREATE TABLE IF NOT EXISTS public.player_gifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    gift_id uuid NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
    quantity integer DEFAULT 0 NOT NULL,
    UNIQUE (player_id, gift_id)
);

-- Table: game_participant_gifts (Detailed gifts for each participant in a game)
CREATE TABLE IF NOT EXISTS public.game_participant_gifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_participant_id uuid NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
    gift_id uuid NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    total_value numeric NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: game_logs
CREATE TABLE IF NOT EXISTS public.game_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
    log_type text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: match_history
CREATE TABLE IF NOT EXISTS public.match_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    roll_number bigint NOT NULL,
    winner_player_id uuid NOT NULL REFERENCES public.players(id),
    winner_name text NOT NULL,
    winner_chance numeric NOT NULL,
    total_pot numeric NOT NULL,
    players_snapshot jsonb NOT NULL,
    timestamp timestamp with time zone DEFAULT now() NOT NULL
);

-- Function to recalculate chances for all participants in a game
CREATE OR REPLACE FUNCTION public.recalculate_game_chances(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_pot_value numeric := 0;
    v_total_players integer := 0;
BEGIN
    -- Calculate total pot value and total players for the game
    SELECT
        COALESCE(SUM(gp.gift_value), 0),
        COUNT(gp.id)
    INTO
        v_total_pot_value,
        v_total_players
    FROM
        public.game_participants gp
    WHERE
        gp.game_id = p_game_id;

    -- Update chance_percentage for each participant
    UPDATE public.game_participants gp
    SET
        chance_percentage = CASE
            WHEN v_total_pot_value > 0 THEN (gp.gift_value / v_total_pot_value) * 100
            ELSE 0
        END
    WHERE
        gp.game_id = p_game_id;

    -- Update total_pot_balance and total_players in the games table
    UPDATE public.games
    SET
        total_pot_balance = v_total_pot_value,
        total_players = v_total_players
    WHERE
        id = p_game_id;
END;
$$;

-- RPC function to add gifts to a game (handles new participants and existing ones)
CREATE OR REPLACE FUNCTION public.add_gifts_to_game(
    p_game_id uuid,
    p_player_id uuid,
    p_gift_selections jsonb, -- Array of { giftId: uuid, quantity: integer, totalValue: numeric }
    p_player_color text,
    p_player_position integer,
    p_player_name text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_game_participant_id uuid;
    v_current_gift_value numeric := 0;
    v_current_gifts_array text[] := '{}';
    v_gift_selection jsonb;
    v_gift_id uuid;
    v_quantity integer;
    v_total_value numeric;
    v_gift_emoji text;
    v_participant_count integer;
BEGIN
    -- Check if the player is already a participant in this game
    SELECT id, gift_value, gifts_array
    INTO v_game_participant_id, v_current_gift_value, v_current_gifts_array
    FROM public.game_participants
    WHERE game_id = p_game_id AND player_id = p_player_id;

    IF v_game_participant_id IS NULL THEN
        -- Player is new to this game, insert a new participant record
        INSERT INTO public.game_participants (game_id, player_id, player_name, gift_value, color, position, gifts_array)
        VALUES (p_game_id, p_player_id, p_player_name, 0, p_player_color, p_player_position, '{}')
        RETURNING id INTO v_game_participant_id;
    END IF;

    -- Loop through gift selections and process them
    FOR v_gift_selection IN SELECT * FROM jsonb_array_elements(p_gift_selections)
    LOOP
        v_gift_id := (v_gift_selection->>'giftId')::uuid;
        v_quantity := (v_gift_selection->>'quantity')::integer;
        v_total_value := (v_gift_selection->>'totalValue')::numeric;

        -- Get gift emoji for gifts_array
        SELECT emoji INTO v_gift_emoji FROM public.gifts WHERE id = v_gift_id;

        -- Update game_participant_gifts
        INSERT INTO public.game_participant_gifts (game_participant_id, gift_id, quantity, total_value)
        VALUES (v_game_participant_id, v_gift_id, v_quantity, v_total_value)
        ON CONFLICT (game_participant_id, gift_id) DO UPDATE
        SET
            quantity = public.game_participant_gifts.quantity + EXCLUDED.quantity,
            total_value = public.game_participant_gifts.total_value + EXCLUDED.total_value,
            added_at = now();

        -- Update player_gifts (decrement quantity from player's inventory)
        UPDATE public.player_gifts
        SET quantity = quantity - v_quantity
        WHERE player_id = p_player_id AND gift_id = v_gift_id;

        -- Add emoji to the gifts_array for the game_participant
        FOR i IN 1..v_quantity LOOP
            v_current_gifts_array := array_append(v_current_gifts_array, v_gift_emoji);
        END LOOP;

        -- Update the total gift value for the participant
        v_current_gift_value := v_current_gift_value + v_total_value;
    END LOOP;

    -- Update the game_participant record with new total gift value and gifts array
    UPDATE public.game_participants
    SET
        gift_value = v_current_gift_value,
        gifts_array = v_current_gifts_array
    WHERE id = v_game_participant_id;

    -- Recalculate chances for all participants in the game
    PERFORM public.recalculate_game_chances(p_game_id);

    -- Check if we need to start countdown (2+ players)
    SELECT COUNT(*) INTO v_participant_count
    FROM public.game_participants
    WHERE game_id = p_game_id;

    IF v_participant_count >= 2 THEN
        -- Start countdown if not already started
        UPDATE public.games
        SET countdown_ends_at = COALESCE(countdown_ends_at, now() + interval '60 seconds')
        WHERE id = p_game_id AND countdown_ends_at IS NULL;
    END IF;

    -- Add a log entry for the gift addition
    INSERT INTO public.game_logs (game_id, player_id, log_type, message)
    VALUES (p_game_id, p_player_id, 'join', p_player_name || ' добавил подарки на сумму ' || v_current_gift_value::text || ' TON!');
END;
$$;

-- Initial data for gifts (if not already present)
INSERT INTO public.gifts (emoji, name, base_value, rarity, is_nft) VALUES
('🎁', 'Обычный Подарок', 0.01, 'common', false) ON CONFLICT (emoji) DO NOTHING,
('💎', 'Редкий Алмаз', 0.05, 'rare', false) ON CONFLICT (emoji) DO NOTHING,
('⭐', 'Эпическая Звезда', 0.1, 'epic', false) ON CONFLICT (emoji) DO NOTHING,
('👑', 'Легендарная Корона', 0.5, 'legendary', false) ON CONFLICT (emoji) DO NOTHING;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_telegram_user_id ON public.players(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_roll_number ON public.games(roll_number);
CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON public.game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_player_id ON public.game_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_player_gifts_player_id ON public.player_gifts(player_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON public.game_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_match_history_timestamp ON public.match_history(timestamp DESC);
