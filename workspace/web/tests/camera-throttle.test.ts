import { describe, expect, it } from "vitest";
import type { CameraState } from "@shared/types";
import {
  createCameraThrottle,
  payloadEquals,
  type CameraPayload,
} from "../src/features/viewer/camera-throttle";

const cameraA: CameraState = { position: [1, 2, 3], target: [0, 1, 0] };
const cameraB: CameraState = { position: [2, 2, 3], target: [0, 1, 0] };
const cameraC: CameraState = { position: [3, 2, 3], target: [0, 1, 0] };
const payloadA: CameraPayload = { camera: cameraA, focalLength: 50 };

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
  send: (payload: CameraPayload) => boolean = () => true,
  intervalMs?: number,
) {
  return createCameraThrottle({ send, now: clock.now, schedule: clock.schedule, intervalMs });
}

describe("payloadEquals", () => {
  it("uses camera epsilon but requires exact focal length equality", () => {
    expect(payloadEquals(payloadA, { camera: { ...cameraA, position: [1.000001, 2, 3] }, focalLength: 50 })).toBe(true);
    expect(payloadEquals(payloadA, { camera: { ...cameraA, position: [1.01, 2, 3] }, focalLength: 50 })).toBe(false);
    expect(payloadEquals(payloadA, { camera: cameraA, focalLength: 85 })).toBe(false);
    expect(payloadEquals(payloadA, { camera: cameraA, focalLength: 50.0000001 })).toBe(false);
  });
});

describe("camera throttle", () => {
  it("sends the first payload immediately and clones its camera", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);

    expect(sent).toEqual([payloadA]);
    expect(sent[0]).not.toBe(payloadA);
    expect(sent[0]!.camera).not.toBe(payloadA.camera);
  });

  it("sends only the latest payload when the interval opens", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(20);
    throttle.update({ camera: cameraB, focalLength: 85 });
    clock.advance(30);

    expect(sent).toEqual([payloadA, { camera: cameraB, focalLength: 85 }]);
    expect(clock.scheduleCount()).toBe(1);
  });

  it("replaces an intermediate pending payload", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(20);
    throttle.update({ camera: cameraB, focalLength: 85 });
    clock.advance(10);
    throttle.update({ camera: cameraC, focalLength: 24 });
    clock.advance(50);

    expect(sent).toEqual([payloadA, { camera: cameraC, focalLength: 24 }]);
  });

  it("does not resend the last payload after a pending return to it", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(20);
    throttle.update({ camera: cameraB, focalLength: 85 });
    clock.advance(10);
    throttle.update(payloadA);
    clock.advance(50);

    expect(sent).toEqual([payloadA]);
  });

  it("sends when only focal length changes after the interval", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(50);
    throttle.update({ camera: cameraA, focalLength: 85 });

    expect(sent).toEqual([payloadA, { camera: cameraA, focalLength: 85 }]);
  });

  it("sends when only camera changes after the interval", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(50);
    throttle.update({ camera: cameraB, focalLength: 50 });

    expect(sent).toEqual([payloadA, { camera: cameraB, focalLength: 50 }]);
  });

  it("retries a failed send at the next window", () => {
    const clock = createFakeClock();
    let connected = false;
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return connected;
    });

    throttle.update(payloadA);
    connected = true;
    clock.advance(50);

    expect(sent).toEqual([payloadA, payloadA]);
  });

  it("cancels a pending send on dispose", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(20);
    throttle.update({ camera: cameraB, focalLength: 85 });
    throttle.dispose();
    throttle.update({ camera: cameraC, focalLength: 24 });
    clock.advance(50);

    expect(sent).toEqual([payloadA]);
    expect(clock.cancelledCount()).toBe(1);
  });

  it("does not send the same payload repeatedly", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    });

    throttle.update(payloadA);
    clock.advance(60);
    throttle.update(payloadA);
    throttle.update(payloadA);

    expect(sent).toEqual([payloadA]);
    expect(clock.scheduleCount()).toBe(0);
  });

  it("uses a custom interval", () => {
    const clock = createFakeClock();
    const sent: CameraPayload[] = [];
    const throttle = createTestThrottle(clock, (payload) => {
      sent.push(payload);
      return true;
    }, 100);

    throttle.update(payloadA);
    clock.advance(20);
    throttle.update({ camera: cameraB, focalLength: 85 });
    clock.advance(79);
    expect(sent).toHaveLength(1);
    clock.advance(1);

    expect(sent).toEqual([payloadA, { camera: cameraB, focalLength: 85 }]);
  });
});
