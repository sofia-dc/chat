import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.static("public")); // serves index.html

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// simple in-memory user map
const users = new Map(); // socket.id -> { name }

io.on("connection", (socket) => {
  // set username
  socket.on("register", (name, ack) => {
    users.set(socket.id, { name: String(name || "Anonymous").slice(0, 30) });
    socket.join("general");
    socket.to("general").emit("system", `${users.get(socket.id).name} joined`);
    ack?.({ ok: true, name: users.get(socket.id).name });
  });

  // receive and broadcast messages
  socket.on("message", (text) => {
    const u = users.get(socket.id) || { name: "Anonymous" };
    const msg = {
      id: `${Date.now()}-${socket.id}`,
      user: u.name,
      text: String(text || "").slice(0, 2000),
      ts: Date.now()
    };
    io.to("general").emit("message", msg);
  });

  // typing indicator (debounced client-side)
  socket.on("typing", (isTyping) => {
    const u = users.get(socket.id) || { name: "Someone" };
    socket.to("general").emit("typing", { user: u.name, isTyping: !!isTyping });
  });

  socket.on("disconnect", () => {
    const u = users.get(socket.id);
    if (u) {
      socket.to("general").emit("system", `${u.name} left`);
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Chat server running on http://localhost:${PORT}`));
