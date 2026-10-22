# Pulse

A real-time chat app with rooms, live presence, typing indicators, message history and emoji reactions.
Built with **React + Vite**, **Node + Express** and **Socket.IO**.

## Features
- Instant messaging in named rooms, created the moment the first person joins
- Live online count and clickable list of active rooms on the landing screen
- Presence list, typing indicators, message grouping and reactions (synced across everyone)
- Last 50 messages shown to people who join later
- Auto-reconnect: after a dropped connection the app rejoins the room and catches up on missed messages
- Unique display names per room, invite links (`/#room-name`), unread "new messages" pill
- Responsive layout with a slide-over sidebar on phones, automatic light and dark theme, keyboard and screen-reader friendly
- Server-side validation, message length limit and rate limiting

## Run locally
```bash
npm run install:all
npm run dev
```
Open http://localhost:5173 in two browser tabs (use a different name in each).
To test from your phone, open `http://<your-computer-ip>:5173` on the same Wi-Fi.

## Deploy (one service, realtime works out of the box)
The server also serves the built React app, so the page and the WebSocket share one origin.

**Render**
1. Push this folder to GitHub.
2. In Render choose **New > Blueprint** and select the repo (it reads `render.yaml`).
   Or create a Web Service manually:
   - Build command: `npm install --prefix server && npm install --prefix client --include=dev && npm run build --prefix client`
   - Start command: `node server/index.js`
   - Health check path: `/health`
3. Open the URL Render gives you. Done.

Free plans sleep after inactivity, so the first visit can take about 30 seconds to wake up. The app shows "Connecting" and joins automatically once the server is awake.

**Frontend and backend on different domains** (for example Vercel + Render)
- Backend env: `CLIENT_ORIGIN=https://your-frontend.vercel.app`
- Frontend env at build time: `VITE_SERVER_URL=https://your-backend.onrender.com`

## Project structure
```
server/index.js              Socket.IO events, rooms, validation, static hosting
client/src/hooks/useChat.js  All real-time state (connect, join, reconnect, messages)
client/src/components/       Login, ChatRoom, MessageBubble, Composer, ...
```

## Socket events
| Event | Direction | Purpose |
|---|---|---|
| `join_room` | client to server | Join or re-join a room, returns users and history |
| `send_message` | client to server | Send a message (acknowledged) |
| `react` | client to server | Toggle a reaction on a message |
| `typing` | both | Typing indicator |
| `leave_room` | client to server | Leave the current room |
| `receive_message`, `user_list`, `reaction_update`, `stats` | server to client | Live updates |

## Limits and next steps
Rooms and history live in server memory, so they reset when the server restarts, and one server instance is assumed.
To scale to several instances, add the Socket.IO Redis adapter. To keep history permanently, store messages in a database such as PostgreSQL or MongoDB.
"# Pluse-Chat" 
