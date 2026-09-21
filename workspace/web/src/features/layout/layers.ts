/**
 * 3D 内 Html の重なり順。値の出典は styles/tokens.css の --z-canvas-* で、
 * 一致は tests/ui-layers.test.ts が検査する。
 * drei の zIndexRange は [カメラに近い側, 遠い側] の順。
 */

/** コメントピン・リモートカメラ名札。カメラに近いものほど手前に出る。 */
export const CANVAS_OVERLAY_Z_RANGE: [number, number] = [1000, 0];

/** コメント吹き出し。距離に依らず固定し、常にピンより 1 段手前に置く。 */
export const CANVAS_CALLOUT_Z_RANGE: [number, number] = [1001, 1001];
