/**
 * server.js
 * - Express server serving static frontend (for local demo)
 * - /session endpoint to create a Gemini Live session via server-to-server call
 * - /ws endpoint upgrades to WebSocket and proxies binary audio messages between
 *   the client and Gemini Live WebSocket session.
 *
 * IMPORTANT:
 * - Replace GEMINI API endpoints and auth handling with the exact flow from the
 *   Gemini Live API docs (the below uses a generic REST session creation + WebSocket approach).
 */

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { createProxyConnection } from "./wsProxy.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// Serve frontend static files
app.use(express.static("../frontend", { dotfiles: "allow", index: "index.html" }));

/**
 * /session
 * Create a Gemini Live session (server-to-server) and return session details to client.
 * The client will then open a WebSocket connection to this server at /ws,
 * and the server proxies to Gemini's WebSocket for real-time audio.
 */
app.get("/session", async (req, res) => {
  try {
    // TODO: Confirm the exact POST endpoint for Gemini Live session creation from the official docs.
    // Example (placeholder) endpoint:
    const createSessionEndpoint = "https://api.generativeai.example/v1beta/live/sessions";

    // system instructions: limit to Revolt Motors
    const systemInstructions = `
      You are "Rev", a Revolt Motors assistant. Answer only about Revolt Motors: bikes, specs, prices, service, availability.
      If asked about unrelated topics, politely redirect to Revolt Motors topics.
    `;

    const payload = {
      model: process.env.MODEL_NAME || "gemini-2.5-flash-preview-native-audio-dialog",
      instructions: systemInstructions,
      // You can add other session parameters here (audio config, language hints, etc.)
      // The exact fields depend on Gemini Live API; adapt per docs.
    };

    const response = await fetch(createSessionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // NOTE: Many Gemini Live flows use OAuth2 Bearer tokens. If your key is an API key,
        // the docs will specify header name/format. Adjust accordingly.
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Failed to create session:", response.status, errText);
      return res.status(500).json({ error: "Failed to create remote session", details: errText });
    }

    const data = await response.json();

    // data should include a ws URL or session id. We will store it and use it in wsProxy.
    // For this template, we assume `data.wsUrl` exists - replace with real field per docs.
    // If the API returns only a session_id, you may need an additional request to get a WebSocket URL.
    const sessionId = uuidv4();
    // store mapping in memory for demo. For production use a persistent store or in-memory map with TTL.
    sessionsMap.set(sessionId, data);

    // Return sessionId and any relevant connection info
    res.json({
      ok: true,
      sessionId,
      remoteSession: data
    });
  } catch (err) {
    console.error("Error /session:", err);
    res.status(500).json({ error: err.message });
  }
});

// simple in-memory sessions map (demo only)
const sessionsMap = new Map();

/**
 * WebSocket server for clients.
 * Clients connect to ws://localhost:PORT/ws?sessionId=...
 * The server will create a proxy WebSocket connection to Gemini's live ws and forward messages.
 */
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (clientWs, req) => {
  // get sessionId from query
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");

  console.log("Client connected to /ws, sessionId:", sessionId);

  // Look up the remote session created earlier
  const remoteSession = sessionsMap.get(sessionId);
  if (!remoteSession) {
    clientWs.send(JSON.stringify({ type: "error", message: "Invalid sessionId or session expired" }));
    clientWs.close();
    return;
  }

  // Create proxy connection to Gemini's WS and forward messages both ways
  createProxyConnection(clientWs, remoteSession, process.env.GEMINI_API_KEY)
    .catch(err => {
      console.error("Proxy connection error:", err);
      try { clientWs.send(JSON.stringify({ type: "error", message: "Proxy error" })); } catch {}
      clientWs.close();
    });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
