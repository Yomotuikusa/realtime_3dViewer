import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/controls.css";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(<App />);
