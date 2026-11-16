import {
  FastForward,
  Layers,
  MonitorPlay,
  Network,
  Server,
  Sparkle,
  Sparkles,
  Star,
  Zap,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { Feature, Tab } from "./types";

export const FEATURE_ICONS: Record<Feature, LucideIcon> = {
  ultraHD: MonitorPlay,
  autoNext: FastForward,
  multiHost: Network,
  fastServer: Zap,
  cleanUI: Sparkle,
};

export const TAB_ICONS: Record<Tab, LucideIcon> = {
  all: Tv,
  aggregators: Layers,
  multiServer: Server,
  dedicated: Zap,
  animeAndSpecial: Sparkles,
  custom: Star,
};
