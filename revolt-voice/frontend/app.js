/**
 * app.js
 *
 * Client-side:
 * - Requests /session from the backend to create a Gemini Live session (server-to-server)
 * - Opens a WebSocket connection to the backend /ws?sessionId=...
 * - Captures microphone audio using MediaRecorder and sends audio chunks to backend via WS
 * - Plays incoming audio from the backend (AI responses) via the <audio> element
 * - Provides interrupt (stop) button to interrupt the model mid-speech
 *
 * Note: The MediaRecorder MIME and encoding varies by browser. Most browsers record as webm/opus.
 * The backend/remote Gemini may expect PCM16 or opus; the server (or Gemini) must accept the media format.
 * If necessary, you can transcode on the server or select appropriate audio settings.
 */

const connectBtn = document.getElementById("connectBtn");
const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");
const logEl = document.getElementById("log");
const statusText = document.getElementById("statusText");
const player = document.getElementById("player");

let ws;
let sessionId;
let mediaRecorder;
let localStream;

function log(msg) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

connectBtn.onclick = async () => {
  connectBtn.disabled = true;
  statusText.textContent = "creating session...";
  // ask backend to create remote Gemini session
  const resp = await fetch("/session");
  if (!resp.ok) {
    const txt = await resp.text();
    log("Failed to create session: " + txt);
    statusText.textContent = "error";
    connectBtn.disabled = false;
    return;
  }
  const data = await resp.json();
  sessionId = data.sessionId;
  log("Session created. sessionId=" + sessionId);
  statusText.textContent = "session ready";

  // open a websocket to our server; server will proxy to Gemini remote
  const wsUrl = `${location.origin.replace(/^http/, "ws")}/ws?sessionId=${sessionId}`;
  ws = new WebSocket(wsUrl);

  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    log("WebSocket connected (to local proxy).");
    micBtn.disabled = false;
    stopBtn.disabled = false;
    statusText.textContent = "connected";
  };

  ws.onmessage = (ev) => {
    // incoming data can be text JSON control or binary audio
    if (typeof ev.data === "string") {
      try {
        const parsed = JSON.parse(ev.data);
        // handle control JSON messages
        log("Control from server: " + JSON.stringify(parsed));
        if (parsed.type === "proxy_ready") {
          log("Proxy ready: remote Gemini WS connected.");
        }
        return;
      } catch (e) {
        // not JSON - treat as text
        log("Text message: " + ev.data);
        return;
      }
    }

    // if binary audio, create a blob and play
    const audioBlob = new Blob([ev.data], { type: "audio/webm; codecs=opus" });
    const url = URL.createObjectURL(audioBlob);
    player.src = url;
    player.play().catch(err => console.warn("playback error:", err));
    log("Playing audio chunk from AI...");
  };

  ws.onclose = () => {
    log("WebSocket closed.");
    statusText.textContent = "closed";
    micBtn.disabled = true;
    stopBtn.disabled = true;
    connectBtn.disabled = false;
  };

  ws.onerror = (err) => {
    log("WebSocket error: " + err.message);
  };
};

micBtn.onclick = async () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log("WebSocket not connected.");
    return;
  }

  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    // start capturing audio
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      log("Microphone access denied: " + err.message);
      return;
    }

    // MediaRecorder will give us chunks (webm/opus in most browsers). The server must accept this.
    mediaRecorder = new MediaRecorder(localStream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        // send binary chunk via WebSocket
        ev.data.arrayBuffer().then(buf => {
          try {
            ws.send(buf);
            log("Sent audio chunk to server (" + ev.data.size + " bytes)");
          } catch (err) {
            log("Error sending audio chunk: " + err.message);
          }
        });
      }
    };
    mediaRecorder.onstart = () => {
      log("MediaRecorder started.");
      statusText.textContent = "recording";
      micBtn.textContent = "🎤 Stop Recording";
    };
    mediaRecorder.onstop = () => {
      log("MediaRecorder stopped.");
      statusText.textContent = "idle";
      micBtn.textContent = "🎤 Start Speaking";
      // Optionally notify server that input finished and model can start producing audio if needed
      // Example: ws.send(JSON.stringify({ type: "control", action: "input_end" }));
    };

    mediaRecorder.start(250); // timeslice (ms) — adjust to your needs
    micBtn.textContent = "🎤 Stop Recording";
  } else if (mediaRecorder.state === "recording") {
    // stop
    mediaRecorder.stop();
    localStream.getTracks().forEach(t => t.stop());
  }
};

stopBtn.onclick = () => {
  // Send control message to interrupt AI speaking.
  // The server must map this to the correct Gemini control frame.
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log("WebSocket not connected.");
    return;
  }
  log("Sending interrupt/stop control to server...");
  ws.send(JSON.stringify({ type: "control", action: "stop" }));
  statusText.textContent = "sent interrupt";
};
