import type { ReactElement } from "react";

export function PlayIcon(): ReactElement {
  return <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>;
}

export function PauseIcon(): ReactElement {
  return <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>;
}

export function SkipStartIcon(): ReactElement {
  return <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M3 2.5h2v11H3zM13 2.5v11L6 8z" /></svg>;
}

export function SkipEndIcon(): ReactElement {
  return <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M11 2.5h2v11h-2zM3 2.5v11l7-5.5z" /></svg>;
}
