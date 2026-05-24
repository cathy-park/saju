import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Default OFF: service worker caching can easily pin an old UI/login flow in production.
// Enable explicitly by setting VITE_ENABLE_SW="true" at build time.
const ENABLE_SW = import.meta.env.VITE_ENABLE_SW === "true";

if (ENABLE_SW && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL ?? "/";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    navigator.serviceWorker
      .register(`${normalizedBase}service-worker.js`, { updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
