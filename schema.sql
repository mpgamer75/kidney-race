-- =============================================
-- KIDNEY RACING CHAMPIONSHIP - SUPABASE SCHEMA
-- =============================================

-- Tabla de Sesiones de Juego
CREATE TABLE game_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    instructor_code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    current_question INTEGER DEFAULT 0,
    current_timer INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Jugadores
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    team_index INTEGER CHECK (team_index >= 0 AND team_index <= 4),
    score INTEGER DEFAULT 0,
    is_connected BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, username)
);

-- Tabla de Respuestas
CREATE TABLE player_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    selected_option INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time INTEGER NOT NULL, -- en milisegundos
    points_earned INTEGER DEFAULT 0,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Puntuaciones por Equipo
CREATE TABLE team_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    team_index INTEGER CHECK (team_index >= 0 AND team_index <= 4),
    total_score INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, team_index)
);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para game_sessions
CREATE TRIGGER update_game_sessions_updated_at 
    BEFORE UPDATE ON game_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para team_scores
CREATE TRIGGER update_team_scores_updated_at 
    BEFORE UPDATE ON team_scores 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- POLÍTICAS RLS (Row Level Security)
-- =============================================

-- Habilitar RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_scores ENABLE ROW LEVEL SECURITY;

-- Políticas para game_sessions (todos pueden leer, solo instructores pueden modificar)
CREATE POLICY "Anyone can read game sessions" 
    ON game_sessions FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can create game sessions" 
    ON game_sessions FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Anyone can update game sessions" 
    ON game_sessions FOR UPDATE 
    USING (true);

-- Políticas para players
CREATE POLICY "Anyone can read players" 
    ON players FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can insert players" 
    ON players FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Players can update themselves" 
    ON players FOR UPDATE 
    USING (true);

-- Políticas para player_answers
CREATE POLICY "Anyone can read answers" 
    ON player_answers FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can insert answers" 
    ON player_answers FOR INSERT 
    WITH CHECK (true);

-- Políticas para team_scores
CREATE POLICY "Anyone can read team scores" 
    ON team_scores FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can modify team scores" 
    ON team_scores FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Anyone can update team scores" 
    ON team_scores FOR UPDATE 
    USING (true);

-- =============================================
-- FUNCIONES HELPER
-- =============================================

-- Función para generar código de instructor
CREATE OR REPLACE FUNCTION generate_instructor_code()
RETURNS TEXT AS $$
BEGIN
    RETURN UPPER(
        CHR(65 + FLOOR(RANDOM() * 26)::INT) ||
        CHR(65 + FLOOR(RANDOM() * 26)::INT) ||
        CHR(65 + FLOOR(RANDOM() * 26)::INT) ||
        FLOOR(RANDOM() * 10)::TEXT ||
        FLOOR(RANDOM() * 10)::TEXT ||
        FLOOR(RANDOM() * 10)::TEXT
    );
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar puntuación de equipo
CREATE OR REPLACE FUNCTION update_team_score(p_session_id UUID, p_team_index INTEGER, p_points INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO team_scores (session_id, team_index, total_score)
    VALUES (p_session_id, p_team_index, p_points)
    ON CONFLICT (session_id, team_index)
    DO UPDATE SET 
        total_score = team_scores.total_score + p_points,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DATOS INICIALES (OPCIONAL)
-- =============================================

-- Insertar una sesión de prueba
-- INSERT INTO game_sessions (instructor_code, status) 
-- VALUES (generate_instructor_code(), 'waiting');

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista de estadísticas por equipo
CREATE VIEW team_stats AS
SELECT 
    gs.id as session_id,
    gs.instructor_code,
    ts.team_index,
    CASE ts.team_index
        WHEN 0 THEN '🔴 RIÑÓN ROJO'
        WHEN 1 THEN '🔵 AZUL NEFRÓN'
        WHEN 2 THEN '🟡 AMARILLO FILTRO'
        WHEN 3 THEN '🟢 VERDE HOMEOSTASIS'
        WHEN 4 THEN '🟣 PÚRPURA UREA'
    END as team_name,
    COALESCE(ts.total_score, 0) as total_score,
    COUNT(p.id) as player_count,
    ARRAY_AGG(p.username ORDER BY p.joined_at) as players
FROM game_sessions gs
LEFT JOIN team_scores ts ON gs.id = ts.session_id
LEFT JOIN players p ON gs.id = p.session_id AND ts.team_index = p.team_index
GROUP BY gs.id, gs.instructor_code, ts.team_index, ts.total_score
ORDER BY gs.id, ts.team_index;

-- Vista de leaderboard
CREATE VIEW leaderboard AS
SELECT 
    session_id,
    team_index,
    team_name,
    total_score,
    player_count,
    players,
    RANK() OVER (PARTITION BY session_id ORDER BY total_score DESC) as position
FROM team_stats
WHERE player_count > 0
ORDER BY session_id, total_score DESC;