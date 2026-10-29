import { useCallback, useEffect, useState } from "react";
// Installable app support: the service worker is registered on production builds
// only, so development servers and component tests never cache anything.
export function registerServiceWorker(
  nav: Navigator = navigator,
  production: boolean = import.meta.env.PROD,
): boolean {
  if (!production || !("serviceWorker" in nav)) return false;
  void nav.serviceWorker.register("/sw.js").catch(() => {});
  return true;
}
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
// Chromium raises `beforeinstallprompt` when the manifest qualifies; Safari and
// Firefox install from their own menus, so the button only shows where it works.
export function useInstallPrompt(): {
  canInstall: boolean;
  install: () => void;
} {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const install = useCallback(() => {
    if (!prompt) return;
    void prompt
      .prompt()
      .then(() => prompt.userChoice)
      .then(() => setPrompt(null));
  }, [prompt]);
  return { canInstall: prompt !== null, install };
}
