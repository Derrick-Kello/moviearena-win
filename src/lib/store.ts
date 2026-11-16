import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accentFor, defaultCatalog } from "./catalog";
import { loadSites, saveSites, shield as shieldApi, on } from "./native";
import type { Category, Feature, ShieldSettings, ShieldStats, Site } from "./types";

export interface SiteDraft {
  name: string;
  url: string;
  category: Category;
  features: Feature[];
  summary: string;
}

/** Add https:// when missing and check the result parses as a web address. */
export function normalizeUrl(input: string): { url: string } | { error: string } {
  let url = input.trim();
  if (!url) return { error: "Enter the site's address." };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")
      return { error: "That address has no domain. Try something like example.com." };
    return { url: parsed.toString() };
  } catch {
    return { error: "That doesn't look like a web address. Try something like example.com." };
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function migrate(saved: Site[]): Site[] {
  return saved.map((s) => ({
    ...s,
    features: s.features ?? [],
    visitCount: s.visitCount ?? 0,
    lastVisited: s.lastVisited ?? null,
  }));
}

export function useSites() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const loaded = useRef(false);
  // Latest list for actions that must return what they changed.
  const latest = useRef<Site[] | null>(null);
  latest.current = sites;

  useEffect(() => {
    loadSites()
      .then((saved) => setSites(saved && saved.length ? migrate(saved) : defaultCatalog()))
      .catch(() => setSites(defaultCatalog()))
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  // Persist after load, debounced so typing and bulk edits write once.
  useEffect(() => {
    if (!loaded.current || !sites) return;
    const t = window.setTimeout(() => {
      saveSites(sites).catch((e) => console.error("Could not save sites", e));
    }, 250);
    return () => window.clearTimeout(t);
  }, [sites]);

  const update = useCallback((id: string, fn: (s: Site) => Site) => {
    setSites((prev) => prev && prev.map((s) => (s.id === id ? fn(s) : s)));
  }, []);

  const actions = useMemo(
    () => ({
      toggleFavorite: (id: string) => update(id, (s) => ({ ...s, isFavorite: !s.isFavorite })),
      recordVisit: (id: string) =>
        update(id, (s) => ({ ...s, visitCount: s.visitCount + 1, lastVisited: Date.now() })),
      add: (draft: SiteDraft): Site => {
        const [accent, secondary] = accentFor(draft.name);
        const site: Site = {
          id: crypto.randomUUID(),
          name: draft.name.trim(),
          url: draft.url,
          category: draft.category,
          features: draft.features,
          summary: draft.summary.trim() || "Your own streaming link.",
          rating: 5,
          isFavorite: true,
          isCustom: true,
          accent,
          secondary,
          visitCount: 0,
          lastVisited: null,
        };
        setSites((prev) => (prev ? [site, ...prev] : [site]));
        return site;
      },
      edit: (id: string, draft: SiteDraft) =>
        update(id, (s) => ({
          ...s,
          name: draft.name.trim(),
          url: draft.url,
          category: draft.category,
          features: draft.features,
          summary: draft.summary.trim() || s.summary,
        })),
      remove: (id: string): { site: Site; index: number } | null => {
        const list = latest.current ?? [];
        const index = list.findIndex((s) => s.id === id);
        if (index < 0) return null;
        const removed = { site: list[index], index };
        setSites((prev) => prev && prev.filter((s) => s.id !== id));
        return removed;
      },
      restore: (site: Site, index: number) =>
        setSites((prev) => {
          if (!prev) return [site];
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, site);
          return next;
        }),
      resetToDefaults: () => {
        // Keep the user's own links; restore the curated catalog around them.
        setSites((prev) => [...(prev ?? []).filter((s) => s.isCustom), ...defaultCatalog()]);
      },
    }),
    [update],
  );

  return { sites, ...actions };
}

export type SitesApi = ReturnType<typeof useSites>;

export function useShield() {
  const [settings, setSettings] = useState<ShieldSettings>({ autoSkip: true, popupShield: true, contentRules: true });
  const [stats, setStats] = useState<ShieldStats>({ popups: 0, skipped: 0, overlays: 0, requests: 0 });

  useEffect(() => {
    shieldApi.state().then((s) => {
      setSettings(s.settings);
      setStats(s.stats);
    });
    return on<ShieldStats>("shield:stats", setStats);
  }, []);

  const change = useCallback((patch: Partial<ShieldSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      shieldApi.update(next).catch((e) => console.error("Could not update shield", e));
      return next;
    });
  }, []);

  const resetStats = useCallback(() => {
    setStats({ popups: 0, skipped: 0, overlays: 0, requests: 0 });
    shieldApi.resetStats();
  }, []);

  return { settings, stats, change, resetStats };
}
