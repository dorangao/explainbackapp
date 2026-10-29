import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startVercelAnalytics } from "./lib/analytics";
import { registerServiceWorker } from "./lib/install";
// oxlint-disable-next-line import/no-unassigned-import -- global stylesheets
import "../public/style.css";
// oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
startVercelAnalytics();
registerServiceWorker();
