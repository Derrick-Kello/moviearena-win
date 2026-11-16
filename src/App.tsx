import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { TopBar } from "./components/TopBar";
import { Billboard } from "./components/Billboard";
import { Row } from "./components/Row";
import { ChannelCard, type CardHandlers } from "./components/ChannelCard";
import { Player } from "./components/Player";
import { ShieldDialog } from "./components/ShieldDialog";
import { SiteDialog } from "./components/SiteDialog";
import { openExternal, popupMenu } from "./lib/native";
import { FEATURE_ICONS } from "./lib/icons";
import { hostOf, normalizeUrl, useShield, useSites, type SiteDraft } from "./lib/store";
import {
  ALL_CATEGORIES,
  ALL_FEATURES,
  CATEGORY_BLURBS,
  CATEGORY_TITLES,
  FEATURE_LABELS,
  totalBlocked,
  type Category,
  type Feature,
  type Site,
  type Tab,
} from "./lib/types";

type DialogState = { kind: "shield" } | { kind: "add"; url?: string } | { kind: "edit"; site: Site } | null;
type Toast = { text: string; action?: { label: string; run: () => void } } | null;

export default function App() {
  const store = useSites();
  const shield = useShield();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [feature, setFeature] = useState<Feature | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const sites = store.sites ?? [];
  const active = activeId ? sites.find((s) => s.id === activeId) ?? null : null;

  // Pulse the shield counter whenever it goes up.
  const blocked = totalBlocked(shield.stats);
  const [bump, setBump] = useState(0);
  const lastBlocked = useRef(blocked);
  useEffect(() => {
    if (blocked > lastBlocked.current) setBump((b) => b + 1);
    lastBlocked.current = blocked;
  }, [blocked]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const launch = useCallback(
    (site: Site) => {
      store.recordVisit(site.id);
      setActiveId(site.id);
    },
    [store],
  );

  const removeWithUndo = useCallback(
    (site: Site) => {
      const removed = store.remove(site.id);
      setDialog(null);
      setToast({
        text: `Deleted ${site.name}`,
        action: removed ? { label: "Undo", run: () => store.restore(removed.site, removed.index) } : undefined,
      });
    },
    [store],
  );

  const handlers: CardHandlers = useMemo(
    () => ({
      onOpen: launch,
      onToggleFavorite: (s) => store.toggleFavorite(s.id),
      onEdit: (s) => setDialog({ kind: "edit", site: s }),
      onMenu: (s, at) => {
        popupMenu(
          [
            { kind: "item", text: "Stream now", action: () => launch(s) },
            { kind: "item", text: "Open in browser", action: () => openExternal(s.url) },
            { kind: "separator" },
            {
              kind: "item",
              text: s.isFavorite ? "Remove from favorites" : "Add to favorites",
              action: () => store.toggleFavorite(s.id),
            },
            ...(s.isCustom
              ? ([
                  { kind: "separator" },
                  { kind: "item", text: "Edit link…", action: () => setDialog({ kind: "edit", site: s }) },
                  { kind: "item", text: "Delete link", action: () => removeWithUndo(s) },
                ] as const)
              : []),
          ],
          at,
        );
      },
    }),
    [launch, store, removeWithUndo],
  );

  // Global shortcuts for the browse view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (active || dialog) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "f")) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setDialog({ kind: "add" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dialog]);

  const goTab = (t: Tab) => {
    setTab(t);
    setQuery("");
    scroller.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const byFeature = useCallback((list: Site[]) => (feature ? list.filter((s) => s.features.includes(feature)) : list), [feature]);

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? sites.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.summary.toLowerCase().includes(q) ||
              s.url.toLowerCase().includes(q) ||
              CATEGORY_TITLES[s.category].toLowerCase().includes(q),
          )
        : [],
    [sites, q],
  );

  const saveDraft = (draft: SiteDraft) => {
    if (dialog?.kind === "edit") {
      store.edit(dialog.site.id, draft);
      setToast({ text: `Saved ${draft.name.trim()}` });
    } else {
      store.add(draft);
      setToast({ text: `Added ${draft.name.trim()} to My Links` });
      if (tab !== "custom" && !q) goTab("custom");
    }
    setDialog(null);
  };

  if (!store.sites) return <div className="app" aria-busy="true" />;

  const filterBar = (
    <div className="filters" role="toolbar" aria-label="Filter by feature">
      <button className="filter" aria-pressed={feature === null} onClick={() => setFeature(null)}>
        All features
      </button>
      {ALL_FEATURES.map((f) => {
        const Icon = FEATURE_ICONS[f];
        return (
          <button key={f} className="filter" aria-pressed={feature === f} onClick={() => setFeature(feature === f ? null : f)}>
            <Icon size={13} aria-hidden /> {FEATURE_LABELS[f]}
          </button>
        );
      })}
    </div>
  );

  const grid = (list: Site[]) => (
    <div className="grid">
      {list.map((s) => (
        <ChannelCard key={s.id} site={s} {...handlers} />
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (q) {
    const asUrl = /\.[a-z]{2,}/i.test(q) && !q.includes(" ") ? normalizeUrl(query) : null;
    body = (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">Results for "{query.trim()}"</h1>
          </div>
          <span className="page-count">
            {results.length} {results.length === 1 ? "site" : "sites"}
          </span>
        </div>
        {results.length ? (
          grid(results)
        ) : (
          <div className="empty">
            <Search size={28} strokeWidth={1.5} color="var(--fg-3)" aria-hidden />
            <h2>No site matches "{query.trim()}"</h2>
            <p>Search looks at names, descriptions, addresses and categories.</p>
            <div className="actions">
              {asUrl && "url" in asUrl && (
                <button className="primary-btn" onClick={() => setDialog({ kind: "add", url: asUrl.url })}>
                  <Plus size={15} aria-hidden /> Add {hostOf(asUrl.url)} as a link
                </button>
              )}
              <button className="ghost-btn" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          </div>
        )}
      </>
    );
  } else if (tab === "all") {
    const recent = sites
      .filter((s) => s.lastVisited)
      .sort((a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0));
    const favorites = sites.filter((s) => s.isFavorite);
    const custom = sites.filter((s) => s.isCustom);
    const rows: { title: string; list: Site[]; tab?: Tab }[] = [
      { title: "Continue watching", list: recent },
      { title: "Favorites", list: favorites },
      ...ALL_CATEGORIES.map((c) => ({ title: CATEGORY_TITLES[c], list: sites.filter((s) => s.category === c && !s.isCustom), tab: c as Tab })),
      { title: "My Links", list: custom, tab: "custom" as Tab },
    ];
    const visible = rows.map((r) => ({ ...r, list: byFeature(r.list) })).filter((r) => r.list.length);
    body = (
      <>
        <Billboard
          sites={sites.filter((s) => s.rating >= 4.8)}
          shieldOn={shield.settings.popupShield || shield.settings.contentRules}
          paused={Boolean(active) || dialog !== null}
          onOpen={launch}
          onToggleFavorite={(s) => store.toggleFavorite(s.id)}
        />
        {filterBar}
        {visible.map((r) => (
          <Row key={r.title} title={r.title} sites={r.list} onSeeAll={r.tab ? () => goTab(r.tab!) : undefined} {...handlers} />
        ))}
        {!visible.length && (
          <div className="empty">
            <h2>No site has {FEATURE_LABELS[feature!]}</h2>
            <p>Pick another feature or show everything.</p>
            <div className="actions">
              <button className="ghost-btn" onClick={() => setFeature(null)}>
                Show all sites
              </button>
            </div>
          </div>
        )}
      </>
    );
  } else if (tab === "custom") {
    const custom = byFeature(sites.filter((s) => s.isCustom));
    const any = sites.some((s) => s.isCustom);
    body = (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">My Links</h1>
            <p className="page-sub">
              Your own streaming sites and mirrors.{any ? " Right-click a tile for more options." : ""}
            </p>
          </div>
          {any && (
            <button className="primary-btn" onClick={() => setDialog({ kind: "add" })}>
              <Plus size={15} aria-hidden /> Add link
            </button>
          )}
        </div>
        {any && filterBar}
        {any ? (
          custom.length ? (
            grid(custom)
          ) : (
            <div className="empty">
              <h2>None of your links has {FEATURE_LABELS[feature!]}</h2>
              <div className="actions">
                <button className="ghost-btn" onClick={() => setFeature(null)}>
                  Show all links
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="empty">
            <div className="empty-tile-wrap">
              <button className="ghost-tile" onClick={() => setDialog({ kind: "add" })} style={{ width: "100%" }}>
                <span className="plus" aria-hidden>
                  <Plus size={20} />
                </span>
                Add your first link
              </button>
            </div>
            <h2>No links of your own yet</h2>
            <p>Add any streaming site, from FMHY or anywhere else. It opens in the theater with Ad-Shield on.</p>
          </div>
        )}
      </>
    );
  } else {
    const cat = tab as Category;
    const list = byFeature(sites.filter((s) => s.category === cat));
    body = (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">{CATEGORY_TITLES[cat]}</h1>
            <p className="page-sub">{CATEGORY_BLURBS[cat]}</p>
          </div>
          <span className="page-count">
            {list.length} {list.length === 1 ? "site" : "sites"}
          </span>
        </div>
        {filterBar}
        {list.length ? (
          grid(list)
        ) : (
          <div className="empty">
            <h2>No {CATEGORY_TITLES[cat].toLowerCase()} with {FEATURE_LABELS[feature!]}</h2>
            <div className="actions">
              <button className="ghost-btn" onClick={() => setFeature(null)}>
                Show all
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app">
      <TopBar
        ref={searchRef}
        tab={tab}
        query={query}
        blocked={blocked}
        bump={bump}
        onTab={goTab}
        onQuery={(v) => {
          setQuery(v);
          scroller.current?.scrollTo({ top: 0 });
        }}
        onShield={() => setDialog({ kind: "shield" })}
        onAdd={() => setDialog({ kind: "add" })}
      />
      <main className="scroller" ref={scroller} aria-hidden={Boolean(active)} inert={active ? true : undefined}>
        {body}
      </main>

      {active && (
        <Player
          site={active}
          sites={sites}
          blocked={blocked}
          bump={bump}
          covered={dialog !== null}
          onClose={() => setActiveId(null)}
          onSwitch={launch}
          onToggleFavorite={(s) => store.toggleFavorite(s.id)}
          onShield={() => setDialog({ kind: "shield" })}
        />
      )}

      {dialog?.kind === "shield" && (
        <ShieldDialog
          settings={shield.settings}
          stats={shield.stats}
          onChange={shield.change}
          onResetStats={shield.resetStats}
          onRestoreDefaults={store.resetToDefaults}
          onClose={() => setDialog(null)}
        />
      )}
      {(dialog?.kind === "add" || dialog?.kind === "edit") && (
        <SiteDialog
          key={dialog.kind === "edit" ? dialog.site.id : "new"}
          site={dialog.kind === "edit" ? dialog.site : undefined}
          initialUrl={dialog.kind === "add" ? dialog.url : undefined}
          onSave={saveDraft}
          onDelete={removeWithUndo}
          onClose={() => setDialog(null)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.action && (
            <button
              className="ghost-btn"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
