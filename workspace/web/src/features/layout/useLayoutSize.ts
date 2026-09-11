import { useState } from "react";
import { loadLayoutSize, saveLayoutSize } from "./layout-storage";
import { LAYOUT_SIZE_SPECS, type LayoutSizeName } from "./resize";

export function useLayoutSize(name: LayoutSizeName): [value: number, setValue: (value: number) => void] {
  const [value, setState] = useState(() => loadLayoutSize(name) ?? LAYOUT_SIZE_SPECS[name].defaultValue);
  const setValue = (nextValue: number): void => {
    setState(nextValue);
    saveLayoutSize(name, nextValue);
  };
  return [value, setValue];
}
