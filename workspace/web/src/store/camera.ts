import { create } from "zustand";
import { DEFAULT_FOCAL_LENGTH_MM, type CameraState } from "@shared/types";
import { cameraEquals, clampFocalLength, cloneCamera, DEFAULT_CAMERA } from "@shared/camera";

export interface CameraStoreState {
  /** 最後に確定した自分の視点。初期値は DEFAULT_CAMERA */
  selfCamera: CameraState;
  /** 再現要求(コメント再現・Follow 解除後の移動)。CameraRig が消費する */
  pendingCamera: CameraState | null;
  /** Reset(初期視点へ即座に戻す)のトリガ。初期値 0 */
  resetSeq: number;
  /** Fit(全体表示)のトリガ。初期値 0 */
  fitSeq: number;
  /** モデルのバウンディングボックスの最大辺長。初期値 1。017 の simplifyTolerance でも使う */
  modelSize: number;
  /** 焦点距離(mm)。初期値は DEFAULT_FOCAL_LENGTH_MM */
  focalLength: number;

  /** cameraEquals(既定 eps)で現在値と同じなら state を更新しない */
  setSelfCamera(camera: CameraState): void;
  /** pendingCamera に cloneCamera した値を積む */
  requestCamera(camera: CameraState): void;
  /** pendingCamera を返して null に戻す */
  consumePendingCamera(): CameraState | null;
  /** resetSeq を増やし、焦点距離を既定値へ戻す */
  requestReset(): void;
  requestFit(): void;
  setModelSize(size: number): void;
  /** clampFocalLength した焦点距離を設定する */
  setFocalLength(focalLengthMm: number): void;
  /** テスト用。全 state を初期値へ戻す */
  reset(): void;
}

function initialCameraState(): CameraState {
  return cloneCamera(DEFAULT_CAMERA);
}

export const useCameraStore = create<CameraStoreState>((set, get) => ({
  selfCamera: initialCameraState(),
  pendingCamera: null,
  resetSeq: 0,
  fitSeq: 0,
  modelSize: 1,
  focalLength: DEFAULT_FOCAL_LENGTH_MM,

  setSelfCamera(camera) {
    if (cameraEquals(get().selfCamera, camera)) {
      return;
    }
    set({ selfCamera: cloneCamera(camera) });
  },

  requestCamera(camera) {
    set({ pendingCamera: cloneCamera(camera) });
  },

  consumePendingCamera() {
    const pendingCamera = get().pendingCamera;
    if (pendingCamera === null) {
      return null;
    }
    set({ pendingCamera: null });
    return cloneCamera(pendingCamera);
  },

  requestReset() {
    set((state) => ({ resetSeq: state.resetSeq + 1, focalLength: DEFAULT_FOCAL_LENGTH_MM }));
  },

  requestFit() {
    set((state) => ({ fitSeq: state.fitSeq + 1 }));
  },

  setModelSize(size) {
    if (size <= 0 || size === get().modelSize) {
      return;
    }
    set({ modelSize: size });
  },

  setFocalLength(focalLengthMm) {
    const next = clampFocalLength(focalLengthMm);
    if (next === get().focalLength) {
      return;
    }
    set({ focalLength: next });
  },

  reset() {
    set({
      selfCamera: initialCameraState(),
      pendingCamera: null,
      resetSeq: 0,
      fitSeq: 0,
      modelSize: 1,
      focalLength: DEFAULT_FOCAL_LENGTH_MM,
    });
  },
}));
