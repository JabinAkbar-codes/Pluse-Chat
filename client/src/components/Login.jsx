import React, { useState } from "react";
import StatusPill from "./StatusPill";

function initialRoom() {
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

function initialName() {
  try {
    return localStorage.getItem("pulse:username") || "";
  } catch {
    return "";
  }
}

export default function Login({ chat }) {
  const { stats, status, join } = chat;
  const [username, setUsername] = useState(initialName);
  const [room, setRoom] = useState(initialRoom);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const name = username.trim();
    const roomName = room.trim();
    if (!name || !roomName) {
      setError("Enter a display name and a room name to continue.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await join(name, roomName);
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  const people = stats.online;
  const roomCount = stats.rooms.length;

  return (
    <main className="login">
      <section className="brand-panel">
        <div className="brand-top">
          <StatusPill status={status} />
        </div>

        <div className="brand-body">
          <h1 className="wordmark">Pulse</h1>
          <svg className="pulse-line" viewBox="0 0 600 80" preserveAspectRatio="none" aria-hidden="true">
            <path className="pulse-line-track" d="M0 40h180l22-30 34 62 30-48 16 16h318" />
            <path className="pulse-line-beat" d="M0 40h180l22-30 34 62 30-48 16 16h318" />
          </svg>
          <p className="tagline">Rooms that open the moment you join. Messages arrive as they are typed.</p>
        </div>

        <div className="brand-live">
          <p className="live-summary">
            <span className={`live-dot ${status === "online" ? "on" : ""}`} aria-hidden="true" />
            {status === "online"
              ? `${people} ${people === 1 ? "person" : "people"} online, ${roomCount} active ${roomCount === 1 ? "room" : "rooms"}`
              : "Connecting to the server..."}
          </p>

          {roomCount > 0 ? (
            <ul className="room-chips" aria-label="Active rooms">
              {stats.rooms.map((r) => (
                <li key={r.name}>
                  <button type="button" className="room-chip" onClick={() => setRoom(r.name)}>
                    #{r.name}
                    <span className="room-chip-count">{r.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            status === "online" && <p className="live-empty">No active rooms yet. Start one and you will be the first in it.</p>
          )}
        </div>
      </section>

      <section className="form-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h2>Join a room</h2>
          <p className="login-help">Rooms are created when the first person joins. Share the room name to invite others.</p>

          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Alex"
              maxLength={20}
              autoComplete="nickname"
              autoFocus={!username}
            />
          </label>

          <label className="field">
            <span>Room</span>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="general"
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Joining..." : "Join room"}
          </button>
        </form>
      </section>
    </main>
  );
}
