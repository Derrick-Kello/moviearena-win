import { forwardRef } from "react";
import { Plus, Search, ShieldCheck, X } from "lucide-react";
import appIcon from "../assets/app-icon.png";
import { TABS, TAB_LABELS, type Tab } from "../lib/types";

interface Props {
  tab: Tab;
  query: string;
  blocked: number;
  bump: number;
  onTab: (tab: Tab) => void;
  onQuery: (q: string) => void;
  onShield: () => void;
  onAdd: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

export const TopBar = forwardRef<HTMLInputElement, Props>(function TopBar(
  { tab, query, blocked, bump, onTab, onQuery, onShield, onAdd },
  searchRef,
) {
  const searching = query.trim().length > 0;
  return (
    <header className="topbar" data-tauri-drag-region>
      <button className="brand" onClick={() => onTab("all")} aria-label="Movie Arena, go home">
        <img src={appIcon} alt="" />
        <span className="brand-name">Movie Arena</span>
      </button>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            className="tab"
            aria-selected={!searching && tab === t}
            onClick={() => onTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      <div className="bar-actions">
        <label className="search">
          <Search size={14} className="lead" aria-hidden />
          <span className="sr-only">Search sites</span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search sites"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onQuery("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
          />
          {query ? (
            <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => onQuery("")} aria-label="Clear search">
              <X size={13} />
            </button>
          ) : (
            <span className="kbd" aria-hidden>
              {isMac ? "⌘K" : "Ctrl K"}
            </span>
          )}
        </label>

        <button className="pill-btn" onClick={onShield} title="Ad-Shield settings and activity">
          <ShieldCheck size={15} className="shield-icon" aria-hidden />
          <span className="bar-label">Ad-Shield</span>
          <span className={`count${bump ? " bump" : ""}`} key={bump} aria-label={`${blocked} blocked this session`}>
            {blocked}
          </span>
        </button>

        <button className="primary-btn compact" onClick={onAdd} title="Add a streaming link (Ctrl N)">
          <Plus size={15} strokeWidth={2.4} aria-hidden />
          <span className="bar-label">Add link</span>
        </button>
      </div>
    </header>
  );
});
