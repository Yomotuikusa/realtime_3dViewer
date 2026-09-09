import type { ReactElement } from "react";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";

export function PresenceList(): ReactElement {
  const users = usePresenceStore((state) => state.users);
  const followingUserId = usePresenceStore((state) => state.followingUserId);
  const follow = usePresenceStore((state) => state.follow);
  const unfollow = usePresenceStore((state) => state.unfollow);
  const selfId = useSessionStore((state) => state.selfId);

  return (
    <section aria-label="参加者" style={{ marginTop: "1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>参加者</h2>
      <ul style={{ display: "grid", gap: "0.5rem", padding: 0, margin: 0, listStyle: "none" }}>
        {Object.values(users).map((user) => {
          const isSelf = user.id === selfId;
          const isFollowing = user.id === followingUserId;
          return (
            <li key={user.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                aria-hidden="true"
                style={{ width: "0.75rem", height: "0.75rem", flex: "0 0 auto", borderRadius: "50%", background: user.color }}
              />
              <span style={{ flex: 1 }}>{user.name}{isSelf ? " (あなた)" : ""}</span>
              {!isSelf && (
                <button type="button" onClick={() => (isFollowing ? unfollow() : follow(user.id))}>
                  {isFollowing ? "解除" : "Follow"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
