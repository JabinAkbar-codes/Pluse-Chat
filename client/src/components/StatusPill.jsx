import React from "react";

const LABELS = {
  online: "Live",
  connecting: "Connecting",
  offline: "Offline, retrying",
};

export default function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status}`} role="status">
      <svg className="status-wave" viewBox="0 0 48 16" aria-hidden="true">
        <path d="M0 8h12l4-6 6 12 5-9 3 3h18" />
      </svg>
      {LABELS[status]}
    </span>
  );
}
