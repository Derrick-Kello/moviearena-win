import { useCallback, useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isNative, on } from "./native";

export interface LibraryItem {
  name: string;
  path: string;
  size: number;
  modified: number;
  /** A single file, or an offline HLS stream stored as a folder. */
  kind: "file" | "hls";
}

export interface Download {
  url: string;
  name: string;
  path: string;
  kind: "file" | "hls";
  written: number;
  state: "saving" | "done" | "failed";
  /** Why a download stopped, when the backend knows. */
  error?: string;
}

/** A media URL the player found in the page. */
export interface MediaItem {
  url: string;
  kind: "file" | "hls" | "dash";
  name: string;
  referer: string;
  cookie: string;
}

export interface MediaPayload {
  page: string;
  title: string;
  items: MediaItem[];
}

export const media = {
  download: (item: MediaItem) =>
    invoke("media_download", {
      url: item.url,
      name: item.name,
      referer: item.referer,
      cookie: item.cookie,
    }),
};

export const library = {
  list: async (): Promise<{ dir: string; items: LibraryItem[] }> =>
    isNative ? invoke("library_list") : { dir: "", items: [] },
  remove: (path: string) => invoke("library_delete", { path }),
  reveal: (path: string) => invoke("library_open", { path, how: "reveal" }),
  playExternally: (path: string) => invoke("library_open", { path, how: "play" }),
  openFolder: () => invoke("library_open", { how: "folder" }),
  src: (path: string) => convertFileSrc(path),
};

/** "The.Matrix.1999.1080p.mkv" -> "The Matrix 1999 1080p" */
export function titleOf(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
}

export function formatBytes(n: number) {
  if (n < 1024 ** 2) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

const POSITION_KEY = "movie-arena.positions.v1";

export interface Position {
  /** Seconds watched. */
  t: number;
  /** Duration in seconds. */
  d: number;
}

const readPositions = (): Record<string, Position> => {
  try {
    return JSON.parse(localStorage.getItem(POSITION_KEY) ?? "{}");
  } catch {
    return {};
  }
};

/** Where the viewer stopped in each file, so playback resumes there. */
export const positions = {
  get: (path: string): Position | null => readPositions()[path] ?? null,
  set(path: string, pos: Position | null) {
    const all = readPositions();
    if (pos && pos.t > 0) all[path] = { t: Math.round(pos.t), d: Math.round(pos.d) };
    else delete all[path];
    localStorage.setItem(POSITION_KEY, JSON.stringify(all));
  },
};

/** Library contents plus downloads the player has started this session. */
export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [downloads, setDownloads] = useState<Download[]>([]);

  const refresh = useCallback(() => {
    library
      .list()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    const offs = [
      on<{ url: string; name: string; path: string; kind: "file" | "hls" }>("download:started", (d) =>
        setDownloads((prev) => [{ ...d, written: 0, state: "saving" }, ...prev.filter((x) => x.path !== d.path)]),
      ),
      on<{ url: string; message: string }>("download:error", (d) =>
        setDownloads((prev) => prev.map((x) => (x.url === d.url ? { ...x, error: d.message } : x))),
      ),
      on<{ url: string; path: string | null; success: boolean }>("download:finished", (d) => {
        setDownloads((prev) =>
          prev.map((x) =>
            x.url === d.url && x.state === "saving" ? { ...x, state: d.success ? "done" : "failed" } : x,
          ),
        );
        refresh();
      }),
    ];
    return () => {
      window.removeEventListener("focus", refresh);
      offs.forEach((off) => off());
    };
  }, [refresh]);

  // Poll bytes written while anything is saving; webviews report no progress.
  const saving = downloads.filter((d) => d.state === "saving");
  useEffect(() => {
    if (!saving.length) return;
    const t = window.setInterval(async () => {
      const sizes = await Promise.all(
        saving.map((d) => invoke<number>("library_written", { path: d.path }).catch(() => d.written)),
      );
      setDownloads((prev) =>
        prev.map((x) => {
          const i = saving.findIndex((d) => d.path === x.path);
          return i >= 0 && x.state === "saving" ? { ...x, written: sizes[i] } : x;
        }),
      );
    }, 1000);
    return () => window.clearInterval(t);
  }, [saving.map((d) => d.path).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback(
    async (path: string) => {
      await library.remove(path);
      positions.set(path, null);
      refresh();
    },
    [refresh],
  );

  const dismiss = useCallback((path: string) => setDownloads((prev) => prev.filter((d) => d.path !== path)), []);

  return { items, downloads, refresh, remove, dismiss };
}
