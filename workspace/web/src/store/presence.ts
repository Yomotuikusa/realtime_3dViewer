import { create } from "zustand";
import { cloneCamera } from "@shared/camera";
import type { CameraState, PresenceUser } from "@shared/types";

export interface PresenceStoreState {
  users: Record<string, PresenceUser>;
  followingUserId: string | null;
  applyWelcome(users: PresenceUser[]): void;
  upsertUser(user: PresenceUser): void;
  removeUser(userId: string): void;
  updateCamera(userId: string, camera: CameraState): void;
  follow(userId: string): void;
  unfollow(): void;
  reset(): void;
}

function cloneUser(user: PresenceUser): PresenceUser {
  return {
    ...user,
    camera: user.camera === null ? null : cloneCamera(user.camera),
  };
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  users: {},
  followingUserId: null,

  applyWelcome(users) {
    const nextUsers: Record<string, PresenceUser> = {};
    for (const user of users) {
      nextUsers[user.id] = cloneUser(user);
    }
    set({ users: nextUsers, followingUserId: null });
  },

  upsertUser(user) {
    set((state) => ({ users: { ...state.users, [user.id]: cloneUser(user) } }));
  },

  removeUser(userId) {
    if (!Object.hasOwn(get().users, userId)) {
      return;
    }
    set((state) => {
      const users = { ...state.users };
      delete users[userId];
      return {
        users,
        followingUserId: state.followingUserId === userId ? null : state.followingUserId,
      };
    });
  },

  updateCamera(userId, camera) {
    if (!Object.hasOwn(get().users, userId)) {
      return;
    }
    set((state) => ({
      users: {
        ...state.users,
        [userId]: { ...state.users[userId]!, camera: cloneCamera(camera) },
      },
    }));
  },

  follow(userId) {
    if (Object.hasOwn(get().users, userId)) {
      set({ followingUserId: userId });
    }
  },

  unfollow() {
    set({ followingUserId: null });
  },

  reset() {
    set({ users: {}, followingUserId: null });
  },
}));
