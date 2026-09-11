export interface SendThrottleDeps<T> {
  /** 送信。false なら未送信扱い(タイマーまたは次の更新で再試行) */
  send: (value: T) => boolean;
  now: () => number;
  /** delayMs 後に fn を呼ぶ。戻り値はキャンセル関数 */
  schedule: (fn: () => void, delayMs: number) => () => void;
  /** 同値判定。等しければ送信しない */
  equals: (a: T, b: T) => boolean;
  /** 値の複製。保持する値は必ずこれを通す */
  clone: (value: T) => T;
  /** 送信間隔(ms) */
  intervalMs: number;
}

export interface SendThrottle<T> {
  /** 最新値を通知する。間隔内なら保持し、窓明けに最新値だけを送る */
  update(value: T): void;
  /** 送信せずに最後に送った値として記録し、保留中の送信を捨てる */
  markSent(value: T): void;
  /** 保留中の送信とタイマーを破棄する */
  dispose(): void;
}

export function createSendThrottle<T>(deps: SendThrottleDeps<T>): SendThrottle<T> {
  let lastSentValue: T | null = null;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let pendingValue: T | null = null;
  let cancelScheduled: (() => void) | null = null;
  let disposed = false;

  const clearSchedule = (): void => {
    cancelScheduled?.();
    cancelScheduled = null;
  };

  const schedulePending = (delayMs: number): void => {
    if (cancelScheduled !== null || disposed) {
      return;
    }
    cancelScheduled = deps.schedule(() => {
      cancelScheduled = null;
      trySendPending();
    }, delayMs);
  };

  const trySendPending = (): void => {
    if (disposed || pendingValue === null) {
      return;
    }

    const now = deps.now();
    if (now - lastSentAt < deps.intervalMs) {
      schedulePending(deps.intervalMs - (now - lastSentAt));
      return;
    }

    const value = deps.clone(pendingValue);
    if (lastSentValue !== null && deps.equals(lastSentValue, value)) {
      pendingValue = null;
      return;
    }
    if (deps.send(value)) {
      lastSentValue = deps.clone(value);
      lastSentAt = now;
      pendingValue = null;
      clearSchedule();
      return;
    }
    schedulePending(deps.intervalMs);
  };

  const update = (value: T): void => {
    if (disposed) {
      return;
    }
    const nextValue = deps.clone(value);
    if (lastSentValue !== null && deps.equals(lastSentValue, nextValue)) {
      pendingValue = null;
      clearSchedule();
      return;
    }
    pendingValue = nextValue;
    const now = deps.now();
    if (now - lastSentAt < deps.intervalMs) {
      schedulePending(deps.intervalMs - (now - lastSentAt));
      return;
    }
    trySendPending();
  };

  return {
    update,
    markSent(value) {
      if (disposed) {
        return;
      }
      lastSentValue = deps.clone(value);
      pendingValue = null;
      clearSchedule();
    },
    dispose() {
      disposed = true;
      pendingValue = null;
      clearSchedule();
    },
  };
}
