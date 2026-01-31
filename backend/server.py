# backend/server.py
import os
import time
import asyncio
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from contextlib import asynccontextmanager
import uvicorn

# --- CONFIGURATION ---
# "tiny" is fast/low-resource. Use "base" or "small" for better accuracy.
MODEL_SIZE = "tiny"
# Auto-detect GPU (CUDA) or Mac (MPS) or CPU
device = "auto"

app = FastAPI()

# Allow Electron to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Model State
model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model on startup (prevents lag on first speech)
    global model
    print(f"🧠 Loading Whisper Model ({MODEL_SIZE})...")
    try:
        model = WhisperModel(MODEL_SIZE, device=device, compute_type="int8")
        print("✅ Brain Online")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
    yield
    # Cleanup
    print("💤 Brain Sleeping")

app.router.lifespan_context = lifespan


@app.get("/health")
def health_check():
    return {"status": "active", "model": MODEL_SIZE}

# --- 1. LOCAL SPEECH TRANSCRIPTION ---


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Receives an audio blob from Electron, transcribes it locally using Whisper.
    """
    start = time.time()

    # Save temp file (Whisper needs a file path usually, or byte stream)
    temp_filename = f"temp_{int(time.time())}.wav"
    with open(temp_filename, "wb") as f:
        f.write(await file.read())

    try:
        # Transcribe
        segments, info = model.transcribe(temp_filename, beam_size=5)
        text = " ".join([segment.text for segment in segments])

        # Cleanup
        os.remove(temp_filename)

        duration = time.time() - start
        return {
            "text": text.strip(),
            "language": info.language,
            "latency_ms": int(duration * 1000)
        }
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        return {"error": str(e)}

# --- 2. BATTLECARD LOGIC (PYTHON SIDE) ---
# This is faster/smarter in Python using simple keyword matching or Vector DB later
BATTLECARDS = [
    {"triggers": ["price", "cost", "expensive"], "title": "💰 Pricing Defense",
        "content": "We are 20% cheaper than Cluely. Highlight our 'Lifetime License' vs their subscription."},
    {"triggers": ["security", "compliance", "offline"], "title": "🛡️ Security First",
        "content": "Emphasize: We run LOCALLY. No audio is ever sent to the cloud."},
    {"triggers": ["demo", "show me"], "title": "✨ Demo Flow",
        "content": "1. Show Live Transcription. 2. Show Battlecard Trigger. 3. Show 'God Mode' Overlay."}
]


@app.post("/analyze-context")
async def analyze_context(payload: dict):
    """
    Analyzes text for battlecard triggers.
    In the future, this is where RAG/VectorDB logic goes.
    """
    text = payload.get("text", "").lower()
    matches = []

    for card in BATTLECARDS:
        if any(t in text for t in card["triggers"]):
            matches.append(card)

    return {"matches": matches}

if __name__ == "__main__":
    # Run on a specific port that Electron knows about
    uvicorn.run(app, host="127.0.0.1", port=11435)
