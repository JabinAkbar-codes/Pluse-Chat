import React from "react";
import { useChat } from "./hooks/useChat";
import Login from "./components/Login";
import ChatRoom from "./components/ChatRoom";

export default function App() {
  const chat = useChat();

  return (
    <div className="app">
      {chat.session ? <ChatRoom chat={chat} /> : <Login chat={chat} />}
      {chat.notice && (
        <div className="toast" role="status">
          {chat.notice}
        </div>
      )}
    </div>
  );
}
