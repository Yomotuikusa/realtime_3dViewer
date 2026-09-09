import { beforeEach, describe, expect, it } from "vitest";
import type { CameraState, PresenceUser } from "@shared/types";
import { usePresenceStore } from "../src/store/presence";

const camera: CameraState = { position: [1, 2, 3], target: [0, 1, 0] };
const otherCamera: CameraState = { position: [3, 2, 1], target: [1, 0, 0] };
const userA: PresenceUser = { id: "a", name: "Alice", color: "#112233", camera: null };
const userB: PresenceUser = { id: "b", name: "Bob", color: "#445566", camera: otherCamera };

beforeEach(() => {
  usePresenceStore.getState().reset();
});

describe("presence store", () => {
  it("starts empty and replaces all users on welcome", () => {
    expect(usePresenceStore.getState()).toMatchObject({ users: {}, followingUserId: null });
    usePresenceStore.getState().upsertUser(userA);
    usePresenceStore.getState().applyWelcome([userA, userB]);
    expect(usePresenceStore.getState().users).toEqual({ a: userA, b: userB });

    usePresenceStore.getState().follow("a");
    usePresenceStore.getState().applyWelcome([]);
    expect(usePresenceStore.getState()).toMatchObject({ users: {}, followingUserId: null });
  });

  it("upserts by id with the latest user data", () => {
    usePresenceStore.getState().upsertUser(userA);
    usePresenceStore.getState().upsertUser({ ...userA, name: "Ari" });
    expect(usePresenceStore.getState().users).toEqual({ a: { ...userA, name: "Ari" } });
  });

  it("removes known users and ignores unknown users", () => {
    usePresenceStore.getState().applyWelcome([userA, userB]);
    usePresenceStore.getState().removeUser("nope");
    expect(Object.keys(usePresenceStore.getState().users)).toHaveLength(2);
    usePresenceStore.getState().removeUser("a");
    expect(usePresenceStore.getState().users).toEqual({ b: userB });
  });

  it("clears only a follow that points to the removed user", () => {
    usePresenceStore.getState().applyWelcome([userA, userB]);
    usePresenceStore.getState().follow("a");
    usePresenceStore.getState().removeUser("b");
    expect(usePresenceStore.getState().followingUserId).toBe("a");
    usePresenceStore.getState().removeUser("a");
    expect(usePresenceStore.getState().followingUserId).toBeNull();
  });

  it("updates only a known user's camera", () => {
    usePresenceStore.getState().applyWelcome([userA]);
    usePresenceStore.getState().updateCamera("a", camera);
    expect(usePresenceStore.getState().users.a).toEqual({ ...userA, camera });
    const before = usePresenceStore.getState().users;
    usePresenceStore.getState().updateCamera("nope", otherCamera);
    expect(usePresenceStore.getState().users).toBe(before);
  });

  it("follows known users, ignores unknown users, and can unfollow", () => {
    usePresenceStore.getState().upsertUser(userA);
    usePresenceStore.getState().follow("a");
    expect(usePresenceStore.getState().followingUserId).toBe("a");
    usePresenceStore.getState().follow("nope");
    expect(usePresenceStore.getState().followingUserId).toBe("a");
    usePresenceStore.getState().unfollow();
    expect(usePresenceStore.getState().followingUserId).toBeNull();
  });

  it("resets all presence state", () => {
    usePresenceStore.getState().upsertUser(userA);
    usePresenceStore.getState().follow("a");
    usePresenceStore.getState().reset();
    expect(usePresenceStore.getState()).toMatchObject({ users: {}, followingUserId: null });
  });
});
