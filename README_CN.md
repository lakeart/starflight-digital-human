# 星航数伴——民航文旅数字人导览系统

> **项目级别**：A 级辅助项目  
> **项目来源**：课程设计 / 创新竞赛  
> **核心领域**：数字人 · 大语言模型 · 知识库检索 · 3D 虚拟人  
> **技术栈**：React 18 + TypeScript + Vite · Flask + LangChain + Qwen · OpenAvatarChat  

---

## 一句话介绍

面向民航机场和文旅场景的交互式 3D 数字人导览系统，集成大语言模型对话、RAG 知识库检索和实时 3D 虚拟人渲染。

---

## 功能模块

| 模块 | 技术 | 说明 |
|------|------|------|
| 🗣️ **LLM 对话** | Qwen-Turbo + LangChain | 多轮上下文对话，航空/文旅领域知识 |
| 📚 **知识库** | RAG 检索增强生成 | 景点信息和机场服务知识 |
| 🎭 **3D 虚拟人** | OpenAvatarChat (Unity + WebSocket) | 音频驱动实时面部动画 |
| 🔊 **TTS** | DashScope 多模态 | 流式语音合成 |
| 🖥️ **前端** | React + TypeScript + Vite | 模块化组件，对话界面 + 虚拟人视窗 |

---

## 系统架构

```
┌──────────────────────────────┐
│    前端 (React + Vite)        │
│  对话面板 · TTS · 3D视窗      │
└──────────┬───────────────────┘
     WebSocket │ HTTP
┌─────────────┴────────────────┐
│    后端 (Flask + LangChain)   │
│  LLM链 · RAG · 对话管理       │
│      DashScope API            │
└─────────────┬────────────────┘
              │
┌─────────────┴────────────────┐
│  OpenAvatarChat (Unity3D)     │
│  面部动画 · Audio2Face        │
└──────────────────────────────┘
```

---

## 快速开始

### 前置条件

- Node.js 18+, Python 3.10+
- Unity 2021+ (用于 OpenAvatarChat 3D 引擎)
- [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat)（3D 引擎，需单独安装）
- [DashScope API Key](https://dashscope.aliyun.com/)

### 安装

```bash
git clone https://gitee.com/lakeart/starflight-digital-human.git
cd starflight-digital-human

# 后端
cd backend
pip install -r requirements.txt

# 前端
cd ..
npm install
```

### 配置

```bash
cp .env.example .env
# 编辑 .env：
#   CHAT_PROVIDER=mock  (开发模式，免API) 或 'qwen' + CHAT_API_KEY
#   DASHSCOPE_API_KEY=sk-xxxxx
#   OPENAVATAR_PROJECT_DIR=<你的OpenAvatar安装路径>
```

### 运行

```bash
start-backend.cmd          # 终端1: python backend/app.py
start.cmd                  # 终端2: npm run dev
```

### Mock 模式

设置 `CHAT_PROVIDER=mock`，无需 API Key 即可运行——系统从知识库返回预置回答。

---

## 项目来源

本项目为大学创新竞赛作品，展示了大语言模型与实时 3D 数字人技术在民航机场和文旅导览场景中的集成应用。

## 个人贡献

- **前端架构**：设计和实现 React 18 + TypeScript + Vite 模块化前端，包含对话界面、3D 虚拟人容器和 TTS 控制
- **后端管道**：构建 Flask API 服务，集成 LangChain LLM 链、RAG 知识库检索和 OpenAvatarChat WebSocket 代理
- **领域知识库**：整理景区信息和机场服务流程作为 RAG 文档语料
- **系统集成**：打通 DashScope LLM/TTS API、OpenAvatarChat 3D 引擎和前后端通信

## 第三方组件

| 组件 | 用途 | 许可证 |
|------|------|--------|
| OpenAvatarChat | 3D 数字人引擎 | Apache 2.0 |
| Qwen-Turbo (DashScope) | LLM 对话推理 | 商业API |
| DashScope TTS | 流式语音合成 | 商业API |
| LangChain | LLM 编排 + RAG | MIT |
| React + Vite | 前端框架 | MIT |
| Flask | 后端 API | BSD-3 |

## 已知限制

1. **3D 引擎需单独安装**：OpenAvatarChat（含 ~840MB 模型）未包含在仓库中
2. **API Key 依赖**：完整 LLM 和 TTS 功能需 DashScope API 密钥；Mock 模式提供有限离线能力
3. **WebSocket 稳定性**：OpenAvatarChat WebSocket 连接在某些网络环境下可能不稳定
4. **端到端延迟**：实时 3D 渲染 + LLM 流式推理在消费级硬件上可能产生较高延迟
5. **平台限制**：当前 OpenAvatarChat 构建仅支持 Windows

---

## 秋招简历描述（3条）

1. **数字人交互系统**：构建面向民航场景的 3D 数字人导览系统，前端使用 React 18 + TypeScript + Vite，后端使用 Flask + LangChain，集成 Qwen-Turbo 大模型实现多轮对话和 RAG 知识库检索。

2. **多模态系统集成**：打通 DashScope LLM 推理、流式 TTS 合成和 OpenAvatarChat 3D 引擎的实时 WebSocket 通信链路，实现"语音输入→LLM分析→语音输出→面部动画"全链路处理。

3. **领域知识库构建**：基于 LangChain RAG 框架构建民航和文旅领域知识库，实现了文档切片、向量存储和语义检索的完整知识管理流程。

---

## 港新硕士申请项目介绍（英文）

**StarFlight: An LLM-Driven 3D Digital Human for Civil Aviation and Cultural Tourism**

This project explores the intersection of large language models, 3D avatar technology, and domain-specific knowledge retrieval. It builds an interactive digital human kiosk for airport and tourism guidance, integrating a React/TypeScript frontend with a Flask/Python backend, Qwen-Turbo LLM via DashScope API, and the OpenAvatarChat Unity-based 3D rendering engine.

Technically, the system demonstrates multi-modal pipeline integration: user speech → LLM conversation with RAG-augmented context → TTS voice synthesis → Audio2Face-driven avatar animation — all coordinated through a WebSocket-based real-time communication layer. The project showcases my ability to architect end-to-end AI application systems that span frontend, backend, model serving, and 3D rendering domains.

Repository: [github.com/lakeart/starflight-digital-human](https://github.com/lakeart/starflight-digital-human)

---

## 仓库信息

| 项目 | 内容 |
|------|------|
| **推荐仓库名** | `starflight-digital-human` |
| **中文名称** | 星航数伴——民航文旅数字人导览系统 |
| **英文名称** | StarFlight — Civil Aviation & Tourism Digital Human Guide |
| **一句话中文介绍** | 面向民航文旅的交互式3D数字人导览系统，集成LLM对话、RAG知识库和实时3D渲染 |
| **一句话英文介绍** | Interactive 3D digital human kiosk for civil aviation, powered by LLM + RAG + OpenAvatarChat |
| **GitHub Topics** | `digital-human` `llm` `rag` `react` `flask` `3d-avatar` `langchain` `dashscope` `typescript` |
| **Gitee 标签** | `数字人` `大模型` `知识库` `3D` `React` `Python` |
| **建议置顶** | ❌ 否 |
| **许可证** | MIT |
