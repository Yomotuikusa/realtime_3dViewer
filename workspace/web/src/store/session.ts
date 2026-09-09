import { create } from "zustand";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface SessionStoreState {
  selfId: string | null;
  color: string | null;
  name: string;
  connection: ConnectionStatus;
  lastError: string | null;
  setName(name: string): void;
  setSelf(selfId: string, color: string | null): void;
  setConnection(status: ConnectionStatus): void;
  setLastError(message: string | null): void;
  reset(): void;
}

const initialState = {
  selfId: null,
  color: null,
  name: "",
  connection: "closed" as ConnectionStatus,
  lastError: null,
};

export const useSessionStore = create<SessionStoreState>((set) => ({
  ...initialState,

  setName(name) {
    set({ name });
  },

  setSelf(selfId, color) {
    set({ selfId, color });
  },

  setConnection(connection) {
    set({ connection });
  },

  setLastError(lastError) {
    set({ lastError });
  },

  reset() {
    set({ ...initialState });
  },
}));
