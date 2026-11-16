import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChannelCard, type CardHandlers } from "./ChannelCard";
import type { Site } from "../lib/types";

interface Props extends CardHandlers {
  title: string;
  sites: Site[];
  onSeeAll?: () => void;
}

/**
 * Horizontal channel row. Mouse users on Windows rarely have horizontal
 * scrolling, so the row has paddles, and Shift + wheel works natively.
 */
export function Row({ title, sites, onSeeAll, ...handlers }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, sites.length]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth - 120), behavior: "smooth" });
  };

  if (!sites.length) return null;

  const id = `row-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="row" aria-labelledby={id}>
      <div className="row-head">
        <h2 className="row-title" id={id}>
          {title}
        </h2>
        <span className="row-count">{sites.length}</span>
        {onSeeAll && (
          <button className="row-link" onClick={onSeeAll}>
            See all <ChevronRight size={14} />
          </button>
        )}
      </div>
      <button className="paddle left" onClick={() => page(-1)} disabled={edges.start} aria-label={`Scroll ${title} left`}>
        <span>
          <ChevronLeft size={18} />
        </span>
      </button>
      <div className="row-track" ref={track} onScroll={measure}>
        {sites.map((s) => (
          <ChannelCard key={s.id} site={s} {...handlers} />
        ))}
      </div>
      <button className="paddle right" onClick={() => page(1)} disabled={edges.end} aria-label={`Scroll ${title} right`}>
        <span>
          <ChevronRight size={18} />
        </span>
      </button>
    </section>
  );
}
