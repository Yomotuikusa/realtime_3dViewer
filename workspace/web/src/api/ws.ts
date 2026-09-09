import type { ClientMessage, ServerMessage } from "@shared/protocol";
import { parseServerMessage } from "@shared/protocol";
import type { ConnectionStatus } from "../store/session";

export const RECONNECT_MIN_MS = 1000;
export const RECONNECT_MAX_MS = 10000;

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface WsClientOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  createSocket?: (url: string) => SocketLike;
}

const OPEN = 1;

export class WsClient {
  private readonly options: WsClientOptions;
  private readonly createSocket: (url: string) => SocketLike;
  private socket: SocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private failedAttempts = 0;
  private stopped = false;
  private currentStatus: ConnectionStatus = "closed";

  constructor(options: WsClientOptions) {
    this.options = options;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
  }

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  connect(): void {
    if (this.stopped || this.socket !== null || this.reconnectTimer !== null) {
      return;
    }

    this.setStatus("connecting");
    if (this.stopped) {
      return;
    }
    const socket = this.createSocket(this.options.url);
    this.socket = socket;
    let failureHandled = false;

    socket.onopen = () => {
      if (!this.isCurrent(socket) || failureHandled) {
        return;
      }
      this.failedAttempts = 0;
      this.setStatus("open");
    };
    socket.onmessage = (event) => {
      if (!this.isCurrent(socket) || failureHandled) {
        return;
      }
      const result = parseServerMessage(String(event.data));
      if (!result.ok) {
        console.warn("Invalid realtime message", result.error);
        return;
      }
      this.options.onMessage(result.msg);
    };
    socket.onerror = () => {
      if (!this.isCurrent(socket) || failureHandled || this.stopped) {
        return;
      }
      failureHandled = true;
      this.socket = null;
      this.scheduleReconnect();
    };
    socket.onclose = () => {
      if (!this.isCurrent(socket) || failureHandled || this.stopped) {
        return;
      }
      failureHandled = true;
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  send(msg: ClientMessage): boolean {
    if (this.socket?.readyState !== OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify(msg));
    return true;
  }

  close(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.currentStatus = "closed";
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.close();
    }
  }

  private isCurrent(socket: SocketLike): boolean {
    return this.socket === socket;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.stopped) {
      return;
    }
    this.currentStatus = status;
    this.options.onStatus(status);
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }
    this.setStatus("closed");
    if (this.stopped) {
      return;
    }
    const delay = Math.min(
      RECONNECT_MIN_MS * 2 ** this.failedAttempts,
      RECONNECT_MAX_MS,
    );
    this.failedAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export function wsUrl(projectId: string): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws?projectId=${encodeURIComponent(projectId)}`;
}
