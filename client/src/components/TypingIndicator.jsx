import React from "react";

export default function TypingIndicator({ typers }) {
  let label = "";
  if (typers.length === 1) label = `${typers[0]} is typing`;
  else if (typers.length === 2) label = `${typers[0]} and ${typers[1]} are typing`;
  else if (typers.length > 2) label = "Several people are typing";

  return (
    <div className="typing-slot" aria-live="polite">
      {typers.length > 0 && (
        <span className="typing-pill">
          <span className="typing-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {label}
        </span>
      )}
    </div>
  );
}
