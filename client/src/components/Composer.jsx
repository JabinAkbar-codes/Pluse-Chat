import React, { useEffect, useRef, useState } from "react";

const EMOJIS = ["😀", "😂", "😍", "🥳", "😮", "😢", "👍", "🙏", "🔥", "🎉", "❤️", "👀"];
const MAX = 500;

export default function Composer({ onSend, onTyping, disabled }) {
  const [text, setText] = useState("");
  const [tray, setTray] = useState(false);
  const inputRef = useRef(null);
  const typingRef = useRef(false);
  const idleTimer = useRef(null);

  const setTyping = (value) => {
    if (typingRef.current === value) return;
    typingRef.current = value;
    onTyping(value);
  };

  useEffect(
    () => () => {
      clearTimeout(idleTimer.current);
      if (typingRef.current) onTyping(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const resize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handleChange = (e) => {
    setText(e.target.value);
    resize();
    if (e.target.value.trim()) {
      setTyping(true);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setTyping(false), 1500);
    } else {
      setTyping(false);
    }
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    clearTimeout(idleTimer.current);
    setTyping(false);
    setText("");
    setTray(false);
    requestAnimationFrame(resize);
    const ok = await onSend(value);
    if (!ok) setText(value); // give the text back so nothing is lost
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const addEmoji = (emoji) => {
    setText((t) => (t + emoji).slice(0, MAX));
    inputRef.current?.focus();
  };

  return (
    <div className="composer-wrap">
      {tray && (
        <div className="emoji-tray" role="group" aria-label="Emoji">
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => addEmoji(emoji)} aria-label={`Insert ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          className="icon-btn"
          aria-label="Insert emoji"
          aria-expanded={tray}
          onClick={() => setTray((v) => !v)}
        >
          ☺
        </button>

        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={MAX}
          placeholder={disabled ? "Reconnecting..." : "Write a message"}
          aria-label="Message"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          enterKeyHint="send"
        />

        {text.length > 400 && (
          <span className={`counter ${text.length >= MAX ? "max" : ""}`}>
            {text.length}/{MAX}
          </span>
        )}

        <button type="submit" className="btn-send" disabled={disabled || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
