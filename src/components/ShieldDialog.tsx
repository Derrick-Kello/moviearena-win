import { useEffect, useState } from "react";
import { EyeOff, FastForward, Hand, Ban, ShieldCheck } from "lucide-react";
import { Dialog, Switch } from "./Dialog";
import { isNative } from "../lib/native";
import type { ShieldSettings, ShieldStats } from "../lib/types";

interface Props {
  settings: ShieldSettings;
  stats: ShieldStats;
  onChange: (patch: Partial<ShieldSettings>) => void;
  onResetStats: () => void;
  onRestoreDefaults: () => void;
  onClose: () => void;
}

const isWindows = typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);

export function ShieldDialog({ settings, stats, onChange, onResetStats, onRestoreDefaults, onClose }: Props) {
  const [armed, setArmed] = useState(false);
  const [restored, setRestored] = useState(false);

  // The destructive action needs a second press within a few seconds.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const rows: { key: keyof ShieldSettings; title: string; desc: string }[] = [
    {
      key: "autoSkip",
      title: "Fast-skip video ads",
      desc: "Presses the player's skip-ad button and runs short ad clips at 16x.",
    },
    {
      key: "popupShield",
      title: "Popup and redirect shield",
      desc: "Stops popunders, new-window ads, fake alerts, redirects to ad sites, and click traps over the video.",
    },
    {
      key: "contentRules",
      title: "Block ad servers",
      desc: isWindows || !isNative
        ? "Blocks requests to known ad and tracker networks, and hides common ad boxes."
        : "Hides common ad boxes. Network blocking runs on Windows only.",
    },
  ];

  const tally = [
    { label: "Ads skipped", value: stats.skipped, Icon: FastForward },
    { label: "Popups", value: stats.popups, Icon: Hand },
    { label: "Overlays", value: stats.overlays, Icon: EyeOff },
    { label: "Requests", value: stats.requests, Icon: Ban },
  ];

  return (
    <Dialog
      title="Ad-Shield"
      description="Runs inside every page and frame the player loads."
      badge={
        <span className="badge" aria-hidden>
          <ShieldCheck size={20} />
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="note">Changes reload the open site.</span>
          <button className="primary-btn" onClick={onClose} data-autofocus>
            Done
          </button>
        </>
      }
    >
      <div>
        <h3 className="group-label">Blocked this session</h3>
        <dl className="panel tally">
          {tally.map(({ label, value, Icon }) => (
            <div key={label}>
              <dt>
                <Icon size={12} aria-hidden /> {label}
              </dt>
              <dd>{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h3 className="group-label">Protection</h3>
        <div className="panel">
          {rows.map((r) => (
            <div className="setting" key={r.key}>
              <div className="setting-text">
                <div className="setting-title">{r.title}</div>
                <div className="setting-desc">{r.desc}</div>
              </div>
              <Switch checked={settings[r.key]} onChange={(v) => onChange({ [r.key]: v })} label={r.title} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="group-label">Maintenance</h3>
        <div className="maint">
          <button className="ghost-btn" onClick={onResetStats}>
            Reset counters
          </button>
          <button
            className={`ghost-btn danger${armed ? " armed" : ""}`}
            onClick={() => {
              if (!armed) return setArmed(true);
              onRestoreDefaults();
              setArmed(false);
              setRestored(true);
            }}
          >
            {armed ? "Press again to restore" : restored ? "Default catalog restored" : "Restore default catalog"}
          </button>
        </div>
        <p className="setting-desc" style={{ marginTop: 8 }}>
          Restoring brings back the original 22 sites and clears their favorites and history. Your own links stay.
        </p>
      </div>
    </Dialog>
  );
}
