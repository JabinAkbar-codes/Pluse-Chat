const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 5000;
const IS_PROD = process.env.NODE_ENV === "production";

// In production the React build is served by this server (same origin), so CORS
// is only needed when the frontend lives on another domain.
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigin = IS_PROD
  ? ALLOWED_ORIGINS.includes("*")
    ? true
    : ALLOWED_ORIGINS
  : true; // dev: allow localhost and LAN testing from a phone

const LIMITS = {
  name: 20,
  room: 30,
  text: 500,
  history: 50,
  rateCount: 8, // messages ...
  rateWindowMs: 5000, // ... per window
  rejoinGraceMs: Number(process.env.REJOIN_GRACE_MS) || 8000, // keep a dropped user seated while they reconnect
};

const REACTIONS = new Set(["👍", "❤️", "😂", "😮", "🎉", "🙏"]);

// ---------------------------------------------------------------------------
// App + Socket.IO
// ---------------------------------------------------------------------------
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: corsOrigin }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET", "POST"] },
  pingInterval: 20000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5,
});

// ---------------------------------------------------------------------------
// In-memory state
// rooms: roomName -> { users: Map<userId, {id, username, socketId}>, messages: [] }
// ---------------------------------------------------------------------------
const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { users: new Map(), messages: [] });
  return rooms.get(name);
}

const publicUsers = (room) =>
  Array.from(room.users.values()).map(({ id, username }) => ({ id, username }));

function cleanLine(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITS.text);
}

function normalizeRoom(value) {
  return cleanLine(value, LIMITS.room)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

// The client sends a secret random id so it can reclaim its seat after a network
// drop. Other users only ever see this hash, so ids cannot be impersonated.
const publicId = (clientId) =>
  crypto.createHash("sha256").update(String(clientId)).digest("hex").slice(0, 12);

const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*){1,3}$/u;

function pushMessage(roomName, message) {
  const room = rooms.get(roomName);
  if (!room) return;
  room.messages.push(message);
  if (room.messages.length > LIMITS.history) room.messages.shift();
  io.to(roomName).emit("receive_message", message);
}

function systemMessage(roomName, text) {
  pushMessage(roomName, {
    id: crypto.randomUUID(),
    type: "system",
    text,
    timestamp: new Date().toISOString(),
  });
}

// Live stats for the landing screen (debounced so bursts cost one broadcast).
let statsTimer = null;
function broadcastStats() {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    const list = Array.from(rooms.entries())
      .map(([name, r]) => ({ name, count: r.users.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    io.emit("stats", { online: io.engine.clientsCount, rooms: list });
  }, 250);
}

function reply(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

// Remove a socket's user from its room (only if that socket still owns the seat).
function leaveRoom(socket) {
  const { room: roomName, userId, username } = socket.data;
  if (!roomName) return;
  socket.leave(roomName);
  socket.data.room = null;

  const room = rooms.get(roomName);
  const entry = room && room.users.get(userId);
  if (room && entry && entry.socketId === socket.id) {
    room.users.delete(userId);
    io.to(roomName).emit("typing", { userId, username, isTyping: false });
    if (room.users.size === 0) {
      rooms.delete(roomName);
    } else {
      io.to(roomName).emit("user_list", publicUsers(room));
      systemMessage(roomName, `${username} left`);
    }
  }
  broadcastStats();
}

function allowedToSend(socket) {
  const now = Date.now();
  const hits = (socket.data.hits || []).filter((t) => now - t < LIMITS.rateWindowMs);
  if (hits.length >= LIMITS.rateCount) {
    socket.data.hits = hits;
    return false;
  }
  hits.push(now);
  socket.data.hits = hits;
  return true;
}

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    rooms: rooms.size,
    online: io.engine.clientsCount,
  });
});

const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist, { maxAge: IS_PROD ? "1h" : 0 }));
  app.get("*", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
} else {
  app.get("/", (req, res) => {
    res
      .type("text")
      .send("Pulse server is running. Start the client with `npm run client`, or run `npm run build` to serve it from here.");
  });
}

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  socket.data = { room: null, userId: null, username: null, hits: [] };
  broadcastStats();

  socket.on("join_room", (payload, ack) => {
    const username = cleanLine(payload && payload.username, LIMITS.name);
    const roomName = normalizeRoom(payload && payload.room);
    const clientId = payload && payload.clientId;

    if (!username || !roomName || typeof clientId !== "string" || clientId.length < 8 || clientId.length > 80) {
      return reply(ack, { ok: false, error: "Enter a display name and a room name to continue." });
    }

    const userId = publicId(clientId);

    // Switching rooms from the same socket: leave the old one first.
    if (socket.data.room && (socket.data.room !== roomName || socket.data.userId !== userId)) {
      leaveRoom(socket);
    }

    const room = getRoom(roomName);
    const existing = room.users.get(userId);

    const nameTaken = Array.from(room.users.values()).some(
      (u) => u.id !== userId && u.username.toLowerCase() === username.toLowerCase()
    );
    if (nameTaken) {
      return reply(ack, {
        ok: false,
        error: `"${username}" is already taken in #${roomName}. Pick another name.`,
      });
    }

    // Same person reconnecting: evict their stale socket instead of showing a duplicate.
    const isRejoin = Boolean(existing);
    if (existing && existing.socketId !== socket.id) {
      const stale = io.sockets.sockets.get(existing.socketId);
      if (stale) {
        stale.leave(roomName);
        stale.data.room = null;
      }
    }

    socket.join(roomName);
    socket.data.room = roomName;
    socket.data.userId = userId;
    socket.data.username = username;
    room.users.set(userId, { id: userId, username, socketId: socket.id });

    // Ack first so the client has the history before live events arrive.
    reply(ack, {
      ok: true,
      room: roomName,
      me: { id: userId, username },
      users: publicUsers(room),
      history: room.messages.slice(),
    });

    io.to(roomName).emit("user_list", publicUsers(room));
    if (!isRejoin) systemMessage(roomName, `${username} joined`);
    broadcastStats();
  });

  socket.on("send_message", (payload, ack) => {
    const { room: roomName, userId, username } = socket.data;
    if (!roomName) return reply(ack, { ok: false, error: "Join a room before sending messages." });

    const text = cleanText(payload && payload.text);
    if (!text) return reply(ack, { ok: false, error: "Message is empty." });
    if (!allowedToSend(socket)) {
      return reply(ack, { ok: false, error: "You're sending messages too fast. Wait a moment." });
    }

    pushMessage(roomName, {
      id: crypto.randomUUID(),
      type: "user",
      userId,
      username,
      text,
      emojiOnly: EMOJI_ONLY.test(text),
      reactions: {},
      timestamp: new Date().toISOString(),
    });
    reply(ack, { ok: true });
  });

  socket.on("react", (payload) => {
    const { room: roomName, userId } = socket.data;
    const room = roomName && rooms.get(roomName);
    if (!room || !payload || !REACTIONS.has(payload.emoji)) return;

    const message = room.messages.find((m) => m.id === payload.messageId && m.type === "user");
    if (!message) return;

    const who = message.reactions[payload.emoji] || [];
    const next = who.includes(userId) ? who.filter((id) => id !== userId) : [...who, userId];
    if (next.length) message.reactions[payload.emoji] = next;
    else delete message.reactions[payload.emoji];

    io.to(roomName).emit("reaction_update", { messageId: message.id, reactions: message.reactions });
  });

  socket.on("typing", (payload) => {
    const { room: roomName, userId, username } = socket.data;
    if (!roomName) return;
    socket.to(roomName).emit("typing", { userId, username, isTyping: Boolean(payload && payload.isTyping) });
  });

  socket.on("leave_room", (payload, ack) => {
    leaveRoom(socket);
    reply(ack, { ok: true });
  });

  socket.on("disconnect", (reason) => {
    if (!socket.data.room) return broadcastStats();
    if (reason === "client namespace disconnect") return leaveRoom(socket);
    // Network drop: hold the seat briefly so a quick reconnect is seamless.
    setTimeout(() => leaveRoom(socket), LIMITS.rejoinGraceMs);
    broadcastStats();
  });
});

// ---------------------------------------------------------------------------
// Start + graceful shutdown
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Pulse server listening on port ${PORT} (${IS_PROD ? "production" : "development"})`);
});

function shutdown() {
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
