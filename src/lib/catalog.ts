import type { Category, Feature, Site } from "./types";

type Seed = {
  id: string;
  name: string;
  url: string;
  category: Category;
  features: Feature[];
  summary: string;
  rating: number;
  isFavorite?: boolean;
  accent: string;
  secondary: string;
};

/** Default catalog, carried over from SiteStore.swift (sourced from FMHY). */
const SEEDS: Seed[] = [
  // Aggregators
  { id: "movy", name: "Movy", url: "https://www.movy.sx/", category: "aggregators", features: ["ultraHD", "autoNext", "cleanUI", "fastServer"], summary: "Premium quality streaming for Movies, TV & Anime with 4K support and auto-next episode playback.", rating: 4.9, isFavorite: true, accent: "#6366F1", secondary: "#A855F7" },
  { id: "cinejoy", name: "Cinejoy", url: "https://cinejoy.pk/", category: "aggregators", features: ["autoNext", "fastServer", "cleanUI"], summary: "Lightning-fast custom video player with automatic next episode and zero intrusive delays.", rating: 4.8, isFavorite: true, accent: "#EC4899", secondary: "#F43F5E" },
  { id: "rive", name: "Rive", url: "https://www.rivestream.app/", category: "aggregators", features: ["ultraHD", "autoNext", "cleanUI", "fastServer"], summary: "Modern Apple TV-like design with 4K stream sources, instant playback and responsive UI.", rating: 4.9, isFavorite: true, accent: "#3B82F6", secondary: "#2DD4BF" },
  { id: "flystream", name: "FlyStream", url: "https://flystream.net/", category: "aggregators", features: ["ultraHD", "autoNext", "fastServer"], summary: "Curated 4K feeds and fast streaming CDN nodes with minimal buffering.", rating: 4.8, accent: "#0EA5E9", secondary: "#6366F1" },
  { id: "popcornmovies", name: "PopcornMovies", url: "https://popcornmovies.ac/", category: "aggregators", features: ["autoNext", "cleanUI"], summary: "Vast archive of recent blockbuster movies and complete series with automated episode queues.", rating: 4.7, accent: "#F59E0B", secondary: "#EF4444" },
  { id: "vivarium", name: "Vivarium", url: "https://vivarium.su/", category: "aggregators", features: ["autoNext", "fastServer"], summary: "High performance aggregator offering smooth multi-language subtitles and crisp audio.", rating: 4.7, accent: "#10B981", secondary: "#059669" },
  { id: "flixer", name: "Flixer", url: "https://flixer.gd", category: "aggregators", features: ["autoNext", "cleanUI"], summary: "Clean streaming interface with instant search and responsive episode navigation.", rating: 4.7, accent: "#8B5CF6", secondary: "#EC4899" },
  { id: "cinelite", name: "CineLite", url: "https://cinelite.xyz/", category: "aggregators", features: ["ultraHD", "autoNext", "fastServer"], summary: "Lightweight, ultra-fast 4K player optimized for quick loading and smooth scrubbing.", rating: 4.8, accent: "#14B8A6", secondary: "#3B82F6" },
  { id: "way2movies", name: "Way2Movies", url: "https://way2movies.live/", category: "aggregators", features: ["ultraHD", "autoNext"], summary: "Extensive library featuring 4K transfers, popular trending releases, and auto-next.", rating: 4.6, accent: "#F97316", secondary: "#E11D48" },
  { id: "movienight", name: "Movie Night", url: "https://movienig.ht/", category: "aggregators", features: ["autoNext", "cleanUI"], summary: "Cozy community streaming experience with synchronized playback and watchlist features.", rating: 4.7, accent: "#8B5CF6", secondary: "#3B82F6" },

  // Dedicated
  { id: "cno", name: "Cno", url: "https://cno.to/", category: "dedicated", features: ["ultraHD", "autoNext", "fastServer"], summary: "High bitrate dedicated player with direct streams in 4K resolution without server jumping.", rating: 4.9, isFavorite: true, accent: "#EF4444", secondary: "#F97316" },
  { id: "nepu", name: "NEPU", url: "https://nepu.io/", category: "dedicated", features: ["ultraHD", "autoNext", "fastServer"], summary: "Dedicated server powerhouse with instant video start times and full season auto-play.", rating: 4.8, isFavorite: true, accent: "#06B6D4", secondary: "#3B82F6" },
  { id: "lookmovie", name: "LookMovie", url: "https://lookmovie2.to/", category: "dedicated", features: ["autoNext", "cleanUI"], summary: "Reliable, longstanding catalog with well-organized categories and multiple audio tracks.", rating: 4.7, accent: "#3B82F6", secondary: "#6366F1" },
  { id: "soapgo", name: "SoapGo", url: "https://soapgo.to/", category: "dedicated", features: ["fastServer", "cleanUI"], summary: "Fast dedicated streaming server for movies, trending sitcoms, and popular anime.", rating: 4.6, accent: "#10B981", secondary: "#06B6D4" },
  { id: "pressplay", name: "PressPlay", url: "https://pressplayx.to/", category: "dedicated", features: ["fastServer", "cleanUI"], summary: "Simple, uncluttered dedicated server experience focused purely on fast stream startup.", rating: 4.6, accent: "#A855F7", secondary: "#EC4899" },

  // Multi-server
  { id: "hydrahd", name: "HydraHD", url: "https://hydrahd.ws/", category: "multiServer", features: ["multiHost", "autoNext", "ultraHD"], summary: "Multi-server hub with automatic source fallback so you never hit a broken stream.", rating: 4.8, accent: "#3B82F6", secondary: "#8B5CF6" },
  { id: "vidbox", name: "Vidbox", url: "https://vidbox.vc/", category: "multiServer", features: ["multiHost", "autoNext"], summary: "Flexible multi-host selector with redundant mirrors for every show and film.", rating: 4.7, accent: "#EC4899", secondary: "#8B5CF6" },
  { id: "candlestream", name: "CandleStream", url: "https://candlestream.xyz/#home", category: "multiServer", features: ["multiHost", "autoNext", "cleanUI"], summary: "Minimalist multi-server frontend that lets you switch between 5+ source mirrors seamlessly.", rating: 4.7, accent: "#F59E0B", secondary: "#D97706" },
  { id: "1shows", name: "1Shows", url: "http://1shows.bz", category: "multiServer", features: ["multiHost", "autoNext"], summary: "Massive directory of TV seasons and cinema releases across multiple resilient hosts.", rating: 4.6, accent: "#06B6D4", secondary: "#10B981" },

  // Anime & special
  { id: "aether", name: "Aether", url: "https://aether.st/", category: "animeAndSpecial", features: ["ultraHD", "autoNext", "cleanUI", "fastServer"], summary: "High quality P-Stream fork with gorgeous fluid UI, 4K streams, and anime libraries.", rating: 4.9, isFavorite: true, accent: "#8B5CF6", secondary: "#3B82F6" },
  { id: "cinecat", name: "Cinecat", url: "https://cinecat.eu/", category: "animeAndSpecial", features: ["ultraHD", "autoNext", "cleanUI"], summary: "Modern open-source streaming web client with 4K capability, subs, and anime integration.", rating: 4.8, accent: "#F43F5E", secondary: "#FB7185" },
  { id: "anicine", name: "AniCine", url: "https://anicine.sbs/", category: "animeAndSpecial", features: ["multiHost", "autoNext", "fastServer"], summary: "Dedicated hub for both mainstream movies, western TV series, and complete anime seasons.", rating: 4.7, accent: "#EC4899", secondary: "#F97316" },
];

export function defaultCatalog(): Site[] {
  return SEEDS.map((s) => ({
    ...s,
    isFavorite: s.isFavorite ?? false,
    isCustom: false,
    visitCount: 0,
    lastVisited: null,
  }));
}

/** Accent pairs handed out to custom links, so they get a lit tile too. */
const CUSTOM_PALETTE: [string, string][] = [
  ["#6366F1", "#22D3EE"],
  ["#F43F5E", "#F59E0B"],
  ["#10B981", "#3B82F6"],
  ["#A855F7", "#EC4899"],
  ["#F97316", "#EAB308"],
  ["#0EA5E9", "#14B8A6"],
];

export function accentFor(name: string): [string, string] {
  return CUSTOM_PALETTE[hash(name) % CUSTOM_PALETTE.length];
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
