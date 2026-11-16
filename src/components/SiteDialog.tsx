import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog } from "./Dialog";
import { Wordmark } from "./Wordmark";
import { litVars } from "./ChannelCard";
import { accentFor } from "../lib/catalog";
import { FEATURE_ICONS } from "../lib/icons";
import { hostOf, normalizeUrl, type SiteDraft } from "../lib/store";
import { ALL_CATEGORIES, ALL_FEATURES, CATEGORY_TITLES, FEATURE_LABELS, TAB_LABELS, type Site } from "../lib/types";

interface Props {
  site?: Site;
  initialUrl?: string;
  onSave: (draft: SiteDraft) => void;
  onDelete?: (site: Site) => void;
  onClose: () => void;
}

export function SiteDialog({ site, initialUrl, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(site?.name ?? "");
  const [url, setUrl] = useState(site?.url ?? initialUrl ?? "");
  const [category, setCategory] = useState(site?.category ?? "aggregators");
  const [features, setFeatures] = useState(site?.features ?? (["ultraHD", "autoNext"] as const).slice());
  const [summary, setSummary] = useState(site?.summary ?? "");
  const [touched, setTouched] = useState(false);

  const normalized = useMemo(() => (url.trim() ? normalizeUrl(url) : null), [url]);
  const urlError = normalized && "error" in normalized ? normalized.error : null;
  const canSave = name.trim().length > 0 && normalized !== null && !urlError;
  const [a, b] = site ? [site.accent, site.secondary] : accentFor(name || "new");

  const submit = () => {
    setTouched(true);
    if (!canSave || !normalized || "error" in normalized) return;
    onSave({ name, url: normalized.url, category, features, summary });
  };

  const toggle = (f: (typeof ALL_FEATURES)[number]) =>
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <Dialog
      title={site ? "Edit link" : "Add a streaming link"}
      description={site ? undefined : "It shows up under My Links and opens with Ad-Shield on."}
      onClose={onClose}
      width={560}
      footer={
        <>
          {site && onDelete && (
            <button className="ghost-btn danger" onClick={() => onDelete(site)} style={{ marginRight: "auto" }}>
              <Trash2 size={14} aria-hidden /> Delete
            </button>
          )}
          {!site && <span className="note">Enter saves</span>}
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={submit} disabled={touched && !canSave}>
            {site ? "Save changes" : "Add link"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: "grid", gap: 20 }}
      >
        <div className="preview" aria-hidden>
          <div className="tile" style={litVars({ accent: a, secondary: b })}>
            <div className="lit" />
            <div className="wordmark-wrap">
              <Wordmark name={name || "Your site"} />
            </div>
          </div>
          <div className="preview-meta">
            <strong>{name.trim() || "Your site"}</strong>
            <span>{normalized && "url" in normalized ? hostOf(normalized.url) : "example.com"}</span>
            <span>{CATEGORY_TITLES[category]}</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="site-name">Name</label>
          <input
            id="site-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Movy, Cinejoy, MyStream"
            aria-invalid={touched && !name.trim()}
            data-autofocus
            maxLength={40}
          />
          {touched && !name.trim() && <span className="hint error">Give the link a name.</span>}
        </div>

        <div className="field">
          <label htmlFor="site-url">Address</label>
          <input
            id="site-url"
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com"
            aria-invalid={Boolean((touched || url) && urlError)}
            spellCheck={false}
            inputMode="url"
          />
          {urlError && (touched || url.length > 3) ? (
            <span className="hint error">{urlError}</span>
          ) : touched && !url.trim() ? (
            <span className="hint error">Enter the site's address.</span>
          ) : normalized && "url" in normalized ? (
            <span className="hint">Opens {normalized.url}</span>
          ) : null}
        </div>

        <div className="field">
          <span className="label" id="cat-label">
            Category
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="cat-label">
            {ALL_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
              >
                {TAB_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label" id="feat-label">
            What it does well
          </span>
          <div className="chips" role="group" aria-labelledby="feat-label">
            {ALL_FEATURES.map((f) => {
              const Icon = FEATURE_ICONS[f];
              return (
                <button type="button" key={f} className="filter" aria-pressed={features.includes(f)} onClick={() => toggle(f)}>
                  <Icon size={13} aria-hidden /> {FEATURE_LABELS[f]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label htmlFor="site-notes">Notes</label>
          <input
            id="site-notes"
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Optional. Which server works best, subtitle tips, anything."
            maxLength={140}
          />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
