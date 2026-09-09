import { useId, useState, type FormEvent, type ReactElement } from "react";
import { MAX_NAME_LENGTH } from "@shared/protocol";
import { loadStoredName, resolveDisplayName, saveName } from "./display-name";

export function JoinDialog({ onJoin }: { onJoin: (name: string) => void }): ReactElement {
  const titleId = useId();
  const [input, setInput] = useState(() => loadStoredName());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = resolveDisplayName(input);
    saveName(name);
    onJoin(name);
  };

  return (
    <div className="review-backdrop">
      <form
        className="review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <h2 id={titleId}>レビュー空間に入室</h2>
        <p className="review-dialog__help">空欄のまま入室すると Guest 名が付きます。</p>
        <label className="field">
          <span className="field__label">表示名</span>
          <input
            className="input"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="name"
            autoFocus
          />
        </label>
        <button className="btn btn--primary" type="submit">入室する</button>
      </form>
    </div>
  );
}
