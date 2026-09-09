import { useState, type FormEvent, type ReactElement } from "react";
import { loadStoredName, resolveDisplayName, saveName } from "./display-name";

export function JoinDialog({ onJoin }: { onJoin: (name: string) => void }): ReactElement {
  const [input, setInput] = useState(() => loadStoredName());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = resolveDisplayName(input);
    saveName(name);
    onJoin(name);
  };

  return (
    <form
      aria-label="レビュー空間に入室"
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: "0.75rem", maxWidth: "24rem", padding: "1.25rem", background: "#fff", border: "1px solid #d0d5dd", borderRadius: "0.5rem" }}
    >
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>レビュー空間に入室</h2>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        表示名
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="name"
        />
      </label>
      <button type="submit">入室する</button>
    </form>
  );
}
