export type Category =
  | "aggregators"
  | "multiServer"
  | "dedicated"
  | "animeAndSpecial";

/** Tabs in the top bar. "all" is home, "custom" is the user's own links. */
export type Tab = "all" | Category | "custom" | "downloads";

export type Feature = "ultraHD" | "autoNext" | "multiHost" | "fastServer" | "cleanUI";

export interface Site {
  id: string;
  name: string;
  url: string;
  category: Category;
  features: Feature[];
  summary: string;
  rating: number;
  isFavorite: boolean;
  isCustom: boolean;
  accent: string;
  secondary: string;
  visitCount: number;
  lastVisited: number | null;
}

export const TAB_LABELS: Record<Tab, string> = {
  all: "Home",
  aggregators: "Aggregators",
  multiServer: "Multi-Server",
  dedicated: "Dedicated",
  animeAndSpecial: "Anime & More",
  custom: "My Links",
  downloads: "Downloads",
};

export const CATEGORY_TITLES: Record<Category, string> = {
  aggregators: "Stream Aggregators",
  multiServer: "Multi-Server Providers",
  dedicated: "Dedicated Servers",
  animeAndSpecial: "Anime & Open-Source Forks",
};

export const CATEGORY_BLURBS: Record<Category, string> = {
  aggregators: "One search, many sources. Big libraries with auto-next.",
  multiServer: "Switch mirrors when a stream breaks. Every title has backups.",
  dedicated: "Direct streams from a single server. Fast start, no hopping.",
  animeAndSpecial: "Anime libraries and open-source clients with clean players.",
};

export const FEATURE_LABELS: Record<Feature, string> = {
  ultraHD: "4K UHD",
  autoNext: "Auto-Next",
  multiHost: "Multi-Host",
  fastServer: "High Speed",
  cleanUI: "Clean Player",
};

export const ALL_FEATURES: Feature[] = ["ultraHD", "autoNext", "multiHost", "fastServer", "cleanUI"];
export const ALL_CATEGORIES: Category[] = ["aggregators", "multiServer", "dedicated", "animeAndSpecial"];
export const TABS: Tab[] = ["all", "aggregators", "multiServer", "dedicated", "animeAndSpecial", "custom", "downloads"];

export interface ShieldSettings {
  autoSkip: boolean;
  popupShield: boolean;
  contentRules: boolean;
}

export interface ShieldStats {
  popups: number;
  skipped: number;
  overlays: number;
  requests: number;
}

export const totalBlocked = (s: ShieldStats) => s.popups + s.skipped + s.overlays + s.requests;
