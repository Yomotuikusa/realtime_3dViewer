import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorWheel } from "../src/features/theme/ColorWheel";
import { hexToHsv, hsvToHex } from "../src/features/theme/color-convert";
import {
  colorAtPoint,
  hueAtPoint,
  isInRing,
  isInSquare,
  pointAtHue,
  pointAtSaturationValue,
  renderWheelImage,
  saturationValueAtPoint,
  WHEEL_RING_INNER,
  WHEEL_RING_OUTER,
  WHEEL_SIZE,
  WHEEL_SQUARE,
  WHEEL_SQUARE_ORIGIN,
} from "../src/features/theme/color-wheel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function pointEvent(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: pointerId },
  });
  return event;
}

function pixel(image: Uint8ClampedArray, x: number, y: number): number[] {
  const offset = (y * WHEEL_SIZE + x) * 4;
  return [...image.slice(offset, offset + 4)];
}

async function renderWheel(value: string, onChange: (hex: string) => void): Promise<{
  root: ReturnType<typeof createRoot>;
  wheel: HTMLDivElement;
}> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(ColorWheel, { value, onChange, label: "色" })));
  const wheel = host.querySelector(".theme-wheel");
  if (!(wheel instanceof HTMLDivElement)) throw new Error("wheel was not rendered");
  vi.spyOn(wheel, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: WHEEL_SIZE, bottom: WHEEL_SIZE,
    width: WHEEL_SIZE, height: WHEEL_SIZE, toJSON: () => ({}),
  });
  return { root, wheel };
}

afterEach(() => vi.restoreAllMocks());

describe("color wheel geometry", () => {
  it("maps hue directions and normalizes the result", () => {
    expect(hueAtPoint({ x: 88, y: 10 })).toBe(0);
    expect(hueAtPoint({ x: 166, y: 88 })).toBe(90);
    expect(hueAtPoint({ x: 88, y: 166 })).toBe(180);
    expect(hueAtPoint({ x: 10, y: 88 })).toBe(270);
    expect(hueAtPoint({ x: 88, y: 88 })).toBe(0);
    for (const hue of [-90, 0, 45, 90, 180, 270, 450]) {
      expect(hueAtPoint(pointAtHue(hue))).toBeGreaterThanOrEqual(0);
      expect(hueAtPoint(pointAtHue(hue))).toBeLessThan(360);
    }
  });

  it("maps hues and ring boundaries", () => {
    expect(pointAtHue(0)).toEqual({ x: 88, y: 11 });
    for (const hue of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const point = pointAtHue(hue);
      expect(Math.hypot(point.x - 88, point.y - 88)).toBeCloseTo(77, 6);
      expect(pointAtHue(hueAtPoint(point)).x).toBeCloseTo(point.x, 6);
      expect(pointAtHue(hueAtPoint(point)).y).toBeCloseTo(point.y, 6);
    }
    expect(isInRing({ x: 88, y: 88 - 77 })).toBe(true);
    expect(isInRing({ x: 88, y: 88 })).toBe(false);
    expect(isInRing({ x: 0, y: 0 })).toBe(false);
    expect(isInRing({ x: 88, y: 88 - WHEEL_RING_INNER })).toBe(true);
    expect(isInRing({ x: 88, y: 88 - WHEEL_RING_OUTER })).toBe(true);
  });

  it("maps the saturation/value square and clamps outside points", () => {
    expect(isInSquare({ x: 88, y: 88 })).toBe(true);
    expect(isInSquare({ x: WHEEL_SQUARE_ORIGIN, y: WHEEL_SQUARE_ORIGIN })).toBe(true);
    expect(isInSquare({ x: WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE, y: WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE })).toBe(true);
    expect(isInSquare({ x: 41, y: 88 })).toBe(false);
    for (const corner of [
      { x: WHEEL_SQUARE_ORIGIN, y: WHEEL_SQUARE_ORIGIN },
      { x: WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE, y: WHEEL_SQUARE_ORIGIN },
      { x: WHEEL_SQUARE_ORIGIN, y: WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE },
      { x: WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE, y: WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE },
    ]) expect(isInRing(corner)).toBe(false);
    expect(saturationValueAtPoint({ x: 42, y: 42 })).toEqual({ s: 0, v: 1 });
    expect(saturationValueAtPoint({ x: 134, y: 134 })).toEqual({ s: 1, v: 0 });
    expect(saturationValueAtPoint({ x: -100, y: 500 })).toEqual({ s: 0, v: 0 });
    expect(pointAtSaturationValue(0.5, 0.5)).toEqual({ x: 88, y: 88 });
    for (const values of [[0, 1], [0.25, 0.75], [0.5, 0.5], [1, 0]] as const) {
      const point = pointAtSaturationValue(values[0], values[1]);
      const result = saturationValueAtPoint(point);
      expect(result.s).toBeCloseTo(values[0], 6);
      expect(result.v).toBeCloseTo(values[1], 6);
    }
  });
});

describe("color wheel colors and image", () => {
  it("changes only the selected part of a color", () => {
    const cyan = "#22d3ee";
    expect(hexToHsv(colorAtPoint({ x: 88, y: 11 }, cyan)!)).toMatchObject({ h: 0 });
    expect(colorAtPoint({ x: 88, y: 11 }, "#808080")).toBe("#ff0000");
    expect(colorAtPoint({ x: 88, y: 11 }, "#000000")).toBe("#ff0000");
    expect(colorAtPoint({ x: 42, y: 42 }, cyan)).toBe("#ffffff");
    expect(hexToHsv(colorAtPoint({ x: 88, y: 88 }, cyan)!).h).toBeCloseTo(hexToHsv(cyan).h, 0);
    const centerColor = hexToHsv(colorAtPoint({ x: 88, y: 88 }, cyan)!);
    expect(centerColor.s).toBeCloseTo(0.5, 0);
    expect(centerColor.v).toBeCloseTo(0.5, 0);
    expect(colorAtPoint({ x: 0, y: 0 }, cyan)).toBeNull();
  });

  it("renders transparent outside pixels and the expected wheel colors", () => {
    const image = renderWheelImage(0);
    expect(image).toHaveLength(WHEEL_SIZE * WHEEL_SIZE * 4);
    expect(pixel(image, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(image, 175, 175)).toEqual([0, 0, 0, 0]);
    expect(pixel(image, 88, 10)).toEqual([255, 0, 0, 255]);
    const greenSquare = renderWheelImage(120);
    expect(pixel(greenSquare, 88, 10)).toEqual([255, 0, 0, 255]);
    expect(pixel(greenSquare, 42, 42)).toEqual([255, 255, 255, 255]);
    expect(pixel(greenSquare, 134, 42)).toEqual([0, 255, 0, 255]);
    expect(pixel(greenSquare, 88, 134)).toEqual([0, 0, 0, 255]);
  });
});

describe("ColorWheel", () => {
  it("renders its fixed DOM and follows value marker positions", async () => {
    const onChange = vi.fn();
    const { root, wheel } = await renderWheel("#22d3ee", onChange);
    try {
      expect(wheel.getAttribute("role")).toBe("group");
      expect(wheel.getAttribute("aria-label")).toBe("色");
      expect(wheel.querySelector("canvas.theme-wheel__canvas")?.getAttribute("aria-hidden")).toBe("true");
      expect((wheel.querySelector("canvas") as HTMLCanvasElement).width).toBe(WHEEL_SIZE);
      expect(wheel.querySelectorAll("i.theme-wheel__marker")).toHaveLength(2);
      const hueMarker = wheel.querySelector(".theme-wheel__marker--hue") as HTMLElement;
      const svMarker = wheel.querySelector(".theme-wheel__marker--sv") as HTMLElement;
      const huePoint = pointAtHue(hexToHsv("#22d3ee").h);
      const svPoint = pointAtSaturationValue(hexToHsv("#22d3ee").s, hexToHsv("#22d3ee").v);
      expect(hueMarker.style.getPropertyValue("--marker-x")).toBe(`${huePoint.x}px`);
      expect(hueMarker.style.getPropertyValue("--marker-y")).toBe(`${huePoint.y}px`);
      expect(svMarker.style.getPropertyValue("--marker-x")).toBe(`${svPoint.x}px`);
      expect(svMarker.style.getPropertyValue("--marker-y")).toBe(`${svPoint.y}px`);
      await act(async () => root.render(createElement(ColorWheel, { value: "#ff0000", onChange, label: "色" })));
      expect(hueMarker.style.getPropertyValue("--marker-x")).toBe(`${pointAtHue(0).x}px`);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("handles pointer selection and drag capture without PointerEvent APIs", async () => {
    const onChange = vi.fn();
    const { root, wheel } = await renderWheel("#22d3ee", onChange);
    try {
      const capture = vi.fn();
      const release = vi.fn();
      Object.assign(wheel, { setPointerCapture: capture, releasePointerCapture: release });
      wheel.dispatchEvent(pointEvent("pointermove", 88, 11));
      expect(onChange).not.toHaveBeenCalled();
      wheel.dispatchEvent(pointEvent("pointerdown", 88, 11));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(colorAtPoint({ x: 88, y: 11 }, "#22d3ee"));
      expect(capture).toHaveBeenCalledWith(1);
      wheel.dispatchEvent(pointEvent("pointermove", 134, 88));
      expect(hexToHsv(onChange.mock.lastCall?.[0] as string).s).toBeCloseTo(hexToHsv("#22d3ee").s, 2);
      wheel.dispatchEvent(pointEvent("pointerup", 134, 88));
      expect(release).toHaveBeenCalledWith(1);
      wheel.dispatchEvent(pointEvent("pointermove", 88, 11));
      expect(onChange).toHaveBeenCalledTimes(2);
      wheel.dispatchEvent(pointEvent("pointerdown", 0, 0));
      expect(onChange).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps the last chromatic hue for achromatic values", async () => {
    const onChange = vi.fn();
    const { root, wheel } = await renderWheel("#f97316", onChange);
    try {
      const hue = hexToHsv("#f97316").h;
      await act(async () => root.render(createElement(ColorWheel, { value: "#ffffff", onChange, label: "色" })));
      const marker = wheel.querySelector(".theme-wheel__marker--hue") as HTMLElement;
      const point = pointAtHue(hue);
      expect(marker.style.getPropertyValue("--marker-x")).toBe(`${point.x}px`);
      expect(marker.style.getPropertyValue("--marker-y")).toBe(`${point.y}px`);

      wheel.dispatchEvent(pointEvent("pointerdown", 88, 88));
      expect(onChange).toHaveBeenCalledWith(hsvToHex({ h: hue, s: 0.5, v: 0.5 }));
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("retains the grabbed hue while an SV drag crosses achromatic values", async () => {
    const onChange = vi.fn();
    const { root, wheel } = await renderWheel("#22d3ee", onChange);
    try {
      const hue = hexToHsv("#22d3ee").h;
      wheel.dispatchEvent(pointEvent("pointerdown", 42, 42));
      expect(onChange).toHaveBeenLastCalledWith("#ffffff");
      await act(async () => root.render(createElement(ColorWheel, { value: "#ffffff", onChange, label: "色" })));
      onChange.mockClear();
      wheel.dispatchEvent(pointEvent("pointermove", 88, 88));
      expect(onChange).toHaveBeenCalledWith(hsvToHex({ h: hue, s: 0.5, v: 0.5 }));
      wheel.dispatchEvent(pointEvent("pointerup", 88, 88));

      wheel.dispatchEvent(pointEvent("pointerdown", 88, 134));
      await act(async () => root.render(createElement(ColorWheel, { value: "#000000", onChange, label: "色" })));
      onChange.mockClear();
      wheel.dispatchEvent(pointEvent("pointermove", 134, 42));
      expect(onChange).toHaveBeenCalledWith(hsvToHex({ h: hue, s: 1, v: 1 }));
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps the grabbed side during drag and clamps an SV drag outside", async () => {
    const onChange = vi.fn();
    const { root, wheel } = await renderWheel("#22d3ee", onChange);
    try {
      wheel.dispatchEvent(pointEvent("pointerdown", 88, 11));
      onChange.mockClear();
      wheel.dispatchEvent(pointEvent("pointermove", 42, 42));
      expect(hexToHsv(onChange.mock.lastCall?.[0] as string).s).toBeCloseTo(hexToHsv("#22d3ee").s, 2);
      wheel.dispatchEvent(pointEvent("pointerup", 42, 42));
      wheel.dispatchEvent(pointEvent("pointerdown", 88, 88));
      onChange.mockClear();
      wheel.dispatchEvent(pointEvent("pointermove", -100, 500));
      expect(onChange).toHaveBeenCalledWith("#000000");
      wheel.dispatchEvent(pointEvent("pointercancel", -100, 500));
      onChange.mockClear();
      wheel.dispatchEvent(pointEvent("pointermove", 134, 42));
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
    }
  });
});
