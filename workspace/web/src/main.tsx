// 骨組み。アプリ本体はタスク 005〜008 で実装する。
import { createRoot } from "react-dom/client";
import { SHARED_SCAFFOLD } from "@shared/index";

createRoot(document.getElementById("root")!).render(<p>3D Reviewer scaffold ({String(SHARED_SCAFFOLD)})</p>);
