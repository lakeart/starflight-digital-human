-- ============================================================
-- StarFlight Database Schema
-- SQLite dialect (persisted in memory/conversations.db)
-- ============================================================

-- Conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages (RAG conversation history)
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK(role IN ('user','assistant','system')),
    content     TEXT    NOT NULL,
    stage       TEXT    DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- 3D Digital Human avatar records
CREATE TABLE IF NOT EXISTS digital_humans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        VARCHAR(120) NOT NULL,
    model_type  VARCHAR(40),
    model_url   VARCHAR(500),
    avatar_url  VARCHAR(500),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast history queries
CREATE INDEX IF NOT EXISTS idx_messages_session
    ON messages(session_id, id);

-- ============================================================
-- Note: This schema is also auto-applied by app.py _init_db().
-- For production, use sqlite3 CLI:
--   sqlite3 memory/conversations.db < backend/schema.sql
-- ============================================================
