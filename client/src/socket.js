import { io } from "socket.io-client";

// Where the Socket.IO server lives:
//  - VITE_SERVER_URL if you host the frontend and backend on different domains
//  - in dev, port 5000 on the same host (works from a phone on your Wi-Fi too)
//  - in production, the same origin that served this page
const explicitUrl = import.meta.env.VITE_SERVER_URL;
const url =
  explicitUrl ||
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:5000` : undefined);

export const socket = io(url, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnectionDelayMax: 5000,
});

function randomId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Secret per-tab id: lets the server recognise this tab after a network drop.
export function getClientId() {
  try {
    let id = sessionStorage.getItem("pulse:clientId");
    if (!id) {
      id = randomId();
      sessionStorage.setItem("pulse:clientId", id);
    }
    return id;
  } catch {
    if (!getClientId.fallback) getClientId.fallback = randomId();
    return getClientId.fallback;
  }
}
