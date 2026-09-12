export const RECORD_FRAME_STORAGE_KEY = "3dreviewer:comment-record-frame";

/** フレーム自動記録の設定を読む。未保存・読取不可なら true。 */
export function loadRecordFrame(): boolean {
  try {
    return localStorage.getItem(RECORD_FRAME_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** フレーム自動記録の設定を保存する。 */
export function saveRecordFrame(value: boolean): void {
  try {
    localStorage.setItem(RECORD_FRAME_STORAGE_KEY, String(value));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
