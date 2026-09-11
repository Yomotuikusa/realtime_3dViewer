import { describe, expect, it, vi } from "vitest";
import { createSendThrottle, type SendThrottle } from "../src/features/viewer/send-throttle";

interface FakeClock {
  now: () => number;
  advance(deltaMs: number): void;
  schedule(fn: () => void, delayMs: number): () => void;
}

function createFakeClock(): FakeClock {
  let currentTime = 0;
  let nextId = 0;
  let tasks: { id: number; at: number; fn: () => void; cancelled: boolean }[] = [];

  return {
    now: () => currentTime,
    advance(deltaMs) {
      currentTime += deltaMs;
      let task: typeof tasks[number] | undefined;
      while ((task = tasks.filter((candidate) => !candidate.cancelled && candidate.at <= currentTime)
        .sort((left, right) => left.at - right.at || left.id - right.id)[0]) !== undefined) {
        tasks = tasks.filter((candidate) => candidate !== task);
        task.fn();
      }
    },
    schedule(fn, delayMs) {
      const task = { id: nextId++, at: currentTime + delayMs, fn, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
  };
}

function createTestThrottle(
  clock: FakeClock,
  send: (value: string) => boolean = () => true,
): SendThrottle<string> {
  return createSendThrottle({
    send,
    now: clock.now,
    schedule: clock.schedule,
    equals: (left, right) => left === right,
    clone: (value) => value,
    intervalMs: 50,
  });
}

describe("createSendThrottle", () => {
  it("sends the first value immediately", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const throttle = createTestThrottle(clock, send);

    throttle.update("a");

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("a");
  });

  it("sends the latest pending value when the interval opens", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const throttle = createTestThrottle(clock, send);

    throttle.update("a");
    clock.advance(20);
    throttle.update("b");
    expect(send).toHaveBeenCalledTimes(1);
    clock.advance(30);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith("b");
  });

  it("drops a pending value when markSent records it", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const throttle = createTestThrottle(clock, send);

    throttle.update("a");
    clock.advance(20);
    throttle.update("b");
    throttle.markSent("b");
    clock.advance(30);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("treats markSent as the latest sent value without consuming the interval", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const throttle = createTestThrottle(clock, send);

    throttle.markSent("b");
    throttle.update("b");
    expect(send).not.toHaveBeenCalled();
    throttle.update("a");

    expect(send).toHaveBeenCalledWith("a");
  });

  it("delays a new value after markSent when the prior send was recent", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const throttle = createTestThrottle(clock, send);

    throttle.update("a");
    clock.advance(20);
    throttle.markSent("b");
    throttle.update("c");
    expect(send).toHaveBeenCalledTimes(1);
    clock.advance(30);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith("c");
  });

  it("does nothing after dispose", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const throttle = createTestThrottle(clock, send);

    throttle.update("a");
    throttle.dispose();
    throttle.markSent("b");
    throttle.update("c");
    clock.advance(100);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("drops a failed pending value when markSent records it", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => false);
    const throttle = createTestThrottle(clock, send);

    throttle.update("a");
    throttle.markSent("a");
    clock.advance(50);

    expect(send).toHaveBeenCalledOnce();
  });

  it("clones values retained by markSent", () => {
    const clock = createFakeClock();
    const send = vi.fn(() => true);
    const clone = vi.fn((value: { id: string }) => ({ ...value }));
    const throttle = createSendThrottle({
      send,
      now: clock.now,
      schedule: clock.schedule,
      equals: (left, right) => left.id === right.id,
      clone,
      intervalMs: 50,
    });
    const marked = { id: "b" };

    throttle.markSent(marked);
    marked.id = "a";
    throttle.update({ id: "b" });

    expect(send).not.toHaveBeenCalled();
    expect(clone).toHaveBeenCalled();
  });
});
