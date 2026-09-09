import type { ConnectionStatus } from "../store/session";

export type ConnectionTone = "neutral" | "success" | "warning" | "danger";

export function connectionLabel(status: ConnectionStatus, joined: boolean): string {
  if (!joined) {
    return "未入室";
  }
  if (status === "open") {
    return "接続中";
  }
  if (status === "connecting") {
    return "再接続中…";
  }
  return "切断";
}

export function connectionTone(status: ConnectionStatus, joined: boolean): ConnectionTone {
  if (!joined) {
    return "neutral";
  }
  if (status === "open") {
    return "success";
  }
  if (status === "connecting") {
    return "warning";
  }
  return "danger";
}

export type CopyState = "idle" | "copied" | "failed";

export function copyLabel(state: CopyState): string {
  if (state === "copied") {
    return "コピーしました";
  }
  if (state === "failed") {
    return "コピーできません。下の URL を選択してください";
  }
  return "URL をコピー";
}

export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined,
): Promise<CopyState> {
  if (!clipboard) {
    return "failed";
  }
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export const LOADING_MESSAGE = "プロジェクトを読み込んでいます…";
export const PROJECT_LOAD_FAILED = "プロジェクトの取得に失敗しました。";
export const MODEL_LOAD_FAILED = "モデルの読み込みに失敗しました。";
export const RELOAD_LABEL = "再読み込み";
