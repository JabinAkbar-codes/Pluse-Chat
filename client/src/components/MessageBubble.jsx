import React, { useState } from "react";
import Avatar from "./Avatar";

export const REACTIONS = ["👍", "❤️", "😂", "😮", "🎉", "🙏"];

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn, showHeader, me, onReact }) {
  const [picker, setPicker] = useState(false);

  if (message.type === "system") {
    return (
      <div className="system-message">
        <span>{message.text}</span>
      </div>
    );
  }

  const fresh = isOwn && Date.now() - new Date(message.timestamp).getTime() < 1500;
  const reactions = Object.entries(message.reactions || {}).filter(([, who]) => who.length > 0);

  return (
    <div className={`msg ${isOwn ? "own" : "other"} ${showHeader ? "first" : ""}`}>
      {!isOwn && (
        <div className="msg-avatar">{showHeader ? <Avatar name={message.username} size={30} /> : null}</div>
      )}

      <div className="msg-col">
        {showHeader && (
          <div className="msg-meta">
            {!isOwn && <strong>{message.username}</strong>}
            <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
          </div>
        )}

        <div className="msg-line">
          <div
            className={`bubble ${message.emojiOnly ? "bubble-emoji" : ""} ${fresh ? "fresh" : ""}`}
            title={formatTime(message.timestamp)}
          >
            {message.text}
          </div>

          <div className="react-wrap">
            <button
              type="button"
              className="react-btn"
              aria-label="Add a reaction"
              aria-expanded={picker}
              onClick={() => setPicker((v) => !v)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement.contains(e.relatedTarget)) setPicker(false);
              }}
            >
              +
            </button>
            {picker && (
              <div
                className="react-picker"
                role="menu"
                onBlur={(e) => {
                  if (!e.currentTarget.parentElement.contains(e.relatedTarget)) setPicker(false);
                }}
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    aria-label={`React with ${emoji}`}
                    onClick={() => {
                      onReact(message.id, emoji);
                      setPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {reactions.length > 0 && (
          <div className="chips">
            {reactions.map(([emoji, who]) => (
              <button
                key={emoji}
                type="button"
                className={`chip ${who.includes(me) ? "active" : ""}`}
                aria-pressed={who.includes(me)}
                aria-label={`${emoji} ${who.length}`}
                onClick={() => onReact(message.id, emoji)}
              >
                {emoji} <span>{who.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
