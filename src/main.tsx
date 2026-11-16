import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";

if (/Mac/.test(navigator.platform)) document.documentElement.classList.add("mac");

// No StrictMode: its double mount would open and close the native player twice.
createRoot(document.getElementById("root")!).render(<App />);
