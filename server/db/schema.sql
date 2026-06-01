-- ============================================================
-- PATHOTRIVIA — Schema PostgreSQL completo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ADMINISTRADOR
-- ============================================================
CREATE TABLE admins (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,   -- bcrypt hash
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. TIPOS DE PREGUNTA
-- ============================================================
CREATE TYPE question_type AS ENUM (
    'multiple_choice',
    'true_false',
    'type_answer',
    'puzzle',
    'poll',
    'word_cloud',
    'slider',
    'brainstorm',
    'drop_pin',
    'matching'
);

-- ============================================================
-- 3. BANCOS DE PREGUNTAS
-- ============================================================
CREATE TABLE quizzes (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    cover_image  TEXT,
    admin_id     INT          NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. PREGUNTAS
-- ============================================================
CREATE TABLE questions (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id         UUID          NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    type            question_type NOT NULL,
    position        INT           NOT NULL DEFAULT 0,
    question_text   TEXT          NOT NULL,
    media_url       TEXT,
    time_limit_sec  INT           NOT NULL DEFAULT 20,
    points          INT           NOT NULL DEFAULT 1000,
    -- Slider
    slider_min      NUMERIC,
    slider_max      NUMERIC,
    slider_correct  NUMERIC,
    -- Drop Pin
    pin_x           NUMERIC,
    pin_y           NUMERIC,
    -- Retroalimentación (se muestra al jugador tras revelar resultados)
    explanation     TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. OPCIONES DE RESPUESTA
-- ============================================================
CREATE TABLE question_options (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT    NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    position    INT     NOT NULL DEFAULT 0,
    match_group CHAR(1)             -- 'A' o 'B' para matching
);

-- ============================================================
-- 6. SESIONES DE JUEGO
-- ============================================================
CREATE TABLE game_sessions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id      UUID        NOT NULL REFERENCES quizzes(id),
    pin          VARCHAR(8)  NOT NULL UNIQUE,
    status       VARCHAR(20) NOT NULL DEFAULT 'waiting',
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_pin    ON game_sessions(pin);
CREATE INDEX idx_sessions_status ON game_sessions(status);

-- ============================================================
-- 7. JUGADORES
-- ============================================================
CREATE TABLE players (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    nickname    VARCHAR(50) NOT NULL,
    avatar      VARCHAR(100),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    final_score INT         NOT NULL DEFAULT 0,
    final_rank  INT,
    UNIQUE (session_id, nickname)
);

CREATE INDEX idx_players_session ON players(session_id);

-- ============================================================
-- 8. RESPUESTAS DE JUGADORES
-- ============================================================
CREATE TABLE player_answers (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID        NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id        UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    question_id      UUID        NOT NULL REFERENCES questions(id),
    answer_option_id UUID        REFERENCES question_options(id),
    answer_text      TEXT,
    answer_numeric   NUMERIC,
    answer_pin_x     NUMERIC,
    answer_pin_y     NUMERIC,
    is_correct       BOOLEAN,
    points_earned    INT         NOT NULL DEFAULT 0,
    response_time_ms INT,
    answered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_answers_session  ON player_answers(session_id);
CREATE INDEX idx_answers_player   ON player_answers(player_id);
CREATE INDEX idx_answers_question ON player_answers(question_id);

-- ============================================================
-- 9. ESTADÍSTICAS POR PREGUNTA
-- ============================================================
CREATE TABLE session_question_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(id),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    total_answers   INT NOT NULL DEFAULT 0,
    correct_answers INT NOT NULL DEFAULT 0,
    UNIQUE (session_id, question_id)
);

-- ============================================================
-- 10. TRIGGER updated_at en quizzes
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quizzes_updated_at
    BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

