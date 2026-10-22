import { useCallback, useEffect, useRef, useState } from "react";
import { socket, getClientId } from "../socket";

const MAX_MESSAGES = 300;
const NOTICE_MS = 4500;

/**
 * All real-time state lives here so components stay presentational.
 * Handles: connection status, live stats, joining, history, reconnect + auto-rejoin,
 * typing, reactions and sending.
 */
export function useChat() {
  const [status, setStatus] = useState("connecting"); // connecting | online | offline
  const [stats, setStats] = useState({ online: 0, rooms: [] });
  const [session, setSession] = useState(null); // { room, username, userId }
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState({}); // userId -> username
  const [notice, setNotice] = useState("");

  const sessionRef = useRef(null);
  const noticeTimer = useRef(null);

  const showNotice = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), NOTICE_MS);
  }, []);

  const applyJoin = useCallback((res) => {
    const next = { room: res.room, username: res.me.username, userId: res.me.id };
    sessionRef.current = next;
    setSession(next);
    setMessages(res.history);
    setUsers(res.users);
    setTyping({});
  }, []);

  const emitJoin = useCallback(
    (username, room) =>
      new Promise((resolve) => {
        socket
          .timeout(8000)
          .emit("join_room", { username, room, clientId: getClientId() }, (err, res) => {
            if (err) {
              resolve({ ok: false, error: "The server didn't respond. Check your connection and try again." });
            } else {
              resolve(res);
            }
          });
      }),
    []
  );

  useEffect(() => {
    const onConnect = async () => {
      setStatus("online");
      // After a drop the server has forgotten our room: silently sit back down
      // and replace local messages with the server history so nothing is missed.
      const current = sessionRef.current;
      if (!current) return;
      const res = await emitJoin(current.username, current.room);
      if (res.ok) {
        applyJoin(res);
      } else {
        sessionRef.current = null;
        setSession(null);
        showNotice(res.error);
      }
    };
    const onDisconnect = () => setStatus("offline");
    const onRetry = () => setStatus("connecting");

    const onStats = (s) => setStats(s);
    const onUsers = (list) => {
      setUsers(list);
      setTyping((prev) => {
        const present = new Set(list.map((u) => u.id));
        const next = {};
        Object.entries(prev).forEach(([id, name]) => {
          if (present.has(id)) next[id] = name;
        });
        return next;
      });
    };
    const onMessage = (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message].slice(-MAX_MESSAGES)
      );
      if (message.type === "user") {
        setTyping((prev) => {
          if (!(message.userId in prev)) return prev;
          const { [message.userId]: _gone, ...rest } = prev;
          return rest;
        });
      }
    };
    const onReaction = ({ messageId, reactions }) =>
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    const onTyping = ({ userId, username, isTyping }) =>
      setTyping((prev) => {
        if (isTyping) return prev[userId] ? prev : { ...prev, [userId]: username };
        if (!(userId in prev)) return prev;
        const { [userId]: _gone, ...rest } = prev;
        return rest;
      });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onRetry);
    socket.on("connect_error", onRetry);
    socket.on("stats", onStats);
    socket.on("user_list", onUsers);
    socket.on("receive_message", onMessage);
    socket.on("reaction_update", onReaction);
    socket.on("typing", onTyping);

    if (!socket.connected) socket.connect();
    else setStatus("online");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onRetry);
      socket.off("connect_error", onRetry);
      socket.off("stats", onStats);
      socket.off("user_list", onUsers);
      socket.off("receive_message", onMessage);
      socket.off("reaction_update", onReaction);
      socket.off("typing", onTyping);
    };
  }, [applyJoin, emitJoin, showNotice]);

  const join = useCallback(
    async (username, room) => {
      const res = await emitJoin(username, room);
      if (res.ok) {
        applyJoin(res);
        try {
          localStorage.setItem("pulse:username", username);
        } catch {
          /* storage unavailable: fine */
        }
      }
      return res;
    },
    [applyJoin, emitJoin]
  );

  const leave = useCallback(() => {
    socket.emit("leave_room", {});
    sessionRef.current = null;
    setSession(null);
    setMessages([]);
    setUsers([]);
    setTyping({});
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const sendMessage = useCallback(
    (text) =>
      new Promise((resolve) => {
        socket.timeout(6000).emit("send_message", { text }, (err, res) => {
          if (err) {
            showNotice("Message not sent. Check your connection.");
            resolve(false);
          } else if (!res.ok) {
            showNotice(res.error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      }),
    [showNotice]
  );

  const react = useCallback((messageId, emoji) => socket.emit("react", { messageId, emoji }), []);
  const setTypingState = useCallback((isTyping) => socket.emit("typing", { isTyping }), []);

  return {
    status,
    stats,
    session,
    messages,
    users,
    typers: Object.values(typing),
    notice,
    showNotice,
    join,
    leave,
    sendMessage,
    react,
    setTypingState,
  };
}
