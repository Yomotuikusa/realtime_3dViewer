import { describe, expect, it } from "vitest";
import type { CameraState } from "@shared/types";
import { createCameraThrottle } from "../src/features/viewer/camera-throttle";

const cameraA: CameraState = { position: [1, 2, 3], target: [0, 1, 0] };
const cameraB: CameraState = { position: [2, 2, 3], target: [0, 1, 0] };
const cameraC: CameraState = { position: [3, 2, 3], target: [0, 1, 0] };

interface FakeClock {
  now: () => number;
  advance(deltaMs: number): void;
  scheduleCount: () => number;
  cancelledCount: () => number;
  schedule(fn: () => void, delayMs: number): () => void;
}

function createFakeClock(): FakeClock {
  let currentTime = 0;
  let nextId = 0;
  let tasks: { id: number; at: number; fn: () => void; cancelled: boolean }[] = [];
  let scheduled = 0;
  let cancelled = 0;

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
      scheduled += 1;
      return () => {
        if (!task.cancelled) {
          task.cancelled = true;
          cancelled += 1;
        }
      };
    },
    scheduleCount: () => scheduled,
    cancelledCount: () => cancelled,
  };
}

function createTestThrottle(
  clock: FakeClock,
  send: (camera: CameraState) => boolean = () => true,
) {
  return createCameraThrottle({ send, now: clock.now, schedule: clock.schedule });
}

describe("camera throttle", () => {
  it("sends the first camera immediately", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);

    expect(sent).toEqual([cameraA]);
  });

  it("sends only the latest camera when the interval opens", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);
    clock.advance(20);
    throttle.update(cameraB);
    clock.advance(30);

    expect(sent).toEqual([cameraA, cameraB]);
    expect(clock.scheduleCount()).toBe(1);
  });

  it("replaces an intermediate pending camera", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);
    clock.advance(20);
    throttle.update(cameraB);
    clock.advance(10);
    throttle.update(cameraC);
    clock.advance(50);

    expect(sent).toEqual([cameraA, cameraC]);
  });

  it("does not resend the last camera after a pending return to it", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);
    clock.advance(20);
    throttle.update(cameraB);
    clock.advance(10);
    throttle.update(cameraA);
    clock.advance(50);

    expect(sent).toEqual([cameraA]);
  });

  it("sends immediately after the interval without scheduling a timer", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);
    clock.advance(60);
    throttle.update(cameraB);

    expect(sent).toEqual([cameraA, cameraB]);
    expect(clock.scheduleCount()).toBe(0);
  });

  it("retries a failed send at the next window", () => {
    const clock = createFakeClock();
    let connected = false;
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return connected;
    });

    throttle.update(cameraA);
    connected = true;
    clock.advance(50);

    expect(sent).toEqual([cameraA, cameraA]);
  });

  it("cancels a pending send on dispose", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);
    clock.advance(20);
    throttle.update(cameraB);
    throttle.dispose();
    clock.advance(50);

    expect(sent).toEqual([cameraA]);
    expect(clock.cancelledCount()).toBe(1);
  });

  it("does not send the same camera repeatedly", () => {
    const clock = createFakeClock();
    const sent: CameraState[] = [];
    const throttle = createTestThrottle(clock, (camera) => {
      sent.push(camera);
      return true;
    });

    throttle.update(cameraA);
    clock.advance(60);
    throttle.update(cameraA);
    throttle.update(cameraA);

    expect(sent).toEqual([cameraA]);
    expect(clock.scheduleCount()).toBe(0);
  });
});
