import { useEffect, useState } from "react";
import { store } from "../data";
import { DEFAULT_SETTINGS, type OrgSettings } from "../types";

const EVT = "tms:settings-changed";

/** Org settings (goal, baseline, commission, threshold), refreshing on local changes. */
export function useSettings() {
  const [settings, setSettings] = useState<OrgSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    const load = () => void store.getSettings().then((s) => alive && setSettings(s));
    load();
    window.addEventListener(EVT, load);
    window.addEventListener("storage", load); // cross-tab in demo mode
    return () => {
      alive = false;
      window.removeEventListener(EVT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  return settings;
}

/** Save settings and notify any mounted useSettings() consumers in this tab. */
export async function saveSettings(patch: Partial<OrgSettings>) {
  await store.saveSettings(patch);
  window.dispatchEvent(new Event(EVT));
}
