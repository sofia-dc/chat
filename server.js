// server.js — deploy this to Render to make your chat work across devices
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Keep messages in memory only (no database)
const MAX_KEEP = 200;
const history = [];

io.on("connection", (socket) => {
  console.log("Client connected", socket.id);
  // Send existing chat history to the new user
  socket.emit("history", history);

  // Listen for new messages from a client
  socket.on("message", (msg) => {
    const safe = {
      id: msg?.id || `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      user: String(msg?.user || "Anonymous").slice(0,30),
      text: String(msg?.text || "").slice(0,4000),
      ts: msg?.ts || Date.now(),
      uid: String(msg?.uid || ""),
    };

    history.push(safe);
    if (history.length > MAX_KEEP) history.splice(0, history.length - MAX_KEEP);

    // Broadcast to all clients
    io.emit("message", safe);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("<h1>Chat server is running</h1>");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
