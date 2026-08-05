"""星航数伴 StarFlight — Digital Human Backend with LangChain RAG
"""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from pathlib import Path
from typing import Any

import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

# -----------------------------------------------------------
# LangChain RAG (核心升级)
# -----------------------------------------------------------
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_openai import ChatOpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage

# ================================================================
#  Environment Loader
# ================================================================

def _load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

# -----------------------------------------------------------
#  Paths
# -----------------------------------------------------------
BASE_DIR      = Path(__file__).resolve().parent
PROJECT_ROOT  = BASE_DIR.parent
KB_DIR        = PROJECT_ROOT / "memory" / "scenic_kb"
VECTOR_DIR    = PROJECT_ROOT / "memory" / "faiss_index"
DB_PATH       = PROJECT_ROOT / "memory" / "conversations.db"

# -----------------------------------------------------------
#  Config (from .env / env vars)
# -----------------------------------------------------------
OPENAVATAR_BASE_URL      = os.getenv("OPENAVATAR_BASE_URL", "http://127.0.0.1:8282").rstrip("/")
CHAT_API_KEY             = os.getenv("CHAT_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
CHAT_BASE_URL            = (os.getenv("CHAT_BASE_URL")
                            or os.getenv("DASHSCOPE_BASE_URL")
                            or "https://dashscope.aliyuncs.com/compatible-mode/v1").rstrip("/")
CHAT_MODEL               = os.getenv("CHAT_MODEL", "qwen-turbo")
EMBEDDING_MODEL          = os.getenv("EMBEDDING_MODEL", "text-embedding-v1")
RAG_TOP_K                = int(os.getenv("RAG_TOP_K", "3"))
RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.55"))

API_PREFIX = "/api"

# ================================================================
#  Embedding – shared instance (DashScope OpenAI-compatible)
# ================================================================
_embeddings: OpenAIEmbeddings | None = None
_embeddings_init_attempted = False

def _ensure_api_key():
    """Fallback: set a placeholder so langchain-openai constructors don't crash."""
    if not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = "placeholder-offline-mode"

def _get_embeddings() -> OpenAIEmbeddings:
    """Get embeddings instance (DashScope OpenAI-compatible).

    Falls back to offline mode (returns None-like) if no API key.
    """
    global _embeddings, _embeddings_init_attempted
    if _embeddings is not None:
        return _embeddings
    if _embeddings_init_attempted:
        return None  # already tried and failed

    _embeddings_init_attempted = True
    if not CHAT_API_KEY:
        print("[Embed] No API key — vector store disabled, using offline fallback", flush=True)
        return None

    _ensure_api_key()
    try:
        _embeddings = OpenAIEmbeddings(
            model=EMBEDDING_MODEL,
            openai_api_key=CHAT_API_KEY,
            openai_api_base=CHAT_BASE_URL,
        )
        print(f"[Embed] Connected: model={EMBEDDING_MODEL}", flush=True)
    except Exception as exc:
        print(f"[Embed] Init failed: {exc} — offline fallback", flush=True)
        _embeddings = None
    return _embeddings

# ================================================================
#  SQLite – session & message persistence
# ================================================================

def _init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id  TEXT PRIMARY KEY,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            role        TEXT    NOT NULL CHECK(role IN ('user','assistant','system')),
            content     TEXT    NOT NULL,
            stage       TEXT    DEFAULT '',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS digital_humans (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        VARCHAR(120) NOT NULL,
            model_type  VARCHAR(40),
            model_url   VARCHAR(500),
            avatar_url  VARCHAR(500),
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print(f"[DB] SQLite ready: {DB_PATH}", flush=True)


_init_db()


def _save_message(session_id: str, role: str, content: str, stage: str = "") -> None:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO sessions (session_id) VALUES (?)", (session_id,))
    cur.execute(
        "INSERT INTO messages (session_id, role, content, stage) VALUES (?,?,?,?)",
        (session_id, role, content, stage),
    )
    cur.execute(
        "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
        (session_id,),
    )
    conn.commit()
    conn.close()


def _load_history(session_id: str, limit: int = 30) -> list[dict[str, Any]]:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT role, content, stage, created_at FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?",
        (session_id, limit),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

# ================================================================
#  Knowledge Base → LangChain Documents
# ================================================================

def _load_documents() -> list[Document]:
    docs: list[Document] = []

    # --- imported_chunks.json (structured scenic dataset) ---
    chunks_path = KB_DIR / "imported_chunks.json"
    if chunks_path.exists():
        data = json.loads(chunks_path.read_text("utf-8"))
        for doc in data.get("documents", []):
            for chunk in doc.get("chunks", []):
                title    = chunk.get("title", "")
                content  = chunk.get("content", "")
                keywords = ", ".join(chunk.get("keywords", []))
                stages   = ", ".join(chunk.get("stages", []))
                text = f"{title}\n{content}" if title else content
                docs.append(Document(
                    page_content=text,
                    metadata={
                        "source":   chunk.get("source", ""),
                        "chunk_id": chunk.get("id", ""),
                        "title":    title,
                        "keywords": keywords,
                        "stages":   stages,
                    },
                ))

    # --- lingshan_knowledge.json (facts overview) ---
    lingshan_path = KB_DIR / "lingshan_knowledge.json"
    if lingshan_path.exists():
        data = json.loads(lingshan_path.read_text("utf-8"))
        for fact in data.get("facts", []):
            title    = fact.get("title", "")
            content  = fact.get("content", "")
            keywords = ", ".join(fact.get("keywords", []))
            stages   = ", ".join(fact.get("stages", []))
            text = f"{title}\n{content}" if title else content
            docs.append(Document(
                page_content=text,
                metadata={
                    "source":   "lingshan_knowledge.json",
                    "chunk_id": fact.get("id", ""),
                    "title":    title,
                    "keywords": keywords,
                    "stages":   stages,
                },
            ))

    print(f"[RAG] Loaded {len(docs)} documents from knowledge base", flush=True)
    return docs

# ================================================================
#  FAISS Vector Store (build once → persist to disk)
# ================================================================

_vectordb: FAISS | None = None

def _get_vectordb() -> FAISS | None:
    global _vectordb
    if _vectordb is not None:
        return _vectordb

    embeddings = _get_embeddings()
    if embeddings is None:
        print("[RAG] No embeddings available — vector store disabled", flush=True)
        return None

    if VECTOR_DIR.exists() and (VECTOR_DIR / "index.faiss").exists():
        print("[RAG] Loading cached FAISS index ...", flush=True)
        _vectordb = FAISS.load_local(
            str(VECTOR_DIR), embeddings, allow_dangerous_deserialization=True
        )
        print(f"[RAG] Index loaded ({_vectordb.index.ntotal} vectors)", flush=True)
        return _vectordb

    print("[RAG] Building FAISS index (first run — embedding via API) ...", flush=True)
    documents = _load_documents()
    if not documents:
        print("[RAG] No KB documents — creating empty index", flush=True)
        _vectordb = FAISS.from_texts(["[placeholder]"], embeddings)
    else:
        _vectordb = FAISS.from_documents(documents, embeddings)

    VECTOR_DIR.mkdir(parents=True, exist_ok=True)
    _vectordb.save_local(str(VECTOR_DIR))
    print(f"[RAG] Index built & saved ({_vectordb.index.ntotal} vectors)", flush=True)
    return _vectordb

# ================================================================
#  LLM client (OpenAI-compatible → Qwen/DashScope)
# ================================================================

_llm: ChatOpenAI | None = None

def _get_llm() -> ChatOpenAI | None:
    global _llm
    if _llm is not None:
        return _llm
    if not CHAT_API_KEY or not CHAT_BASE_URL:
        print("[LLM] No API key configured — running in offline fallback mode", flush=True)
        return None

    _ensure_api_key()
    try:
        _llm = ChatOpenAI(
            model=CHAT_MODEL,
            openai_api_key=CHAT_API_KEY,
            openai_api_base=CHAT_BASE_URL,
            temperature=0.7,
            max_tokens=1024,
            streaming=False,
        )
        print(f"[LLM] Connected: {CHAT_BASE_URL}  model={CHAT_MODEL}", flush=True)
    except Exception as exc:
        print(f"[LLM] Init failed: {exc} — offline fallback", flush=True)
        _llm = None
    return _llm

# ================================================================
#  RAG Chat Pipeline
# ================================================================

def _rag_chat(user_message: str, stage: str, session_id: str) -> str:
    """Core RAG pipeline: retrieve relevant knowledge → augment prompt → generate reply."""

    # 1 ---- Retrieval (FAISS similarity search) ----
    relevant: list[Document] = []
    vectordb = _get_vectordb()
    if vectordb is not None:
        try:
            docs_with_scores = vectordb.similarity_search_with_score(user_message, k=RAG_TOP_K)
            for doc, score in docs_with_scores:
                if score > RAG_SIMILARITY_THRESHOLD:
                    continue
                if stage and doc.metadata.get("stages"):
                    doc_stages: str = doc.metadata["stages"]
                    if stage.strip() not in doc_stages.split(", "):
                        continue
                relevant.append(doc)
        except Exception as exc:
            print(f"[RAG] Search error: {exc}", flush=True)

    # 2 ---- LLM Generation ----
    llm = _get_llm()

    # 2a – RAG path: knowledge-grounded answer
    if relevant and llm:
        ctx_parts: list[str] = []
        for d in relevant[:3]:
            t = d.metadata.get("title", "")
            ctx_parts.append(f"【{t}】\n{d.page_content}")
        context = "\n\n---\n\n".join(ctx_parts)

        prompt = (
            f"你是「星航数伴」——一位专业的民航文旅数字人向导。\n"
            f"请严格依据以下【知识库】内容回答用户。如果知识库信息不足，可以结合常识进行适度补充，但不要编造景点信息。\n"
            f"回答需自然口语化、简洁明了，适合语音播报（控制在150字以内）。\n\n"
            f"【知识库】\n{context}\n\n"
            f"【当前阶段】{stage}\n"
            f"【用户问题】{user_message}"
        )
        try:
            resp = llm.invoke([
                SystemMessage(content="你是民航文旅数字人向导。"),
                HumanMessage(content=prompt),
            ])
            return resp.content.strip()
        except Exception as exc:
            print(f"[RAG] LLM error: {type(exc).__name__}: {exc}", flush=True)
            return relevant[0].page_content[:600]

    # 2b – General chat path (no relevant KB match)
    if llm:
        prompt = (
            f"你是「星航数伴」——一位专业的民航文旅数字人向导。\n"
            f"当前服务阶段：{stage}\n"
            f"用户问题：{user_message}\n"
            f"请用自然、简洁、口语化的中文回答，适合语音播报。"
        )
        try:
            resp = llm.invoke([
                SystemMessage(content="你是民航文旅数字人向导。"),
                HumanMessage(content=prompt),
            ])
            return resp.content.strip()
        except Exception as exc:
            print(f"[LLM] General chat error: {type(exc).__name__}: {exc}", flush=True)

    # 2c – Fully offline keyword fallback
    return _keyword_fallback(user_message)

# -----------------------------------------------------------
#  Keyword fallback (when LLM is unavailable)
# -----------------------------------------------------------
def _keyword_fallback(message: str) -> str:
    m = message or ""
    if any(w in m for w in ("航班", "机票", "登机", "机场")):
        return "好的，我可以帮你查询航班信息。请告诉我出发地、目的地和出行日期。"
    if any(w in m for w in ("景区", "路线", "讲解", "游玩", "灵山", "大佛", "景点")):
        return "没问题。我可以根据你的时间安排景区游玩路线，并提供重点景点讲解。"
    if any(w in m for w in ("返程", "回程", "回去")):
        return "收到。我会帮你规划返程交通衔接，确保不误机。"
    if any(w in m for w in ("你好", "嗨")):
        return "你好！我是星航数伴，你的民航文旅数字人向导。有什么可以帮你的吗？"
    return "收到。我可以帮你处理民航出行、景区讲解和返程安排，请随时告诉我你需要的服务。"

# ================================================================
#  Flask Application
# ================================================================

def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    # ---- Eager-init vector store at startup ----
    with app.app_context():
        try:
            print("[Init] Warming up vector store ...", flush=True)
            _get_vectordb()
            print("[Init] Vector store ready.", flush=True)
        except Exception as exc:
            print(f"[Init] Warning — vector store init failed (will retry on first request): {exc}", flush=True)

    # ---- Utility ----
    def ok(payload: dict, status_code: int = 200) -> Response:
        return jsonify(payload), status_code

    # ===================== Health & Status =====================

    @app.get(f"{API_PREFIX}/health")
    def _health():
        return ok({"online": True, "service": "starflight-backend"})

    @app.get(f"{API_PREFIX}/service/status")
    def _service_status():
        try:
            vs = _get_vectordb()
            vs_size = vs.index.ntotal if vs else 0
        except Exception:
            vs_size = 0
        return ok({
            "online": True,
            "ragEnabled": vs_size > 0,
            "vectorStoreSize": vs_size,
            "llmConfigured": bool(CHAT_API_KEY and CHAT_BASE_URL),
        })

    # ===================== OpenAvatar Proxy =====================

    def _openavatar_status() -> dict:
        try:
            r = requests.get(
                f"{OPENAVATAR_BASE_URL}/api/health",
                timeout=3,
                proxies={"http": None, "https": None},
            )
            return {"online": r.ok, "status": r.status_code}
        except Exception:
            return {"online": False, "status": 0}

    @app.get(f"{API_PREFIX}/openavatar/status")
    def _oa_status():
        return ok(_openavatar_status())

    @app.get(f"{API_PREFIX}/openavatar/config")
    def _oa_config():
        return ok({
            "online": _openavatar_status()["online"],
            "avatarUrl": OPENAVATAR_BASE_URL,
            "chatEndpoint": f"{API_PREFIX}/openavatar/chat",
            "connectEndpoint": f"{API_PREFIX}/openavatar/connect",
            "webrtcOfferEndpoint": f"{API_PREFIX}/openavatar/webrtc/offer",
        })

    @app.post(f"{API_PREFIX}/openavatar/connect")
    def _oa_connect():
        return ok(_openavatar_status())

    @app.post(f"{API_PREFIX}/openavatar/webrtc/offer")
    def _oa_webrtc():
        body = request.get_data()
        try:
            r = requests.post(
                f"{OPENAVATAR_BASE_URL}/webrtc/offer",
                data=body,
                headers={"Content-Type": request.content_type or "application/json"},
                timeout=10,
                proxies={"http": None, "https": None},
            )
            return Response(r.content, status=r.status_code, content_type=r.headers.get("Content-Type"))
        except Exception:
            return ok({"error": "openavatar unavailable"}, 503)

    @app.post(f"{API_PREFIX}/openavatar/chat")
    def _oa_chat():
        data = request.get_json(silent=True) or {}
        message = str(data.get("message") or data.get("text") or "").strip()
        stage = str(data.get("stage") or "")
        session_id = str(data.get("session_id") or str(uuid.uuid4()))

        _save_message(session_id, "user", message, stage)
        reply = _rag_chat(message, stage, session_id)
        _save_message(session_id, "assistant", reply, stage)

        # Best-effort OpenAvatar audio sync
        try:
            requests.post(
                f"{OPENAVATAR_BASE_URL}/chat",
                json={"text": reply, "message": reply},
                timeout=5,
                proxies={"http": None, "https": None},
            )
        except Exception:
            pass

        return ok({"reply": reply, "content": reply, "session_id": session_id})

    # ===================== Core Chat Endpoint =====================

    @app.post(f"{API_PREFIX}/digital-human/chat")
    def _digital_human_chat():
        data = request.get_json(silent=True) or {}
        message = str(data.get("message") or "").strip()
        stage = str(data.get("stage") or "")
        session_id = str(data.get("session_id") or str(uuid.uuid4()))

        if not message:
            return ok({
                "reply": "你好！我是星航数伴。请问有什么可以帮你的？",
                "content": "",
                "session_id": session_id,
            })

        _save_message(session_id, "user", message, stage)
        reply = _rag_chat(message, stage, session_id)
        _save_message(session_id, "assistant", reply, stage)

        return ok({"reply": reply, "content": reply, "session_id": session_id})

    # ===================== Conversation History (新增) =====================

    @app.get(f"{API_PREFIX}/history/<session_id>")
    def _conversation_history(session_id: str):
        messages = _load_history(session_id)
        return ok({
            "session_id": session_id,
            "messages": messages,
            "count": len(messages),
        })

    # ===================== Voice (placeholder) =====================

    @app.post(f"{API_PREFIX}/voice/transcribe")
    def _voice_transcribe():
        return ok({"text": ""})

    @app.post(f"{API_PREFIX}/voice/speech")
    def _voice_speech():
        return Response(b"", mimetype="audio/wav")

    return app


# ================================================================
#  Entry Point
# ================================================================
app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"\n{'='*60}")
    print(f"  StarFlight Backend  (LangChain RAG enabled)")
    print(f"  http://{host}:{port}")
    print(f"{'='*60}\n", flush=True)
    app.run(host=host, port=port, debug=False)
