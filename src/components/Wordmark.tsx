import type { CSSProperties } from "react";
import { hash } from "../lib/catalog";

/**
 * Each channel gets its own lettering: Mona Sans with a width, weight and case
 * picked from a hash of the name. The same name always renders the same way,
 * so a site keeps a recognisable mark everywhere it appears.
 */
const STRETCHES = [78, 88, 100, 112, 122];
const WEIGHTS = [620, 700, 780, 860];
type Case = "as-is" | "upper" | "lower";
const CASES: Case[] = ["as-is", "as-is", "upper", "lower"];

export function wordmarkStyle(name: string) {
  const h = hash(name.trim().toLowerCase() || "?");
  const stretch = STRETCHES[h % STRETCHES.length];
  const weight = WEIGHTS[(h >>> 4) % WEIGHTS.length];
  const letterCase = CASES[(h >>> 8) % CASES.length];
  const tracking = letterCase === "upper" ? 0.02 : stretch < 90 ? -0.01 : -0.03;
  return { stretch, weight, letterCase, tracking };
}

function text(name: string, letterCase: Case) {
  if (letterCase === "upper") return name.toUpperCase();
  if (letterCase === "lower") return name.toLowerCase();
  return name;
}

interface Props {
  name: string;
  /** Fraction of the container's inline size the mark should span. */
  fill?: number;
  /** Cap in container-query units, so short names do not get huge. */
  max?: number;
  className?: string;
  style?: CSSProperties;
  as?: "span" | "h1" | "h2";
  /** Fixed size instead of container-relative sizing. */
  fixedSize?: string;
}

export function Wordmark({ name, fill = 0.72, max = 20, className, style, as = "span", fixedSize }: Props) {
  const label = name.trim() || "Untitled";
  const w = wordmarkStyle(label);
  const shown = text(label, w.letterCase);
  // Rough advance width per character in em, scaled by width axis and case.
  const perChar = (w.letterCase === "upper" ? 0.66 : 0.56) * (w.stretch / 100) * (w.weight > 760 ? 1.05 : 1);
  const ems = Math.max(shown.length * perChar + w.tracking * shown.length, 1.4);
  const size = Math.min((fill * 100) / ems, max);
  const Tag = as;
  return (
    <Tag
      className={`wordmark ${className ?? ""}`}
      style={{
        fontStretch: `${w.stretch}%`,
        fontWeight: w.weight,
        letterSpacing: `${w.tracking}em`,
        // "inherit" leaves sizing to the stylesheet.
        fontSize: fixedSize === "inherit" ? undefined : (fixedSize ?? `${size.toFixed(2)}cqi`),
        ...style,
      }}
    >
      {shown}
    </Tag>
  );
}
