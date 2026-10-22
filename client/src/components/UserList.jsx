import React from "react";
import Avatar from "./Avatar";

export default function UserList({ users, me }) {
  return (
    <section className="user-list" aria-label="People in this room">
      <h3>
        In this room <span className="count">{users.length}</span>
      </h3>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            <Avatar name={u.username} size={30} />
            <span className="user-name">{u.username}</span>
            {u.id === me && <span className="you-tag">You</span>}
            <span className="live-dot on" title="Online" />
          </li>
        ))}
      </ul>
    </section>
  );
}
