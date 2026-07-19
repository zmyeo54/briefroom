#!/usr/bin/env python3
"""Local Edge TTS API for Briefroom — newscaster neural voices + styles."""

from __future__ import annotations

import asyncio
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import edge_tts

from job_fetch import fetch_job_text

HOST = "127.0.0.1"
PORT = 8790

# All entries use broadcast / newscast styles — not flat conversational defaults.
# tuple: (edge_voice_name, mstts style or "")
VOICES: dict[str, tuple[str, str]] = {
    # Mandarin newscasters
    "zh-xiaoxiao-news": ("zh-CN-XiaoxiaoNeural", "newscast"),
    "zh-yunyang-news": ("zh-CN-YunyangNeural", "narration-professional"),
    "zh-xiaoyi-news": ("zh-CN-XiaoyiNeural", "newscast"),
    "zh-yunjian-news": ("zh-CN-YunjianNeural", "narration-relaxed"),
    # English newscasters
    "en-aria-news": ("en-US-AriaNeural", "newscast-formal"),
    "en-jenny-news": ("en-US-JennyNeural", "newscast"),
    "en-guy-news": ("en-US-GuyNeural", "newscast"),
    "en-davis-news": ("en-US-DavisNeural", "newscast"),
    # Legacy aliases → newscaster equivalents
    "zh-male": ("zh-CN-YunyangNeural", "narration-professional"),
    "zh-female": ("zh-CN-XiaoxiaoNeural", "newscast"),
    "en-male": ("en-US-GuyNeural", "newscast"),
    "en-female": ("en-US-JennyNeural", "newscast"),
    "yunyang": ("zh-CN-YunyangNeural", "narration-professional"),
}

DEFAULT_VOICE = "zh-yunyang-news"
DEFAULT_VOICE_Q = "zh-xiaoxiao-news"
DEFAULT_VOICE_A = "zh-yunyang-news"


def resolve_voice(voice_id: str) -> tuple[str, str]:
    return VOICES.get(voice_id) or VOICES[DEFAULT_VOICE]


def rate_to_edge(rate: float) -> str:
    # Slightly brisk for newscast delivery
    pct = int(round((rate - 1.0) * 100 - 4))
    pct = max(-40, min(40, pct))
    return f"{pct:+d}%"


_TAG_RE = re.compile(r"<[^>]+>")
_URL_RE = re.compile(r"https?://\S+", re.I)
_CODE_FENCE_RE = re.compile(r"```[\s\S]*?```")


def sanitize_speak_text(text: str) -> str:
    """Strip markup/codes so TTS never reads SSML, markdown, or URLs aloud."""
    t = str(text or "")
    t = _CODE_FENCE_RE.sub(" ", t)
    t = _TAG_RE.sub(" ", t)
    t = _URL_RE.sub(" ", t)
    # bilingual separator "中文 / English" → natural pause
    t = re.sub(r"\s*/\s*", "。 ", t)
    t = re.sub(r"[|｜]+", "。 ", t)
    t = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"^#+\s*", "", t, flags=re.M)
    t = t.replace("&nbsp;", " ").replace("&amp;", " and ").replace("&lt;", " ").replace("&gt;", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t


CHUNK_CHARS = 600
MAX_ATTEMPTS = 4


def split_speak_chunks(text: str, max_len: int = CHUNK_CHARS) -> list[str]:
    """Keep each Edge turn short — long answers often get WS-dropped mid-synthesis."""
    raw = (text or "").strip()
    if not raw:
        return []
    if len(raw) <= max_len:
        return [raw]

    sentences = [s for s in re.split(r"(?<=[.!?。！？；;])\s+", raw) if s]
    parts: list[str] = []
    buf = ""
    for s in sentences:
        if buf and len(buf) + 1 + len(s) > max_len:
            parts.append(buf)
            buf = s
        else:
            buf = f"{buf} {s}" if buf else s
    if buf:
        parts.append(buf)

    out: list[str] = []
    for p in parts:
        if len(p) <= max_len:
            out.append(p)
        else:
            for i in range(0, len(p), max_len):
                out.append(p[i : i + max_len])
    return out


async def _synthesize_once(text: str, edge_name: str, rate_str: str) -> bytes:
    communicate = edge_tts.Communicate(text, edge_name, rate=rate_str)
    chunks: list[bytes] = []
    async for item in communicate.stream():
        if item["type"] == "audio":
            chunks.append(item["data"])
    audio = b"".join(chunks)
    if not audio:
        raise ValueError("empty audio")
    return audio


async def synthesize(text: str, voice_id: str, rate: float) -> bytes:
    # Plain text only — SSML was being spoken as literal "codes" by Edge TTS.
    edge_name, _style = resolve_voice(voice_id)
    clean = sanitize_speak_text(text)
    if not clean:
        raise ValueError("empty speech text")
    rate_str = rate_to_edge(rate)

    buffers: list[bytes] = []
    for piece in split_speak_chunks(clean):
        last: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            try:
                buffers.append(await _synthesize_once(piece, edge_name, rate_str))
                last = None
                break
            except Exception as e:
                last = e
                await asyncio.sleep(0.35 * (attempt + 1))
        if last is not None:
            raise last
    return b"".join(buffers)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[tts] {args[0]}")

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/health", "/api/tts-health"):
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "ok": True,
                        "voices": list(VOICES.keys()),
                        "defaults": {"q": DEFAULT_VOICE_Q, "a": DEFAULT_VOICE_A},
                    }
                ).encode()
            )
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        if path in ("/fetch-url", "/api/fetch-url"):
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                self.send_response(400)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"invalid json"}')
                return

            url = (body.get("url") or "").strip()
            if not url:
                self.send_response(400)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"url required"}')
                return

            try:
                data = fetch_job_text(url)
            except Exception as e:
                self.send_response(502)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
                return

            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, **data}).encode())
            return

        if path not in ("/tts", "/api/tts"):
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_response(400)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"invalid json"}')
            return

        text = (body.get("text") or "").strip()
        if not text:
            self.send_response(400)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"text required"}')
            return

        voice_id = body.get("voice") or DEFAULT_VOICE
        try:
            rate = float(body.get("rate") or 1.0)
        except (TypeError, ValueError):
            rate = 1.0

        try:
            audio = asyncio.run(synthesize(text, voice_id, rate))
        except Exception as e:
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[tts] listening on http://{HOST}:{PORT} (newscaster styles)")
    server.serve_forever()


if __name__ == "__main__":
    main()
