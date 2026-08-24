import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { clearLegacyApiKeySessionStorage } from "./features/gateway/legacy-session.js";
import "./styles.css";

clearLegacyApiKeySessionStorage();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
