from __future__ import annotations

import os
from typing import Any

import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS


def load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8-sig") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()

API_PREFIX = "/api"
OPENAVATAR_BASE_URL = os.getenv("OPENAVATAR_BASE_URL", "http://127.0.0.1:8282").rstrip("/")
CHAT_API_KEY = os.getenv("CHAT_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
CHAT_BASE_URL = (os.getenv("CHAT_BASE_URL") or os.getenv("DASHSCOPE_BASE_URL") or "").rstrip("/")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen-turbo")


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.get(f"{API_PREFIX}/health")
    def health() -> Response:
        return ok({"online": True, "service": "backend"})

    @app.get(f"{API_PREFIX}/service/status")
    def service_status() -> Response:
        return ok({"online": True})

    @app.get(f"{API_PREFIX}/openavatar/status")
    def openavatar_status() -> Response:
        return ok(get_openavatar_status())

    @app.get(f"{API_PREFIX}/openavatar/config")
    def openavatar_config() -> Response:
        return ok(
            {
                "online": get_openavatar_status()["online"],
                "avatarUrl": OPENAVATAR_BASE_URL,
                "chatEndpoint": f"{API_PREFIX}/openavatar/chat",
                "connectEndpoint": f"{API_PREFIX}/openavatar/connect",
                "webrtcOfferEndpoint": f"{API_PREFIX}/openavatar/webrtc/offer",
                "openAvatarChatUrl": openavatar_chat_url(),
                "voiceProvider": "openavatar-edge-tts",
            }
        )

    @app.post(f"{API_PREFIX}/openavatar/connect")
    def openavatar_connect() -> Response:
        return ok(get_openavatar_status())

    @app.post(f"{API_PREFIX}/openavatar/webrtc/offer")
    def openavatar_webrtc_offer() -> Response:
        return proxy_openavatar_request("/webrtc/offer")

    @app.post(f"{API_PREFIX}/openavatar/chat")
    def openavatar_chat() -> Response:
        data = request.get_json(silent=True) or {}
        message = str(data.get("message") or data.get("text") or "").strip()
        stage = str(data.get("stage") or "")
        reply = chat_reply(message, stage)
        avatar_sync = sync_openavatar_chat(message, reply)
        return ok({"reply": reply, "content": reply, "avatarSync": avatar_sync})

    @app.post(f"{API_PREFIX}/digital-human/chat")
    def digital_human_chat() -> Response:
        data = request.get_json(silent=True) or {}
        message = str(data.get("message") or "").strip()
        stage = str(data.get("stage") or "")
        reply = chat_reply(message, stage)
        return ok({"reply": reply, "content": reply})

    @app.post(f"{API_PREFIX}/voice/transcribe")
    def voice_transcribe() -> Response:
        return ok({"text": ""})

    @app.post(f"{API_PREFIX}/voice/speech")
    def voice_speech() -> Response:
        return Response(b"", mimetype="audio/wav")

    return app


def ok(payload: dict[str, Any], status: int = 200) -> Response:
    return jsonify(payload), status


def openavatar_chat_url() -> str:
    return f"{OPENAVATAR_BASE_URL}/api/chat"


def get_openavatar_status() -> dict[str, Any]:
    for endpoint in (OPENAVATAR_BASE_URL, openavatar_chat_url()):
        try:
            response = requests.get(endpoint, timeout=1.2)
            if response.status_code < 500:
                return {
                    "online": True,
                    "baseUrl": OPENAVATAR_BASE_URL,
                    "chatUrl": openavatar_chat_url(),
                    "webrtcOfferEndpoint": f"{API_PREFIX}/openavatar/webrtc/offer",
                    "voiceProvider": "openavatar-edge-tts",
                }
        except requests.RequestException:
            continue
    return {
        "online": False,
        "baseUrl": OPENAVATAR_BASE_URL,
        "chatUrl": openavatar_chat_url(),
        "webrtcOfferEndpoint": f"{API_PREFIX}/openavatar/webrtc/offer",
        "voiceProvider": "openavatar-edge-tts",
    }


def proxy_openavatar_request(path: str) -> Response:
    target = f"{OPENAVATAR_BASE_URL}{path}"
    try:
        response = requests.request(
            request.method,
            target,
            headers={key: value for key, value in request.headers if key.lower() != "host"},
            data=request.get_data(),
            params=request.args,
            timeout=30,
        )
    except requests.RequestException as error:
        return jsonify({"status": "failed", "message": str(error)}), 502

    excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    headers = [(key, value) for key, value in response.headers.items() if key.lower() not in excluded_headers]
    return Response(response.content, response.status_code, headers)


def chat_reply(message: str, stage: str) -> str:
    if CHAT_API_KEY and CHAT_BASE_URL:
        remote = request_chat_model(message, stage)
        if remote:
            return remote
    return fallback_reply(message, stage)


def request_chat_model(message: str, stage: str) -> str | None:
    endpoint = f"{CHAT_BASE_URL}/chat/completions"
    payload = {
        "model": CHAT_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "你是民航文旅数字人向导，用自然、简洁、可执行的中文回答。",
            },
            {"role": "user", "content": f"当前服务阶段：{stage}\n用户问题：{message}"},
        ],
        "temperature": 0.7,
    }
    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers={"Authorization": f"Bearer {CHAT_API_KEY}", "Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as error:
        print(f"Chat model request failed: {type(error).__name__}: {error}", flush=True)
        return None


def fallback_reply(message: str, stage: str) -> str:
    if not message:
        return "我在。请告诉我你想查询航班、机场动线、景区路线还是返程安排。"
    if any(keyword in message for keyword in ("航班", "机票", "登机", "机场")):
        return "可以。我会结合出发地、目的地、时间和预算，给出航班筛选、值机、安检和登机提醒。"
    if any(keyword in message for keyword in ("景区", "路线", "讲解", "游玩")):
        return "可以。我会按你的兴趣和时间安排景区路线，并提醒拥挤度、讲解重点和返程衔接。"
    if "return" in stage or "返程" in message:
        return "收到。我会优先处理返程航班、机场交通、值机时间和行李提醒。"
    return "收到。我可以继续帮你处理民航出行、机场导引、景区讲解和返程服务。"


def sync_openavatar_chat(message: str, reply: str) -> dict[str, Any]:
    status = get_openavatar_status()
    if not status["online"]:
        return {"connected": False, "endpoint": openavatar_chat_url(), "error": "OpenAvatarChat service is offline"}

    payload = {"message": message, "reply": reply, "text": reply}
    try:
        response = requests.post(openavatar_chat_url(), json=payload, timeout=8)
        return {
            "connected": response.status_code < 500,
            "endpoint": openavatar_chat_url(),
            "statusCode": response.status_code,
        }
    except requests.RequestException as error:
        return {"connected": False, "endpoint": openavatar_chat_url(), "error": str(error)}


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)
