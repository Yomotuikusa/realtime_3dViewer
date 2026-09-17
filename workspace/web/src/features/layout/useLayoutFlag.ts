import { useState } from "react";
import { LAYOUT_FLAG_DEFAULTS, loadLayoutFlag, saveLayoutFlag, type LayoutFlagName } from "./layout-storage";

export function useLayoutFlag(name: LayoutFlagName): [value: boolean, setValue: (value: boolean) => void] {
  const [value, setState] = useState(() => loadLayoutFlag(name) ?? LAYOUT_FLAG_DEFAULTS[name]);
  const setValue = (nextValue: boolean): void => {
    setState(nextValue);
    saveLayoutFlag(name, nextValue);
  };
  return [value, setValue];
}
