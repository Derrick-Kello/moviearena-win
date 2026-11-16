import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Menu, MenuItem, PredefinedMenuItem, CheckMenuItem } from "@tauri-apps/api/menu";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import type { ShieldSettings, ShieldStats, Site } from "./types";

/** True inside the Tauri shell; false when the UI is opened in a plain browser. */
export const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LOCAL_SITES_KEY = "movie-arena.sites.v1";
const LOCAL_SHIELD_KEY = "movie-arena.shield.v1";

export async function loadSites(): Promise<Site[] | null> {
  if (!isNative) {
    const raw = localStorage.getItem(LOCAL_SITES_KEY);
    return raw ? (JSON.parse(raw) as Site[]) : null;
  }
  return invoke<Site[] | null>("sites_load");
}

export async function saveSites(sites: Site[]): Promise<void> {
  if (!isNative) {
    localStorage.setItem(LOCAL_SITES_KEY, JSON.stringify(sites));
    return;
  }
  await invoke("sites_save", { sites });
}

export const player = {
  open: (url: string, bounds: Bounds) => (isNative ? invoke("player_open", { url, bounds }) : Promise.resolve()),
  bounds: (bounds: Bounds) => (isNative ? invoke("player_bounds", { bounds }) : Promise.resolve()),
  visible: (visible: boolean) => (isNative ? invoke("player_visible", { visible }) : Promise.resolve()),
  command: (action: "back" | "forward" | "reload" | "stop" | "skip" | "focus") =>
    isNative ? invoke("player_command", { action }) : Promise.resolve(),
  navigate: (url: string) => (isNative ? invoke("player_navigate", { url }) : Promise.resolve()),
  close: () => (isNative ? invoke("player_close") : Promise.resolve()),
  fullscreen: (active: boolean) => (isNative ? invoke("window_fullscreen", { active }) : Promise.resolve()),
};

const DEFAULT_SHIELD: { settings: ShieldSettings; stats: ShieldStats } = {
  settings: { autoSkip: true, popupShield: true, contentRules: true },
  stats: { popups: 0, skipped: 0, overlays: 0, requests: 0 },
};

export const shield = {
  state: async (): Promise<{ settings: ShieldSettings; stats: ShieldStats }> => {
    if (isNative) return invoke("shield_state");
    const raw = localStorage.getItem(LOCAL_SHIELD_KEY);
    return raw ? { ...DEFAULT_SHIELD, settings: JSON.parse(raw) } : DEFAULT_SHIELD;
  },
  update: async (settings: ShieldSettings) => {
    if (isNative) return invoke("shield_update", { settings });
    localStorage.setItem(LOCAL_SHIELD_KEY, JSON.stringify(settings));
  },
  resetStats: () => (isNative ? invoke("shield_reset_stats") : Promise.resolve()),
};

export function on<T>(event: string, handler: (payload: T) => void): () => void {
  if (!isNative) return () => {};
  let unlisten: UnlistenFn | null = null;
  let disposed = false;
  listen<T>(event, (e) => handler(e.payload)).then((fn) => {
    if (disposed) fn();
    else unlisten = fn;
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export async function openExternal(url: string) {
  if (isNative) await openUrl(url);
  else window.open(url, "_blank", "noopener");
}

// ---------------------------------------------------------------------------
// Native menus. They render above the player webview, which HTML cannot do.
// ---------------------------------------------------------------------------

export type MenuEntry =
  | { kind: "item"; text: string; action: () => void; enabled?: boolean; accelerator?: string }
  | { kind: "check"; text: string; checked: boolean; action: () => void }
  | { kind: "separator" };

/** Show a native popup menu, or report false so the caller can fall back. */
export async function popupMenu(entries: MenuEntry[], at?: { x: number; y: number }): Promise<boolean> {
  if (!isNative) return false;
  const items = await Promise.all(
    entries.map((e) => {
      if (e.kind === "separator") return PredefinedMenuItem.new({ item: "Separator" });
      if (e.kind === "check")
        return CheckMenuItem.new({ text: e.text, checked: e.checked, action: () => e.action() });
      return MenuItem.new({
        text: e.text,
        enabled: e.enabled ?? true,
        accelerator: e.accelerator,
        action: () => e.action(),
      });
    }),
  );
  const menu = await Menu.new({ items });
  await menu.popup(at ? new LogicalPosition(at.x, at.y) : undefined);
  return true;
}
