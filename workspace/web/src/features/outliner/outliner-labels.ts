import type { OutlinerNodeKind } from "./outliner-tree";

export const OUTLINER_HEADING = "アウトライナ";
export const OUTLINER_VISIBILITY_HEADING = "表示";
export const OUTLINER_RESIZE_LABEL = "アウトライナの幅";
export const OUTLINER_EMPTY = "オブジェクトがありません";
export const OUTLINER_LOADING = "読み込み中…";
export const UNNAMED_LABEL = "(名前なし)";

export const KIND_LABELS: Readonly<Record<OutlinerNodeKind, string>> = {
  mesh: "メッシュ",
  curve: "カーブ",
  points: "ポイント",
  bone: "ボーン",
  light: "ライト",
  camera: "カメラ",
  group: "グループ",
};

export function nodeLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? UNNAMED_LABEL : trimmed;
}

export function expandAriaLabel(label: string, expanded: boolean): string {
  return `${label} を${expanded ? "折りたたむ" : "展開"}`;
}

export function visibilityAriaLabel(label: string): string {
  return `${label} の表示を切り替え`;
}
