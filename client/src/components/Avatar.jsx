import React from "react";

function hueFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

export default function Avatar({ name, size = 32 }) {
  const initial = (Array.from(name.trim())[0] || "?").toUpperCase();
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        background: `hsl(${hueFor(name)} 62% 42%)`,
      }}
    >
      {initial}
    </span>
  );
}
