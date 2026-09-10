/** ショートカットを割り当てられる操作。 */
export type ShortcutAction = "pen" | "comment" | "clearMode" | "viewReset" | "viewFit";

/** 正規化したキー割り当て。`"KeyP"` または `"Shift+KeyP"` の形だけを取る。 */
export type Binding = string;

/** action -> binding。null は未割り当て。 */
export type Keymap = Readonly<Record<ShortcutAction, Binding | null>>;

/** 設定画面の表示順であり、重複割り当てが残っていたときの優先順でもある。 */
export const ACTION_ORDER: readonly ShortcutAction[] = [
  "pen",
  "comment",
  "clearMode",
  "viewReset",
  "viewFit",
];

export const DEFAULT_KEYMAP: Keymap = {
  pen: "KeyP",
  comment: "KeyC",
  clearMode: "Escape",
  viewReset: "KeyR",
  viewFit: "KeyF",
};

/** KeyboardEvent から割り当て判定に使う部分だけを取り出した形。 */
export interface KeyChord {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** 発火判定に使う入力。KeyboardEvent をそのまま渡せる。 */
export interface ShortcutEventLike extends KeyChord {
  repeat: boolean;
  isComposing: boolean;
}

const ASSIGNABLE_CODE_PATTERN = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Escape|Space|Backspace|Delete|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|Minus|Equal|Bracket(?:Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote)$/;

export function isModifierCode(code: string): boolean {
  return /^(?:Shift|Control|Alt|Meta)(?:Left|Right)$/.test(code);
}

export function isAssignableCode(code: string): boolean {
  return ASSIGNABLE_CODE_PATTERN.test(code);
}

export function bindingFromChord(chord: KeyChord): Binding | null {
  if (chord.ctrlKey || chord.metaKey || chord.altKey || !isAssignableCode(chord.code)) {
    return null;
  }
  return chord.shiftKey ? `Shift+${chord.code}` : chord.code;
}

export function isValidBinding(value: unknown): value is Binding {
  if (typeof value !== "string") {
    return false;
  }
  const code = value.startsWith("Shift+") ? value.slice("Shift+".length) : value;
  return isAssignableCode(code) && value === (code === value ? code : `Shift+${code}`);
}

export function resolveAction(keymap: Keymap, event: ShortcutEventLike): ShortcutAction | null {
  if (event.repeat || event.isComposing) {
    return null;
  }
  const binding = bindingFromChord(event);
  if (binding === null) {
    return null;
  }
  return ACTION_ORDER.find((action) => keymap[action] === binding) ?? null;
}

export function applyBinding(
  keymap: Keymap,
  action: ShortcutAction,
  binding: Binding | null,
): Keymap {
  const next: Record<ShortcutAction, Binding | null> = { ...keymap };
  for (const otherAction of ACTION_ORDER) {
    if (otherAction !== action && next[otherAction] === binding && binding !== null) {
      next[otherAction] = null;
    }
  }
  next[action] = binding;
  return next;
}

const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  Escape: "Esc",
  Space: "Space",
  Backspace: "Backspace",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
};

function formatCode(code: string): string {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice("Key".length);
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice("Digit".length);
  }
  return DISPLAY_NAMES[code] ?? code;
}

export function formatBinding(binding: Binding | null): string {
  if (binding === null) {
    return "未割り当て";
  }
  const code = binding.startsWith("Shift+") ? binding.slice("Shift+".length) : binding;
  return `${binding.startsWith("Shift+") ? "Shift+" : ""}${formatCode(code)}`;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    return true;
  }
  return target.closest("[contenteditable]:not([contenteditable='false'])") !== null;
}
