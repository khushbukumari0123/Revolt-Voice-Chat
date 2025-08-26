# Revolt Voice Chat (Gemini Live)

A **server-to-server voice assistant** built with the **Gemini Live API**, designed to replicate the functionality of Revolt Motors' "Rev" chatbot. This project demonstrates real-time voice interaction with **interruptions (barge-in)**, **low-latency responses**, and **multilingual support**.

---

## ✨ Features
- 🎙️ **Real-time conversation** with Google Gemini Live API.
- ⏸️ **Interruptions (Barge-in)**: Speak over the bot and it will stop immediately.
- ⚡ **Low latency**: 1–2 seconds first-token response.
- 🌐 **Multilingual**: Detects and responds in the user’s spoken language (English, Hindi, etc.).
- 🔒 **Server-to-server architecture**: API key is **never exposed** to the client.
- 🖥️ **Clean frontend**: Simple, responsive web UI with start/stop controls and latency indicator.

---

## 📂 Project Structure
```
revolt-voice-gemini-live/
├─ server/              # Node.js/Express backend
│  ├─ server.js         # Main server + WebSocket bridge
│  ├─ audio.js          # Audio helpers (resample, PCM encode)
│  ├─ system-instruction.txt # System prompt for Revolt-only scope
│  ├─ .env.example      # Env template
│  └─ package.json      # Server dependencies
├─ client/              # Frontend
│  ├─ index.html        # UI
│  ├─ styles.css        # Styling
│  └─ main.js           # Mic capture + playback logic
├─ README.md
└─ LICENSE
```

---

## 🚀 Getting Started

### 1) Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Google AI Studio API key](https://aistudio.google.com/)

### 2) Setup
```bash
cd server
cp .env.example .env
# Paste your API key into GOOGLE_API_KEY in .env
```

### 3) Install dependencies
```bash
cd server
npm install
```

### 4) Run server
```bash
npm run dev
```
Then open [http://localhost:8080](http://localhost:8080)

---

## ⚙️ Models
Recommended models:
- ✅ `gemini-2.5-flash-preview-native-audio-dialog` → Best for **production voice** (native audio).
- 🧪 `gemini-live-2.5-flash-preview` → **Fallback/Dev-friendly**, avoids free-tier daily limits.
- 🧪 `gemini-2.0-flash-live-001` → Another dev option.

You can set this in **`.env` → MODEL_ID**.

---

## 🎛️ Key Features Explained

### 🔊 Interruptions (Barge-in)
- When user starts speaking, client sends `activity-start`.
- Gemini Live API cuts off bot’s audio and switches to listening.
- UI stops playback instantly.

### ⚡ Latency Measurement
- UI tracks **time-to-first-token** (between speech end and bot’s first transcript).

### 🛡️ System Instructions
Located in `server/system-instruction.txt`. Ensures the bot:
- Talks **only about Revolt Motors** (bikes, booking, service, charging, policies).
- Declines irrelevant queries.
- Responds concisely in the user’s spoken language.

---

## 📹 Demo Video Guidelines
For submission:
1. Start a natural voice conversation with the AI.
2. Speak over it to show **interruption works**.
3. Ask in both English and Hindi (or another language).
4. Show latency counter updating.

---

## 🛠️ Deployment
- Deploy Node server on **Render, Vercel, Fly.io, or Cloud Run**.
- Use HTTPS/WSS in production.
- Never expose `GOOGLE_API_KEY` to client-side code.

---

## 📜 License
Apache-2.0 License
