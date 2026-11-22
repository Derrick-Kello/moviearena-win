import { forwardRef } from "react";
import { ArrowDownToLine, Plus, Search, ShieldCheck, X } from "lucide-react";
import type { UpdateState } from "../lib/updates";
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
  downloading: number;
  update: UpdateState;
  onUpdate: () => void;
  onUpdateFailed: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

export const TopBar = forwardRef<HTMLInputElement, Props>(function TopBar(
  { tab, query, blocked, bump, onTab, onQuery, onShield, onAdd, downloading, update, onUpdate, onUpdateFailed },
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
            {t === "downloads" && downloading > 0 && (
              <span className="tab-badge" aria-label={`${downloading} saving`}>
                {downloading}
              </span>
            )}
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

        {update.kind === "available" && (
          <button className="pill-btn update" onClick={onUpdate} title={`Install Movie Arena ${update.version} and restart`}>
            <ArrowDownToLine size={14} aria-hidden /> Update to {update.version}
          </button>
        )}
        {update.kind === "installing" && (
          <span className="pill-btn update" role="status">
            <span className="spinner" aria-hidden />
            {update.progress === null ? "Updating" : `Updating ${Math.round(update.progress * 100)}%`}
          </span>
        )}
        {update.kind === "failed" && (
          <button className="pill-btn" onClick={onUpdateFailed} title={update.message}>
            Get {update.version} from the website
          </button>
        )}
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
