/**
 * wsProxy.js
 * - createProxyConnection(clientWs, remoteSession, apiKey)
 * - establishes a WebSocket to the Gemini Live service and forwards binary & control messages.
 *
 * NOTE:
 * - This file contains a robust proxy pattern, but the exact message shapes (control token names,
 *   JSON wrapper formats, "stop" control message) must be aligned with the official Gemini Live WebSocket protocol.
 * - See the official Gemini Live docs for the exact WebSocket URL and message format.
 */

import WebSocket from "ws";

export async function createProxyConnection(clientWs, remoteSession, apiKey) {
  return new Promise((resolve, reject) => {
    // TODO: remoteSession must include wsUrl or a session token you can connect to.
    // For example: remoteSession.wsUrl = "wss://livegenerativeapi.googleapis.com/v1beta/..."
    const remoteWsUrl = remoteSession.wsUrl || remoteSession.ws_url || remoteSession.websocketUrl;
    if (!remoteWsUrl) {
      reject(new Error("Remote session does not include a wsUrl. Check session creation response."));
      return;
    }

    // Create WS to Gemini Live
    const remoteWs = new WebSocket(remoteWsUrl, {
      headers: {
        // Authorization header: adjust format depending on docs
        "Authorization": `Bearer ${apiKey}`
      }
    });

    remoteWs.on("open", () => {
      console.log("Connected to Gemini remote WS");
      clientWs.send(JSON.stringify({ type: "proxy_ready" }));
      resolve();
    });

    remoteWs.on("message", (data) => {
      // Forward remote messages to client
      // Data may be JSON control messages or binary audio. We'll forward as-is.
      try {
        clientWs.send(data);
      } catch (err) {
        console.error("Error sending to client:", err);
      }
    });

    remoteWs.on("close", (code, reason) => {
      console.log("Remote WS closed:", code, reason);
      try { clientWs.close(); } catch (e) {}
    });

    remoteWs.on("error", (err) => {
      console.error("Remote WS error:", err);
      try { clientWs.send(JSON.stringify({ type: "error", message: "Remote WS error" })); } catch {}
    });

    clientWs.on("message", (msg) => {
      // Client messages can be:
      // - binary audio chunks (ArrayBuffer / Buffer) -- forward to remote
      // - JSON control messages (stop / start / metadata) -- forward as JSON text
      if (typeof msg === "string") {
        // parse control
        try {
          const parsed = JSON.parse(msg);
          // Example: { type: "control", action: "stop" }
          // Map client control commands to Gemini protocol if necessary
          if (parsed.type === "control" && parsed.action === "stop") {
            // For interruption: send the appropriate control event to Gemini remote
            // TODO: map to real Gemini control message (e.g., '{"type":"input.stop"}' or similar)
            remoteWs.send(JSON.stringify({ type: "input.stop" }));
          } else {
            // forward any other JSON we received
            remoteWs.send(JSON.stringify(parsed));
          }
        } catch (err) {
          console.warn("Invalid client JSON message; forwarding as text:", err);
          remoteWs.send(msg);
        }
      } else {
        // binary data: forward directly
        remoteWs.send(msg, (err) => {
          if (err) console.error("Error forwarding binary to remote:", err);
        });
      }
    });

    clientWs.on("close", () => {
      console.log("Client WS closed, closing remote WS...");
      try { remoteWs.close(); } catch {}
    });

    clientWs.on("error", (err) => {
      console.error("Client WS error:", err);
      try { remoteWs.close(); } catch {}
    });
  });
}
