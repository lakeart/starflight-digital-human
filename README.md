# StarFlight Digital Human — Civil Aviation & Tourism AI Guide

> **Level**: A-Tier Auxiliary Project  
> **Origin**: Course Project / Innovation Competition  
> **Domain**: Digital Human · LLM · RAG · 3D Avatar · React Frontend  
> **Stack**: React 18 + TypeScript + Vite · Flask + LangChain + Qwen · OpenAvatarChat 3D Engine  

---

## One-Liner

An interactive 3D digital human kiosk for civil aviation and cultural tourism scenarios — combining LLM-driven conversation, RAG-based knowledge retrieval, and real-time 3D avatar rendering.

---

## Features

| Module | Technology | Description |
|--------|-----------|-------------|
| 🗣️ **LLM Dialog** | Qwen-Turbo (DashScope) + LangChain | Multi-turn contextual conversation with aviation/tourism domain knowledge |
| 📚 **Knowledge Base** | RAG (Retrieval-Augmented Generation) | Domain-specific scenic spot information and airport service knowledge |
| 🎭 **3D Avatar** | OpenAvatarChat (Unity + WebSocket) | Real-time facial animation driven by audio |
| 🔊 **TTS** | DashScope Multi-modal | Streaming text-to-speech with natural prosody |
| 🖥️ **Frontend** | React + TypeScript + Vite | Modular component-based UI with chat interface and avatar display |

---

## Architecture

```
┌──────────────────────────────────────┐
│           Frontend (React + Vite)     │
│  ┌────────┐ ┌──────┐ ┌───────────┐  │
│  │ Chat   │ │ TTS  │ │ 3D Avatar │  │
│  │ Panel  │ │Ctrl  │ │  Viewer   │  │
│  └────────┘ └──────┘ └───────────┘  │
│       WebSocket  │  HTTP REST        │
└──────────────────┼───────────────────┘
                   │
┌──────────────────┴───────────────────┐
│        Backend (Flask + LangChain)    │
│  ┌──────────┐ ┌──────┐ ┌─────────┐  │
│  │ LLM      │ │ RAG  │ │ Dialog  │  │
│  │ Chain    │ │Retri │ │ Mgr     │  │
│  └──────────┘ └──────┘ └─────────┘  │
│         DashScope API                 │
└──────────────────┬───────────────────┘
                   │
┌──────────────────┴───────────────────┐
│    OpenAvatarChat (Unity 3D Engine)   │
│  Facial Animation · Audio2Face · WSS  │
└──────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Unity 2021+ (for OpenAvatarChat 3D engine)
- [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) (3D avatar engine, install separately)
- DashScope API key (for LLM + TTS, [get one here](https://dashscope.aliyun.com/))

### Installation

```bash
git clone https://github.com/lakeart/starflight-digital-human.git
cd starflight-digital-human

# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ..
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env:
#   CHAT_PROVIDER=mock  (or 'qwen' with CHAT_API_KEY=DASHSCOPE_KEY)
#   DASHSCOPE_API_KEY=sk-xxxxx
#   OPENAVATAR_PROJECT_DIR=<your-openavatar-install-path>
```

### Run

```bash
# Start backend (Flask + LLM pipeline)
start-backend.cmd          # Windows
# Terminal 1: python backend/app.py

# Start frontend (React app)
start.cmd                  # Windows
# Terminal 2: npm run dev
```

### Mock Mode

Set `CHAT_PROVIDER=mock` in `.env` for development without API key — the system returns predefined responses from the knowledge base.

---

## Origin

This project was developed for a university innovation competition, demonstrating the integration of large language models with real-time 3D digital human technology for civil aviation and cultural tourism guidance applications.

## Personal Contributions

- **Frontend architecture**: Designed and implemented the React 18 + TypeScript + Vite modular frontend with chat interface, 3D avatar container, and TTS controls
- **Backend pipeline**: Built Flask API server with LangChain-based LLM integration, RAG knowledge retrieval, and WebSocket proxy for OpenAvatarChat communication
- **Domain knowledge base**: Curated scenic spot information and airport service workflows as the RAG document corpus
- **System integration**: Integrated DashScope LLM/TTS APIs, OpenAvatarChat 3D engine, and frontend-backend communication

## Third-Party Components

| Component | Purpose | License |
|-----------|---------|---------|
| OpenAvatarChat | 3D digital human engine (Audio2Face, real-time rendering) | Apache 2.0 |
| Qwen-Turbo (DashScope) | LLM conversation engine | Commercial API |
| DashScope TTS | Streaming text-to-speech | Commercial API |
| LangChain | LLM chain orchestration, RAG pipeline | MIT |
| React + Vite | Frontend framework | MIT |
| Flask | Backend API server | BSD-3 |

## Known Limitations

1. **3D engine not included**: OpenAvatarChat is a separate installation (~840MB models), provided as a third-party dependency
2. **API key required**: Full LLM and TTS functionality requires a DashScope API key; mock mode provides limited offline capability
3. **WebSocket stability**: OpenAvatarChat WebSocket connection may be unstable in certain network environments
4. **Low end-to-end reference rate**: Real-time 3D rendering coupled with LLM streaming inference can cause high latency on consumer hardware
5. **Platform-specific**: Current OpenAvatarChat build is Windows-only (Unity + .dll dependencies)

---

## Repository Info

| Field | Value |
|-------|-------|
| **Repo Name** | `starflight-digital-human` |
| **Chinese Title** | 星航数伴——民航文旅数字人导览系统 |
| **One-liner (EN)** | Interactive 3D digital human kiosk for civil aviation, powered by LLM + RAG + OpenAvatarChat |
| **GitHub Topics** | `digital-human` `llm` `rag` `react` `flask` `3d-avatar` `langchain` `dashscope` `typescript` |
| **Gitee Tags** | `数字人` `大模型` `知识库` `3D` `React` `Python` |
| **Pin** | ❌ No (auxiliary) |
| **License** | MIT |
