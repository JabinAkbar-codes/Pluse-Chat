import React, { useLayoutEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import UserList from "./UserList";
import Composer from "./Composer";
import StatusPill from "./StatusPill";

const GROUP_GAP_MS = 5 * 60 * 1000;

export default function ChatRoom({ chat }) {
  const { session, messages, users, typers, status, leave, sendMessage, react, setTypingState, showNotice } = chat;
  const [drawer, setDrawer] = useState(false);
  const [unseen, setUnseen] = useState(0);

  const listRef = useRef(null);
  const atBottom = useRef(true);
  const lastCount = useRef(0);

  const scrollToBottom = (behavior = "smooth") => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setUnseen(0);
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseen(0);
  };

  // Stay pinned to the newest message, unless the reader scrolled up on purpose.
  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    const wasEmpty = lastCount.current === 0;
    const added = messages.length > lastCount.current;
    lastCount.current = messages.length;
    if (!last) return;
    if (wasEmpty) return scrollToBottom("auto");
    if (!added) return;
    if (atBottom.current || last.userId === session.userId) scrollToBottom("smooth");
    else setUnseen((n) => n + 1);
  }, [messages, session.userId]);

  const invite = async () => {
    const link = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(session.room)}`;
    try {
      await navigator.clipboard.writeText(link);
      showNotice("Invite link copied.");
    } catch {
      showNotice(`Share this link: ${link}`);
    }
  };

  const offline = status !== "online";

  return (
    <div className="chat">
      <aside className={`side ${drawer ? "open" : ""}`} aria-label="Room details">
        <div className="side-brand">
          <svg viewBox="0 0 48 16" aria-hidden="true">
            <path d="M0 8h12l4-6 6 12 5-9 3 3h18" />
          </svg>
          Pulse
        </div>
        <UserList users={users} me={session.userId} />
        <div className="side-actions">
          <button type="button" className="btn-ghost" onClick={invite}>
            Copy invite link
          </button>
          <button type="button" className="btn-ghost danger" onClick={leave}>
            Leave room
          </button>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <section className="main">
        <header className="chat-header">
          <button type="button" className="icon-btn menu-btn" aria-label="Show people and options" onClick={() => setDrawer(true)}>
            ☰
          </button>
          <div className="header-title">
            <h2>#{session.room}</h2>
            <p>
              {users.length} {users.length === 1 ? "person" : "people"} here, you are {session.username}
            </p>
          </div>
          <StatusPill status={status} />
        </header>

        <div className="messages-wrap">
          <div className="messages" ref={listRef} onScroll={handleScroll} role="log" aria-live="polite" aria-label="Messages">
            {messages.length <= 1 && (
              <p className="empty">
                {users.length > 1
                  ? "Say hello. Everyone in the room sees it instantly."
                  : "You are the first one here. Copy the invite link and send it to someone to see messages arrive live."}
              </p>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const showHeader =
                m.type === "user" &&
                (!prev ||
                  prev.type !== "user" ||
                  prev.userId !== m.userId ||
                  new Date(m.timestamp) - new Date(prev.timestamp) > GROUP_GAP_MS);
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={m.userId === session.userId}
                  showHeader={showHeader}
                  me={session.userId}
                  onReact={react}
                />
              );
            })}
          </div>
          {unseen > 0 && (
            <button type="button" className="jump" onClick={() => scrollToBottom("smooth")}>
              {unseen} new {unseen === 1 ? "message" : "messages"}
            </button>
          )}
        </div>

        <TypingIndicator typers={typers} />
        <Composer onSend={sendMessage} onTyping={setTypingState} disabled={offline} />
      </section>
    </div>
  );
}
