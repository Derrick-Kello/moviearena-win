import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isNative } from "./native";

export const RELEASES_URL = "https://github.com/Derrick-Kello/moviearena-win/releases/latest";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "available"; version: string }
  | { kind: "installing"; version: string; progress: number | null }
  | { kind: "failed"; version: string; message: string };

const FIRST_CHECK_MS = 4_000;
const RECHECK_MS = 6 * 60 * 60 * 1000;

/** Checks GitHub releases for a signed update and installs it on request. */
export function useUpdates() {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const pending = useRef<Update | null>(null);

  useEffect(() => {
    if (!isNative) return;
    const run = () =>
      check()
        .then((u) => {
          if (!u) return;
          pending.current = u;
          setState((s) => (s.kind === "installing" ? s : { kind: "available", version: u.version }));
        })
        // Offline or GitHub unreachable: stay quiet and try again later.
        .catch(() => {});
    const first = window.setTimeout(run, FIRST_CHECK_MS);
    const again = window.setInterval(run, RECHECK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(again);
    };
  }, []);

  const install = useCallback(async () => {
    const u = pending.current;
    if (!u) return;
    let total = 0;
    let got = 0;
    setState({ kind: "installing", version: u.version, progress: null });
    try {
      await u.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        if (e.event === "Progress") {
          got += e.data.chunkLength;
          setState({ kind: "installing", version: u.version, progress: total ? got / total : null });
        }
      });
      await relaunch();
    } catch (e) {
      // Linux .deb and .rpm installs can't self-update; the release page can.
      setState({ kind: "failed", version: u.version, message: String(e) });
    }
  }, []);

  const dismiss = useCallback(() => setState({ kind: "idle" }), []);

  return { state, install, dismiss };
}
