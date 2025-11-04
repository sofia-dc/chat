// server.js — single-file deploy: serves the chat UI + realtime Socket.IO backend (no database)
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- In-memory message history (no database) ---
const MAX_KEEP = 200;
const history = [];

io.on("connection", (socket) => {
  // Send recent history to the newly connected client
  socket.emit("history", history);

  // Receive and broadcast new messages
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
    io.emit("message", safe);
  });
});

// --- Minimal, pretty HTML client (served from the same URL) ---
const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mini Chat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root { --bg:#0b0c10; --panel:#111827; --muted:#9ca3af; --ink:#e5e7eb; --line:#1f2937; --accent:#2563eb; }
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;display:flex;min-height:100vh}
    .panel{margin:auto;width:min(760px,100% - 2rem);background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.45)}
    header{display:flex;align-items:center;gap:.75rem;padding:1rem 1.25rem;background:#0f172a;border-bottom:1px solid var(--line)}
    header h1{margin:0;font-size:1rem;font-weight:600}
    #chat{height:60vh;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.5rem}
    .sys{color:var(--muted);font-size:.9rem;text-align:center}
    .msg{display:flex;gap:.5rem;align-items:flex-start}
    .bubble{background:#1f2937;border:1px solid #374151;padding:.6rem .8rem;border-radius:12px;max-width:78%}
    .me{background:#153e75;border-color:#1d4ed8}
    .meta{font-size:.75rem;color:#93c5fd;margin-bottom:.2rem}
    form{display:flex;gap:.5rem;padding:1rem;border-top:1px solid var(--line);background:#0f172a}
    input,button,textarea{font:inherit}
    #name{width:11rem}
    #text{flex:1;resize:none}
    input,textarea{padding:.6rem .7rem;border-radius:.6rem;border:1px solid #374151;background:#0b1220;color:var(--ink)}
    input:focus,textarea:focus{outline:2px solid #2563eb33;border-color:var(--accent)}
    button{padding:.6rem .9rem;border-radius:.6rem;border:1px solid #3b82f6;background:#1d4ed8;color:white;cursor:pointer}
    button:disabled{opacity:.6;cursor:not-allowed}
    #status{color:var(--muted);font-size:.85rem;padding:0 1rem 1rem;min-height:1.2rem}
  </style>
</head>
<body>
  <div class="panel">
    <header>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H5.17L4 17.17V5z" stroke="#93c5fd" stroke-width="1.5"/><path d="M8 9h8M8 12h5" stroke="#93c5fd" stroke-width="1.5"/></svg>
      <h1>General chat</h1>
    </header>
    <div id="chat" aria-live="polite"></div>
    <div id="status"></div>
    <form id="form" autocomplete="off">
      <input id="name" placeholder="Your name" required />
      <textarea id="text" placeholder="Type a message…" rows="1"></textarea>
      <button id="send" type="submit">Send</button>
    </form>
  </div>

  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js" crossorigin="anonymous"></script>
  <script>
    const chat = document.getElementById('chat');
    const status = document.getElementById('status');
    const form = document.getElementById('form');
    const nameInput = document.getElementById('name');
    const textInput = document.getElementById('text');

    // Connect to the same origin Socket.IO server
    const socket = io({ transports: ['websocket'] });

    function addSystem(line){
      const el = document.createElement('div');
      el.className = 'sys'; el.textContent = line; chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
    }
    function addMessage(m){
      const row = document.createElement('div'); row.className = 'msg';
      const bubble = document.createElement('div'); bubble.className = 'bubble';
      const isMe = m.uid && m.uid === localStorage.getItem('mini_chat_uid');
      if (isMe) bubble.classList.add('me');
      const meta = document.createElement('div'); meta.className = 'meta';
      const time = new Date(m.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      meta.textContent = `${m.user || 'Anonymous'} • ${time}`;
      const body = document.createElement('div'); body.textContent = m.text;
      bubble.appendChild(meta); bubble.appendChild(body); row.appendChild(bubble);
      chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
    }

    // Local identity for nicer bubbles
    const uidKey = 'mini_chat_uid';
    if (!localStorage.getItem(uidKey)) localStorage.setItem(uidKey, Math.random().toString(36).slice(2,10));

    // Socket events
    socket.on('connect', () => { status.textContent = 'Connected'; });
    socket.on('connect_error', () => { status.textContent = 'Connection error'; });
    socket.on('message', addMessage);
    socket.on('history', (arr) => { (arr||[]).forEach(addMessage); });

    // Send messages
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = (nameInput.value || 'Anonymous').toString().slice(0,30);
      const text = (textInput.value || '').toString().slice(0,4000).trim();
      if (!text) return;
      const uid = localStorage.getItem(uidKey);
      const msg = { id: Date.now()+'-'+uid, uid, user, text, ts: Date.now() };
      socket.emit('message', msg);
      textInput.value = '';
    });

    // UX: Enter to send, Shift+Enter for newline
    textInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); form.dispatchEvent(new Event('submit')); } });
  </script>
</body>
</html>`;

app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.get("/", (_req, res) => { res.status(200).type("html").send(HTML); });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
