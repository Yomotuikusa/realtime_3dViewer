import type { CSSProperties, ReactElement } from "react";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { FOLLOW_LABEL, PRESENCE_HEADING, SELF_SUFFIX, UNFOLLOW_LABEL, presenceHeading } from "./presence-labels";
import "./presence.css";

export function PresenceList(): ReactElement {
  const users = usePresenceStore((state) => state.users);
  const followingUserId = usePresenceStore((state) => state.followingUserId);
  const follow = usePresenceStore((state) => state.follow);
  const unfollow = usePresenceStore((state) => state.unfollow);
  const selfId = useSessionStore((state) => state.selfId);

  const orderedUsers = Object.values(users).sort((left, right) => {
    const leftIsSelf = left.id === selfId;
    const rightIsSelf = right.id === selfId;
    if (leftIsSelf !== rightIsSelf) return leftIsSelf ? -1 : 1;
    return left.name.localeCompare(right.name, "ja");
  });

  return (
    <section className="presence" aria-label={PRESENCE_HEADING}>
      <h2 className="presence__heading">{presenceHeading(orderedUsers.length)}</h2>
      <ul className="presence__list">
        {orderedUsers.map((user) => {
          const isSelf = user.id === selfId;
          const isFollowing = user.id === followingUserId;
          return (
            <li
              key={user.id}
              className="presence__row"
              data-self={isSelf}
              data-following={isFollowing}
              style={{ "--user-color": user.color } as CSSProperties}
            >
              <i className="presence__dot" aria-hidden="true" />
              <span className="presence__name">{user.name}</span>
              {isSelf && <span className="badge" data-tone="neutral">{SELF_SUFFIX}</span>}
              {!isSelf && (
                <button
                  className="btn btn--quiet presence__follow"
                  type="button"
                  aria-pressed={isFollowing}
                  onClick={() => (isFollowing ? unfollow() : follow(user.id))}
                >
                  {isFollowing ? UNFOLLOW_LABEL : FOLLOW_LABEL}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
