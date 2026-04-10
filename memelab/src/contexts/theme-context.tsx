"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

// ── Full theme palette ───────────────────────────────────────────────

export type PaletteCategory = "core" | "modern" | "flatui-vibrant" | "flatui-earth" | "flatui-neon" | "flatui-pastel";

export const PALETTE_CATEGORIES: { id: PaletteCategory; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "modern", label: "Modern" },
  { id: "flatui-vibrant", label: "FlatUI Vibrant" },
  { id: "flatui-earth", label: "FlatUI Earth" },
  { id: "flatui-neon", label: "FlatUI Neon" },
  { id: "flatui-pastel", label: "FlatUI Pastel" },
];

export interface ThemePalette {
  id: string;
  label: string;
  category: PaletteCategory;
  // Core
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  // Complementary
  complement: string;
  complementForeground: string;
  // Semantic
  success: string;
  warning: string;
  destructive: string;
  info: string;
  // Surfaces (dark mode tinted)
  surfaceTint: string;
  // Ring / focus
  ring: string;
  // Gradient
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
}

export const PALETTES: ThemePalette[] = [
  {
    id: "violet", label: "Violeta", category: "core",
    primary: "#8B5CF6", primaryForeground: "#ffffff",
    secondary: "#6D28D9", secondaryForeground: "#ffffff",
    accent: "#A78BFA", accentForeground: "#ffffff",
    complement: "#F59E0B", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#F43F5E", info: "#38BDF8",
    surfaceTint: "139, 92, 246",
    ring: "#8B5CF6",
    gradientFrom: "#8B5CF6", gradientVia: "#A78BFA", gradientTo: "#C4B5FD",
  },
  {
    id: "ocean", label: "Oceano", category: "core",
    primary: "#3B82F6", primaryForeground: "#ffffff",
    secondary: "#1D4ED8", secondaryForeground: "#ffffff",
    accent: "#60A5FA", accentForeground: "#ffffff",
    complement: "#F97316", complementForeground: "#ffffff",
    success: "#10B981", warning: "#EAB308", destructive: "#EF4444", info: "#06B6D4",
    surfaceTint: "59, 130, 246",
    ring: "#3B82F6",
    gradientFrom: "#1D4ED8", gradientVia: "#3B82F6", gradientTo: "#93C5FD",
  },
  {
    id: "emerald", label: "Esmeralda", category: "core",
    primary: "#10B981", primaryForeground: "#ffffff",
    secondary: "#059669", secondaryForeground: "#ffffff",
    accent: "#34D399", accentForeground: "#000000",
    complement: "#EC4899", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#F59E0B", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "16, 185, 129",
    ring: "#10B981",
    gradientFrom: "#059669", gradientVia: "#10B981", gradientTo: "#6EE7B7",
  },
  {
    id: "rose", label: "Rosa", category: "core",
    primary: "#F43F5E", primaryForeground: "#ffffff",
    secondary: "#E11D48", secondaryForeground: "#ffffff",
    accent: "#FB7185", accentForeground: "#ffffff",
    complement: "#14B8A6", complementForeground: "#ffffff",
    success: "#10B981", warning: "#F59E0B", destructive: "#DC2626", info: "#38BDF8",
    surfaceTint: "244, 63, 94",
    ring: "#F43F5E",
    gradientFrom: "#E11D48", gradientVia: "#F43F5E", gradientTo: "#FDA4AF",
  },
  {
    id: "amber", label: "Ambar", category: "core",
    primary: "#F59E0B", primaryForeground: "#000000",
    secondary: "#D97706", secondaryForeground: "#000000",
    accent: "#FBBF24", accentForeground: "#000000",
    complement: "#6366F1", complementForeground: "#ffffff",
    success: "#10B981", warning: "#EAB308", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "245, 158, 11",
    ring: "#F59E0B",
    gradientFrom: "#D97706", gradientVia: "#F59E0B", gradientTo: "#FDE68A",
  },
  {
    id: "crimson", label: "Carmesim", category: "core",
    primary: "#DC2626", primaryForeground: "#ffffff",
    secondary: "#991B1B", secondaryForeground: "#ffffff",
    accent: "#F87171", accentForeground: "#ffffff",
    complement: "#22D3EE", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#B91C1C", info: "#38BDF8",
    surfaceTint: "220, 38, 38",
    ring: "#DC2626",
    gradientFrom: "#991B1B", gradientVia: "#DC2626", gradientTo: "#FCA5A5",
  },
  {
    id: "teal", label: "Turquesa", category: "core",
    primary: "#14B8A6", primaryForeground: "#ffffff",
    secondary: "#0D9488", secondaryForeground: "#ffffff",
    accent: "#2DD4BF", accentForeground: "#000000",
    complement: "#F43F5E", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#EAB308", destructive: "#EF4444", info: "#06B6D4",
    surfaceTint: "20, 184, 166",
    ring: "#14B8A6",
    gradientFrom: "#0D9488", gradientVia: "#14B8A6", gradientTo: "#99F6E4",
  },
  {
    id: "indigo", label: "Indigo", category: "core",
    primary: "#6366F1", primaryForeground: "#ffffff",
    secondary: "#4338CA", secondaryForeground: "#ffffff",
    accent: "#818CF8", accentForeground: "#ffffff",
    complement: "#EAB308", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "99, 102, 241",
    ring: "#6366F1",
    gradientFrom: "#4338CA", gradientVia: "#6366F1", gradientTo: "#C7D2FE",
  },
  {
    id: "fuchsia", label: "Fucsia", category: "core",
    primary: "#D946EF", primaryForeground: "#ffffff",
    secondary: "#A21CAF", secondaryForeground: "#ffffff",
    accent: "#E879F9", accentForeground: "#ffffff",
    complement: "#84CC16", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "217, 70, 239",
    ring: "#D946EF",
    gradientFrom: "#A21CAF", gradientVia: "#D946EF", gradientTo: "#F0ABFC",
  },
  {
    id: "cyan", label: "Ciano", category: "core",
    primary: "#06B6D4", primaryForeground: "#ffffff",
    secondary: "#0891B2", secondaryForeground: "#ffffff",
    accent: "#22D3EE", accentForeground: "#000000",
    complement: "#F97316", complementForeground: "#ffffff",
    success: "#10B981", warning: "#EAB308", destructive: "#EF4444", info: "#0EA5E9",
    surfaceTint: "6, 182, 212",
    ring: "#06B6D4",
    gradientFrom: "#0891B2", gradientVia: "#06B6D4", gradientTo: "#A5F3FC",
  },
  {
    id: "lime", label: "Lima", category: "core",
    primary: "#84CC16", primaryForeground: "#000000",
    secondary: "#65A30D", secondaryForeground: "#ffffff",
    accent: "#A3E635", accentForeground: "#000000",
    complement: "#A855F7", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#EAB308", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "132, 204, 22",
    ring: "#84CC16",
    gradientFrom: "#65A30D", gradientVia: "#84CC16", gradientTo: "#D9F99D",
  },
  {
    id: "slate", label: "Cinza", category: "core",
    primary: "#64748B", primaryForeground: "#ffffff",
    secondary: "#475569", secondaryForeground: "#ffffff",
    accent: "#94A3B8", accentForeground: "#000000",
    complement: "#F59E0B", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "100, 116, 139",
    ring: "#64748B",
    gradientFrom: "#475569", gradientVia: "#64748B", gradientTo: "#CBD5E1",
  },
  {
    id: "sunset", label: "Por do Sol", category: "core",
    primary: "#F97316", primaryForeground: "#ffffff",
    secondary: "#EA580C", secondaryForeground: "#ffffff",
    accent: "#FB923C", accentForeground: "#000000",
    complement: "#3B82F6", complementForeground: "#ffffff",
    success: "#10B981", warning: "#EAB308", destructive: "#DC2626", info: "#38BDF8",
    surfaceTint: "249, 115, 22",
    ring: "#F97316",
    gradientFrom: "#EA580C", gradientVia: "#F97316", gradientTo: "#FDBA74",
  },
  {
    id: "sakura", label: "Sakura", category: "core",
    primary: "#EC4899", primaryForeground: "#ffffff",
    secondary: "#DB2777", secondaryForeground: "#ffffff",
    accent: "#F472B6", accentForeground: "#ffffff",
    complement: "#34D399", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#E11D48", info: "#38BDF8",
    surfaceTint: "236, 72, 153",
    ring: "#EC4899",
    gradientFrom: "#DB2777", gradientVia: "#EC4899", gradientTo: "#FBCFE8",
  },
  {
    id: "coffee", label: "Cafe", category: "core",
    primary: "#92400E", primaryForeground: "#ffffff",
    secondary: "#78350F", secondaryForeground: "#ffffff",
    accent: "#B45309", accentForeground: "#ffffff",
    complement: "#0EA5E9", complementForeground: "#ffffff",
    success: "#16A34A", warning: "#CA8A04", destructive: "#DC2626", info: "#0284C7",
    surfaceTint: "146, 64, 14",
    ring: "#92400E",
    gradientFrom: "#78350F", gradientVia: "#92400E", gradientTo: "#D97706",
  },
  {
    id: "midnight", label: "Meia-Noite", category: "core",
    primary: "#1E40AF", primaryForeground: "#ffffff",
    secondary: "#1E3A8A", secondaryForeground: "#ffffff",
    accent: "#3B82F6", accentForeground: "#ffffff",
    complement: "#FBBF24", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#EF4444", info: "#60A5FA",
    surfaceTint: "30, 64, 175",
    ring: "#1E40AF",
    gradientFrom: "#1E3A8A", gradientVia: "#1E40AF", gradientTo: "#60A5FD",
  },

  // ── PAGE 1: FlatUI Vibrant (cross-palette bold mixes) ─────────────
  {
    id: "fv-peter-alizarin", label: "Rio Carmim", category: "flatui-vibrant",
    primary: "#3498db", primaryForeground: "#ffffff",
    secondary: "#2980b9", secondaryForeground: "#ffffff",
    accent: "#e74c3c", accentForeground: "#ffffff",
    complement: "#f1c40f", complementForeground: "#000000",
    success: "#2ecc71", warning: "#f39c12", destructive: "#c0392b", info: "#3498db",
    surfaceTint: "52, 152, 219", ring: "#3498db",
    gradientFrom: "#2980b9", gradientVia: "#3498db", gradientTo: "#e74c3c",
  },
  {
    id: "fv-amethyst-emerald", label: "Ametista Selva", category: "flatui-vibrant",
    primary: "#9b59b6", primaryForeground: "#ffffff",
    secondary: "#8e44ad", secondaryForeground: "#ffffff",
    accent: "#2ecc71", accentForeground: "#ffffff",
    complement: "#f1c40f", complementForeground: "#000000",
    success: "#27ae60", warning: "#f39c12", destructive: "#e74c3c", info: "#3498db",
    surfaceTint: "155, 89, 182", ring: "#9b59b6",
    gradientFrom: "#8e44ad", gradientVia: "#9b59b6", gradientTo: "#2ecc71",
  },
  {
    id: "fv-exodus-megaman", label: "Cosmic Wave", category: "flatui-vibrant",
    primary: "#6c5ce7", primaryForeground: "#ffffff",
    secondary: "#5f27cd", secondaryForeground: "#ffffff",
    accent: "#48dbfb", accentForeground: "#000000",
    complement: "#ff6b6b", complementForeground: "#ffffff",
    success: "#1dd1a1", warning: "#feca57", destructive: "#ee5253", info: "#48dbfb",
    surfaceTint: "108, 92, 231", ring: "#6c5ce7",
    gradientFrom: "#5f27cd", gradientVia: "#6c5ce7", gradientTo: "#48dbfb",
  },
  {
    id: "fv-chi-gong-mint", label: "Dragao Verde", category: "flatui-vibrant",
    primary: "#d63031", primaryForeground: "#ffffff",
    secondary: "#e17055", secondaryForeground: "#ffffff",
    accent: "#00b894", accentForeground: "#ffffff",
    complement: "#fdcb6e", complementForeground: "#000000",
    success: "#00b894", warning: "#fdcb6e", destructive: "#d63031", info: "#74b9ff",
    surfaceTint: "214, 48, 49", ring: "#d63031",
    gradientFrom: "#d63031", gradientVia: "#e17055", gradientTo: "#00b894",
  },
  {
    id: "fv-prunus-electron", label: "Nebula Rosa", category: "flatui-vibrant",
    primary: "#e84393", primaryForeground: "#ffffff",
    secondary: "#fd79a8", secondaryForeground: "#ffffff",
    accent: "#0984e3", accentForeground: "#ffffff",
    complement: "#55efc4", complementForeground: "#000000",
    success: "#00cec9", warning: "#ffeaa7", destructive: "#ff7675", info: "#74b9ff",
    surfaceTint: "232, 67, 147", ring: "#e84393",
    gradientFrom: "#e84393", gradientVia: "#fd79a8", gradientTo: "#0984e3",
  },
  {
    id: "fv-sunflower-berry", label: "Girassol Berry", category: "flatui-vibrant",
    primary: "#FFC312", primaryForeground: "#000000",
    secondary: "#F79F1F", secondaryForeground: "#000000",
    accent: "#B53471", accentForeground: "#ffffff",
    complement: "#12CBC4", complementForeground: "#ffffff",
    success: "#009432", warning: "#FFC312", destructive: "#EA2027", info: "#0652DD",
    surfaceTint: "255, 195, 18", ring: "#FFC312",
    gradientFrom: "#F79F1F", gradientVia: "#FFC312", gradientTo: "#B53471",
  },
  {
    id: "fv-pylon-download", label: "British Tech", category: "flatui-vibrant",
    primary: "#00a8ff", primaryForeground: "#ffffff",
    secondary: "#0097e6", secondaryForeground: "#ffffff",
    accent: "#4cd137", accentForeground: "#ffffff",
    complement: "#fbc531", complementForeground: "#000000",
    success: "#44bd32", warning: "#fbc531", destructive: "#e84118", info: "#00a8ff",
    surfaceTint: "0, 168, 255", ring: "#00a8ff",
    gradientFrom: "#0097e6", gradientVia: "#00a8ff", gradientTo: "#4cd137",
  },
  {
    id: "fv-fusionred-reptile", label: "Berlim Pop", category: "flatui-vibrant",
    primary: "#fc5c65", primaryForeground: "#ffffff",
    secondary: "#eb3b5a", secondaryForeground: "#ffffff",
    accent: "#26de81", accentForeground: "#000000",
    complement: "#45aaf2", complementForeground: "#ffffff",
    success: "#20bf6b", warning: "#f7b731", destructive: "#eb3b5a", info: "#45aaf2",
    surfaceTint: "252, 92, 101", ring: "#fc5c65",
    gradientFrom: "#eb3b5a", gradientVia: "#fc5c65", gradientTo: "#26de81",
  },
  {
    id: "fv-coral-ufo", label: "Xangai Neon", category: "flatui-vibrant",
    primary: "#ff7f50", primaryForeground: "#ffffff",
    secondary: "#ff6348", secondaryForeground: "#ffffff",
    accent: "#2ed573", accentForeground: "#000000",
    complement: "#5352ed", complementForeground: "#ffffff",
    success: "#2ed573", warning: "#ffa502", destructive: "#ff4757", info: "#1e90ff",
    surfaceTint: "255, 127, 80", ring: "#ff7f50",
    gradientFrom: "#ff6348", gradientVia: "#ff7f50", gradientTo: "#2ed573",
  },
  {
    id: "fv-bara-merchant", label: "Holanda Royal", category: "flatui-vibrant",
    primary: "#ED4C67", primaryForeground: "#ffffff",
    secondary: "#B53471", secondaryForeground: "#ffffff",
    accent: "#0652DD", accentForeground: "#ffffff",
    complement: "#C4E538", complementForeground: "#000000",
    success: "#009432", warning: "#F79F1F", destructive: "#EA2027", info: "#0652DD",
    surfaceTint: "237, 76, 103", ring: "#ED4C67",
    gradientFrom: "#B53471", gradientVia: "#ED4C67", gradientTo: "#0652DD",
  },
  {
    id: "fv-spiro-wild", label: "Canada Electric", category: "flatui-vibrant",
    primary: "#0abde3", primaryForeground: "#ffffff",
    secondary: "#01a3a4", secondaryForeground: "#ffffff",
    accent: "#ff9ff3", accentForeground: "#000000",
    complement: "#ff9f43", complementForeground: "#000000",
    success: "#1dd1a1", warning: "#feca57", destructive: "#ee5253", info: "#54a0ff",
    surfaceTint: "10, 189, 227", ring: "#0abde3",
    gradientFrom: "#01a3a4", gradientVia: "#0abde3", gradientTo: "#ff9ff3",
  },
  {
    id: "fv-freespeech-sizzling", label: "Stockholm Fire", category: "flatui-vibrant",
    primary: "#3c40c6", primaryForeground: "#ffffff",
    secondary: "#575fcf", secondaryForeground: "#ffffff",
    accent: "#f53b57", accentForeground: "#ffffff",
    complement: "#0be881", complementForeground: "#000000",
    success: "#05c46b", warning: "#ffc048", destructive: "#ff3f34", info: "#0fbcf9",
    surfaceTint: "60, 64, 198", ring: "#3c40c6",
    gradientFrom: "#3c40c6", gradientVia: "#575fcf", gradientTo: "#f53b57",
  },

  // ── PAGE 2: FlatUI Earth (warm, grounded cross-mixes) ─────────────
  {
    id: "fe-squash-forest", label: "Provence", category: "flatui-earth",
    primary: "#f6b93b", primaryForeground: "#000000",
    secondary: "#e58e26", secondaryForeground: "#000000",
    accent: "#38ada9", accentForeground: "#ffffff",
    complement: "#6a89cc", complementForeground: "#ffffff",
    success: "#78e08f", warning: "#f6b93b", destructive: "#eb2f06", info: "#82ccdd",
    surfaceTint: "246, 185, 59", ring: "#f6b93b",
    gradientFrom: "#e58e26", gradientVia: "#f6b93b", gradientTo: "#38ada9",
  },
  {
    id: "fe-biscay-rosy", label: "Moscow Dusk", category: "flatui-earth",
    primary: "#303952", primaryForeground: "#ffffff",
    secondary: "#596275", secondaryForeground: "#ffffff",
    accent: "#f7d794", accentForeground: "#000000",
    complement: "#cf6a87", complementForeground: "#ffffff",
    success: "#63cdda", warning: "#f5cd79", destructive: "#e15f41", info: "#778beb",
    surfaceTint: "48, 57, 82", ring: "#303952",
    gradientFrom: "#303952", gradientVia: "#596275", gradientTo: "#f7d794",
  },
  {
    id: "fe-wetasphalt-sun", label: "London Fog", category: "flatui-earth",
    primary: "#34495e", primaryForeground: "#ffffff",
    secondary: "#2c3e50", secondaryForeground: "#ffffff",
    accent: "#f1c40f", accentForeground: "#000000",
    complement: "#1abc9c", complementForeground: "#ffffff",
    success: "#2ecc71", warning: "#f39c12", destructive: "#e74c3c", info: "#3498db",
    surfaceTint: "52, 73, 94", ring: "#34495e",
    gradientFrom: "#2c3e50", gradientVia: "#34495e", gradientTo: "#f1c40f",
  },
  {
    id: "fe-jacksons-celestial", label: "Madrid Night", category: "flatui-earth",
    primary: "#40407a", primaryForeground: "#ffffff",
    secondary: "#2c2c54", secondaryForeground: "#ffffff",
    accent: "#33d9b2", accentForeground: "#000000",
    complement: "#ff5252", complementForeground: "#ffffff",
    success: "#33d9b2", warning: "#ffb142", destructive: "#ff5252", info: "#34ace0",
    surfaceTint: "64, 64, 122", ring: "#40407a",
    gradientFrom: "#2c2c54", gradientVia: "#40407a", gradientTo: "#33d9b2",
  },
  {
    id: "fe-deepcove-helio", label: "Sydney Purple", category: "flatui-earth",
    primary: "#30336b", primaryForeground: "#ffffff",
    secondary: "#130f40", secondaryForeground: "#ffffff",
    accent: "#e056fd", accentForeground: "#ffffff",
    complement: "#f9ca24", complementForeground: "#000000",
    success: "#6ab04c", warning: "#f9ca24", destructive: "#eb4d4b", info: "#7ed6df",
    surfaceTint: "48, 51, 107", ring: "#30336b",
    gradientFrom: "#130f40", gradientVia: "#30336b", gradientTo: "#e056fd",
  },
  {
    id: "fe-naval-rise", label: "Britannia Gold", category: "flatui-earth",
    primary: "#40739e", primaryForeground: "#ffffff",
    secondary: "#487eb0", secondaryForeground: "#ffffff",
    accent: "#fbc531", accentForeground: "#000000",
    complement: "#e84118", complementForeground: "#ffffff",
    success: "#44bd32", warning: "#fbc531", destructive: "#c23616", info: "#0097e6",
    surfaceTint: "64, 115, 158", ring: "#40739e",
    gradientFrom: "#40739e", gradientVia: "#487eb0", gradientTo: "#fbc531",
  },
  {
    id: "fe-imperial-joust", label: "Toronto Blue", category: "flatui-earth",
    primary: "#222f3e", primaryForeground: "#ffffff",
    secondary: "#576574", secondaryForeground: "#ffffff",
    accent: "#54a0ff", accentForeground: "#ffffff",
    complement: "#feca57", complementForeground: "#000000",
    success: "#10ac84", warning: "#ff9f43", destructive: "#ee5253", info: "#54a0ff",
    surfaceTint: "34, 47, 62", ring: "#222f3e",
    gradientFrom: "#222f3e", gradientVia: "#576574", gradientTo: "#54a0ff",
  },
  {
    id: "fe-sapphire-iceland", label: "Marselha Outono", category: "flatui-earth",
    primary: "#0c2461", primaryForeground: "#ffffff",
    secondary: "#1e3799", secondaryForeground: "#ffffff",
    accent: "#fa983a", accentForeground: "#000000",
    complement: "#78e08f", complementForeground: "#000000",
    success: "#78e08f", warning: "#f6b93b", destructive: "#b71540", info: "#6a89cc",
    surfaceTint: "12, 36, 97", ring: "#0c2461",
    gradientFrom: "#0c2461", gradientVia: "#1e3799", gradientTo: "#fa983a",
  },
  {
    id: "fe-ships-orchid", label: "Mumbai Spice", category: "flatui-earth",
    primary: "#2C3A47", primaryForeground: "#ffffff",
    secondary: "#182C61", secondaryForeground: "#ffffff",
    accent: "#FEA47F", accentForeground: "#000000",
    complement: "#25CCF7", complementForeground: "#ffffff",
    success: "#55E6C1", warning: "#EAB543", destructive: "#F97F51", info: "#1B9CFC",
    surfaceTint: "44, 58, 71", ring: "#2C3A47",
    gradientFrom: "#2C3A47", gradientVia: "#182C61", gradientTo: "#FEA47F",
  },
  {
    id: "fe-magenta-honey", label: "Rajasthan Glow", category: "flatui-earth",
    primary: "#6D214F", primaryForeground: "#ffffff",
    secondary: "#B33771", secondaryForeground: "#ffffff",
    accent: "#EAB543", accentForeground: "#000000",
    complement: "#55E6C1", complementForeground: "#000000",
    success: "#58B19F", warning: "#EAB543", destructive: "#FC427B", info: "#25CCF7",
    surfaceTint: "109, 33, 79", ring: "#6D214F",
    gradientFrom: "#6D214F", gradientVia: "#B33771", gradientTo: "#EAB543",
  },
  {
    id: "fe-prestige-golden", label: "Beijing Ouro", category: "flatui-earth",
    primary: "#2f3542", primaryForeground: "#ffffff",
    secondary: "#57606f", secondaryForeground: "#ffffff",
    accent: "#eccc68", accentForeground: "#000000",
    complement: "#ff6b81", complementForeground: "#ffffff",
    success: "#7bed9f", warning: "#ffa502", destructive: "#ff4757", info: "#70a1ff",
    surfaceTint: "47, 53, 66", ring: "#2f3542",
    gradientFrom: "#2f3542", gradientVia: "#57606f", gradientTo: "#eccc68",
  },
  {
    id: "fe-turkish-pico", label: "Ancara Deep", category: "flatui-earth",
    primary: "#006266", primaryForeground: "#ffffff",
    secondary: "#1B1464", secondaryForeground: "#ffffff",
    accent: "#EE5A24", accentForeground: "#ffffff",
    complement: "#FFC312", complementForeground: "#000000",
    success: "#009432", warning: "#F79F1F", destructive: "#EA2027", info: "#0652DD",
    surfaceTint: "0, 98, 102", ring: "#006266",
    gradientFrom: "#006266", gradientVia: "#1B1464", gradientTo: "#EE5A24",
  },

  // ── PAGE 3: FlatUI Neon (electric, high-contrast mixes) ───────────
  {
    id: "fn-wintergreen-neon", label: "Istanbul Neon", category: "flatui-neon",
    primary: "#32ff7e", primaryForeground: "#000000",
    secondary: "#3ae374", secondaryForeground: "#000000",
    accent: "#7d5fff", accentForeground: "#ffffff",
    complement: "#ff4d4d", complementForeground: "#ffffff",
    success: "#32ff7e", warning: "#fffa65", destructive: "#ff3838", info: "#18dcff",
    surfaceTint: "50, 255, 126", ring: "#32ff7e",
    gradientFrom: "#3ae374", gradientVia: "#32ff7e", gradientTo: "#7d5fff",
  },
  {
    id: "fn-electric-lightred", label: "Fogo & Gelo", category: "flatui-neon",
    primary: "#7efff5", primaryForeground: "#000000",
    secondary: "#18dcff", secondaryForeground: "#000000",
    accent: "#ff4d4d", accentForeground: "#ffffff",
    complement: "#fffa65", complementForeground: "#000000",
    success: "#32ff7e", warning: "#ffaf40", destructive: "#ff3838", info: "#18dcff",
    surfaceTint: "126, 255, 245", ring: "#7efff5",
    gradientFrom: "#18dcff", gradientVia: "#7efff5", gradientTo: "#ff4d4d",
  },
  {
    id: "fn-lightindigo-mandarin", label: "Tropico Neon", category: "flatui-neon",
    primary: "#7158e2", primaryForeground: "#ffffff",
    secondary: "#c56cf0", secondaryForeground: "#ffffff",
    accent: "#ffaf40", accentForeground: "#000000",
    complement: "#32ff7e", complementForeground: "#000000",
    success: "#3ae374", warning: "#ff9f1a", destructive: "#ff3838", info: "#17c0eb",
    surfaceTint: "113, 88, 226", ring: "#7158e2",
    gradientFrom: "#7158e2", gradientVia: "#c56cf0", gradientTo: "#ffaf40",
  },
  {
    id: "fn-minty-sizzling", label: "Suecia Flash", category: "flatui-neon",
    primary: "#0be881", primaryForeground: "#000000",
    secondary: "#05c46b", secondaryForeground: "#ffffff",
    accent: "#f53b57", accentForeground: "#ffffff",
    complement: "#575fcf", complementForeground: "#ffffff",
    success: "#0be881", warning: "#ffc048", destructive: "#ff3f34", info: "#4bcffa",
    surfaceTint: "11, 232, 129", ring: "#0be881",
    gradientFrom: "#05c46b", gradientVia: "#0be881", gradientTo: "#f53b57",
  },
  {
    id: "fn-light-green-spiro", label: "Matrix", category: "flatui-neon",
    primary: "#55efc4", primaryForeground: "#000000",
    secondary: "#00b894", secondaryForeground: "#ffffff",
    accent: "#a29bfe", accentForeground: "#ffffff",
    complement: "#fd79a8", complementForeground: "#ffffff",
    success: "#00cec9", warning: "#ffeaa7", destructive: "#ff7675", info: "#74b9ff",
    surfaceTint: "85, 239, 196", ring: "#55efc4",
    gradientFrom: "#00b894", gradientVia: "#55efc4", gradientTo: "#a29bfe",
  },
  {
    id: "fn-dorn-neonblue", label: "Flash Bang", category: "flatui-neon",
    primary: "#fff200", primaryForeground: "#000000",
    secondary: "#ff9f1a", secondaryForeground: "#000000",
    accent: "#18dcff", accentForeground: "#000000",
    complement: "#7d5fff", complementForeground: "#ffffff",
    success: "#32ff7e", warning: "#fffa65", destructive: "#ff3838", info: "#18dcff",
    surfaceTint: "255, 242, 0", ring: "#fff200",
    gradientFrom: "#ff9f1a", gradientVia: "#fff200", gradientTo: "#18dcff",
  },
  {
    id: "fn-energos-lavender", label: "Amsterdam Acid", category: "flatui-neon",
    primary: "#C4E538", primaryForeground: "#000000",
    secondary: "#A3CB38", secondaryForeground: "#000000",
    accent: "#D980FA", accentForeground: "#ffffff",
    complement: "#ED4C67", complementForeground: "#ffffff",
    success: "#009432", warning: "#F79F1F", destructive: "#EA2027", info: "#12CBC4",
    surfaceTint: "196, 229, 56", ring: "#C4E538",
    gradientFrom: "#A3CB38", gradientVia: "#C4E538", gradientTo: "#D980FA",
  },
  {
    id: "fn-jade-amour", label: "Montreal Pulse", category: "flatui-neon",
    primary: "#00d2d3", primaryForeground: "#000000",
    secondary: "#01a3a4", secondaryForeground: "#ffffff",
    accent: "#ee5253", accentForeground: "#ffffff",
    complement: "#ff9ff3", complementForeground: "#000000",
    success: "#10ac84", warning: "#feca57", destructive: "#ee5253", info: "#54a0ff",
    surfaceTint: "0, 210, 211", ring: "#00d2d3",
    gradientFrom: "#01a3a4", gradientVia: "#00d2d3", gradientTo: "#ee5253",
  },
  {
    id: "fn-megaman-highlighter", label: "Malmo Splash", category: "flatui-neon",
    primary: "#4bcffa", primaryForeground: "#000000",
    secondary: "#0fbcf9", secondaryForeground: "#ffffff",
    accent: "#ef5777", accentForeground: "#ffffff",
    complement: "#ffdd59", complementForeground: "#000000",
    success: "#0be881", warning: "#ffc048", destructive: "#ff5e57", info: "#0fbcf9",
    surfaceTint: "75, 207, 250", ring: "#4bcffa",
    gradientFrom: "#0fbcf9", gradientVia: "#4bcffa", gradientTo: "#ef5777",
  },
  {
    id: "fn-turbo-carmine", label: "Bondi Blaze", category: "flatui-neon",
    primary: "#f9ca24", primaryForeground: "#000000",
    secondary: "#f0932b", secondaryForeground: "#000000",
    accent: "#eb4d4b", accentForeground: "#ffffff",
    complement: "#686de0", complementForeground: "#ffffff",
    success: "#6ab04c", warning: "#f9ca24", destructive: "#eb4d4b", info: "#7ed6df",
    surfaceTint: "249, 202, 36", ring: "#f9ca24",
    gradientFrom: "#f0932b", gradientVia: "#f9ca24", gradientTo: "#eb4d4b",
  },
  {
    id: "fn-saturated-watermelon", label: "Pequim Eletric", category: "flatui-neon",
    primary: "#5352ed", primaryForeground: "#ffffff",
    secondary: "#3742fa", secondaryForeground: "#ffffff",
    accent: "#ff4757", accentForeground: "#ffffff",
    complement: "#7bed9f", complementForeground: "#000000",
    success: "#2ed573", warning: "#ffa502", destructive: "#ff4757", info: "#1e90ff",
    surfaceTint: "83, 82, 237", ring: "#5352ed",
    gradientFrom: "#3742fa", gradientVia: "#5352ed", gradientTo: "#ff4757",
  },
  {
    id: "fn-hammam-lightpurple", label: "Bosphorus", category: "flatui-neon",
    primary: "#67e6dc", primaryForeground: "#000000",
    secondary: "#17c0eb", secondaryForeground: "#ffffff",
    accent: "#c56cf0", accentForeground: "#ffffff",
    complement: "#ff3838", complementForeground: "#ffffff",
    success: "#3ae374", warning: "#ffaf40", destructive: "#ff4d4d", info: "#17c0eb",
    surfaceTint: "103, 230, 220", ring: "#67e6dc",
    gradientFrom: "#17c0eb", gradientVia: "#67e6dc", gradientTo: "#c56cf0",
  },

  // ── PAGE 4: FlatUI Pastel (soft, muted cross-mixes) ───────────────
  {
    id: "fp-rogue-squeaky", label: "Moscou Pastel", category: "flatui-pastel",
    primary: "#f78fb3", primaryForeground: "#000000",
    secondary: "#c44569", secondaryForeground: "#ffffff",
    accent: "#63cdda", accentForeground: "#000000",
    complement: "#f5cd79", complementForeground: "#000000",
    success: "#63cdda", warning: "#f5cd79", destructive: "#e15f41", info: "#778beb",
    surfaceTint: "247, 143, 179", ring: "#f78fb3",
    gradientFrom: "#c44569", gradientVia: "#f78fb3", gradientTo: "#63cdda",
  },
  {
    id: "fp-jigglypuff-megaman", label: "Quebec Doce", category: "flatui-pastel",
    primary: "#ff9ff3", primaryForeground: "#000000",
    secondary: "#f368e0", secondaryForeground: "#ffffff",
    accent: "#48dbfb", accentForeground: "#000000",
    complement: "#feca57", complementForeground: "#000000",
    success: "#1dd1a1", warning: "#ff9f43", destructive: "#ee5253", info: "#54a0ff",
    surfaceTint: "255, 159, 243", ring: "#ff9ff3",
    gradientFrom: "#f368e0", gradientVia: "#ff9ff3", gradientTo: "#48dbfb",
  },
  {
    id: "fp-shy-faded", label: "LA Dreamy", category: "flatui-pastel",
    primary: "#a29bfe", primaryForeground: "#ffffff",
    secondary: "#6c5ce7", secondaryForeground: "#ffffff",
    accent: "#81ecec", accentForeground: "#000000",
    complement: "#fab1a0", complementForeground: "#000000",
    success: "#55efc4", warning: "#ffeaa7", destructive: "#ff7675", info: "#74b9ff",
    surfaceTint: "162, 155, 254", ring: "#a29bfe",
    gradientFrom: "#6c5ce7", gradientVia: "#a29bfe", gradientTo: "#81ecec",
  },
  {
    id: "fp-flat-melon", label: "Nice Peach", category: "flatui-pastel",
    primary: "#fad390", primaryForeground: "#000000",
    secondary: "#f8c291", secondaryForeground: "#000000",
    accent: "#6a89cc", accentForeground: "#ffffff",
    complement: "#b8e994", complementForeground: "#000000",
    success: "#78e08f", warning: "#f6b93b", destructive: "#e55039", info: "#82ccdd",
    surfaceTint: "250, 211, 144", ring: "#fad390",
    gradientFrom: "#f8c291", gradientVia: "#fad390", gradientTo: "#6a89cc",
  },
  {
    id: "fp-beekeeper-junebud", label: "Melbourne Sol", category: "flatui-pastel",
    primary: "#f6e58d", primaryForeground: "#000000",
    secondary: "#ffbe76", secondaryForeground: "#000000",
    accent: "#badc58", accentForeground: "#000000",
    complement: "#686de0", complementForeground: "#ffffff",
    success: "#6ab04c", warning: "#f9ca24", destructive: "#ff7979", info: "#7ed6df",
    surfaceTint: "246, 229, 141", ring: "#f6e58d",
    gradientFrom: "#ffbe76", gradientVia: "#f6e58d", gradientTo: "#badc58",
  },
  {
    id: "fp-lavrose-forgotten", label: "Tulipa Roxa", category: "flatui-pastel",
    primary: "#FDA7DF", primaryForeground: "#000000",
    secondary: "#D980FA", secondaryForeground: "#ffffff",
    accent: "#9980FA", accentForeground: "#ffffff",
    complement: "#C4E538", complementForeground: "#000000",
    success: "#12CBC4", warning: "#F79F1F", destructive: "#ED4C67", info: "#0652DD",
    surfaceTint: "253, 167, 223", ring: "#FDA7DF",
    gradientFrom: "#D980FA", gradientVia: "#FDA7DF", gradientTo: "#9980FA",
  },
  {
    id: "fp-oasis-bright", label: "Kerala Mint", category: "flatui-pastel",
    primary: "#9AECDB", primaryForeground: "#000000",
    secondary: "#55E6C1", secondaryForeground: "#000000",
    accent: "#D6A2E8", accentForeground: "#000000",
    complement: "#FEA47F", complementForeground: "#000000",
    success: "#58B19F", warning: "#EAB543", destructive: "#FD7272", info: "#25CCF7",
    surfaceTint: "154, 236, 219", ring: "#9AECDB",
    gradientFrom: "#55E6C1", gradientVia: "#9AECDB", gradientTo: "#D6A2E8",
  },
  {
    id: "fp-pretty-young", label: "Antalya Blush", category: "flatui-pastel",
    primary: "#ffcccc", primaryForeground: "#000000",
    secondary: "#ffb8b8", secondaryForeground: "#000000",
    accent: "#cd84f1", accentForeground: "#ffffff",
    complement: "#7efff5", complementForeground: "#000000",
    success: "#3ae374", warning: "#ffaf40", destructive: "#ff4d4d", info: "#18dcff",
    surfaceTint: "255, 204, 204", ring: "#ffcccc",
    gradientFrom: "#ffb8b8", gradientVia: "#ffcccc", gradientTo: "#cd84f1",
  },
  {
    id: "fp-sarawak-pine", label: "Delhi Garden", category: "flatui-pastel",
    primary: "#F8EFBA", primaryForeground: "#000000",
    secondary: "#BDC581", secondaryForeground: "#000000",
    accent: "#82589F", accentForeground: "#ffffff",
    complement: "#FC427B", complementForeground: "#ffffff",
    success: "#55E6C1", warning: "#EAB543", destructive: "#FD7272", info: "#1B9CFC",
    surfaceTint: "248, 239, 186", ring: "#F8EFBA",
    gradientFrom: "#BDC581", gradientVia: "#F8EFBA", gradientTo: "#82589F",
  },
  {
    id: "fp-creamy-soft", label: "Petersburgo", category: "flatui-pastel",
    primary: "#f3a683", primaryForeground: "#000000",
    secondary: "#f19066", secondaryForeground: "#ffffff",
    accent: "#778beb", accentForeground: "#ffffff",
    complement: "#63cdda", complementForeground: "#000000",
    success: "#63cdda", warning: "#f5cd79", destructive: "#e66767", info: "#546de5",
    surfaceTint: "243, 166, 131", ring: "#f3a683",
    gradientFrom: "#f19066", gradientVia: "#f3a683", gradientTo: "#778beb",
  },
  {
    id: "fp-spray-paradise", label: "Lyon Verde", category: "flatui-pastel",
    primary: "#82ccdd", primaryForeground: "#000000",
    secondary: "#60a3bc", secondaryForeground: "#ffffff",
    accent: "#b8e994", accentForeground: "#000000",
    complement: "#e55039", complementForeground: "#ffffff",
    success: "#78e08f", warning: "#fa983a", destructive: "#eb2f06", info: "#6a89cc",
    surfaceTint: "130, 204, 221", ring: "#82ccdd",
    gradientFrom: "#60a3bc", gradientVia: "#82ccdd", gradientTo: "#b8e994",
  },
  {
    id: "fp-periwinkle-hint", label: "Westminster", category: "flatui-pastel",
    primary: "#9c88ff", primaryForeground: "#ffffff",
    secondary: "#8c7ae6", secondaryForeground: "#ffffff",
    accent: "#dcdde1", accentForeground: "#000000",
    complement: "#fbc531", complementForeground: "#000000",
    success: "#4cd137", warning: "#fbc531", destructive: "#e84118", info: "#00a8ff",
    surfaceTint: "156, 136, 255", ring: "#9c88ff",
    gradientFrom: "#8c7ae6", gradientVia: "#9c88ff", gradientTo: "#dcdde1",
  },
  // ── Modern ──────────────────────────────────────────────────────────
  {
    id: "mod-arctic", label: "Arctic Blue", category: "modern",
    primary: "#0EA5E9", primaryForeground: "#ffffff",
    secondary: "#0284C7", secondaryForeground: "#ffffff",
    accent: "#7DD3FC", accentForeground: "#0c4a6e",
    complement: "#F97316", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#EAB308", destructive: "#EF4444", info: "#06B6D4",
    surfaceTint: "14, 165, 233", ring: "#0EA5E9",
    gradientFrom: "#0284C7", gradientVia: "#0EA5E9", gradientTo: "#7DD3FC",
  },
  {
    id: "mod-emerald-glass", label: "Emerald Glass", category: "modern",
    primary: "#10B981", primaryForeground: "#ffffff",
    secondary: "#059669", secondaryForeground: "#ffffff",
    accent: "#6EE7B7", accentForeground: "#064e3b",
    complement: "#F472B6", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#FBBF24", destructive: "#FB7185", info: "#67E8F9",
    surfaceTint: "16, 185, 129", ring: "#10B981",
    gradientFrom: "#059669", gradientVia: "#10B981", gradientTo: "#6EE7B7",
  },
  {
    id: "mod-rose-gold", label: "Rose Gold", category: "modern",
    primary: "#F43F5E", primaryForeground: "#ffffff",
    secondary: "#BE123C", secondaryForeground: "#ffffff",
    accent: "#FDA4AF", accentForeground: "#881337",
    complement: "#14B8A6", complementForeground: "#ffffff",
    success: "#4ADE80", warning: "#FCD34D", destructive: "#DC2626", info: "#38BDF8",
    surfaceTint: "244, 63, 94", ring: "#F43F5E",
    gradientFrom: "#BE123C", gradientVia: "#F43F5E", gradientTo: "#FDA4AF",
  },
  {
    id: "mod-sunset-amber", label: "Sunset Amber", category: "modern",
    primary: "#F59E0B", primaryForeground: "#000000",
    secondary: "#D97706", secondaryForeground: "#000000",
    accent: "#FCD34D", accentForeground: "#78350f",
    complement: "#8B5CF6", complementForeground: "#ffffff",
    success: "#34D399", warning: "#FB923C", destructive: "#EF4444", info: "#60A5FA",
    surfaceTint: "245, 158, 11", ring: "#F59E0B",
    gradientFrom: "#D97706", gradientVia: "#F59E0B", gradientTo: "#FCD34D",
  },
  {
    id: "mod-electric-indigo", label: "Electric Indigo", category: "modern",
    primary: "#6366F1", primaryForeground: "#ffffff",
    secondary: "#4F46E5", secondaryForeground: "#ffffff",
    accent: "#A5B4FC", accentForeground: "#312e81",
    complement: "#FB923C", complementForeground: "#000000",
    success: "#10B981", warning: "#F59E0B", destructive: "#F43F5E", info: "#22D3EE",
    surfaceTint: "99, 102, 241", ring: "#6366F1",
    gradientFrom: "#4F46E5", gradientVia: "#6366F1", gradientTo: "#A5B4FC",
  },
  {
    id: "mod-cyber-teal", label: "Cyber Teal", category: "modern",
    primary: "#14B8A6", primaryForeground: "#ffffff",
    secondary: "#0D9488", secondaryForeground: "#ffffff",
    accent: "#5EEAD4", accentForeground: "#134e4a",
    complement: "#E879F9", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#FBBF24", destructive: "#F43F5E", info: "#38BDF8",
    surfaceTint: "20, 184, 166", ring: "#14B8A6",
    gradientFrom: "#0D9488", gradientVia: "#14B8A6", gradientTo: "#5EEAD4",
  },
  {
    id: "mod-midnight-purple", label: "Midnight Purple", category: "modern",
    primary: "#A855F7", primaryForeground: "#ffffff",
    secondary: "#9333EA", secondaryForeground: "#ffffff",
    accent: "#D8B4FE", accentForeground: "#581c87",
    complement: "#22D3EE", complementForeground: "#000000",
    success: "#4ADE80", warning: "#FBBF24", destructive: "#FB7185", info: "#67E8F9",
    surfaceTint: "168, 85, 247", ring: "#A855F7",
    gradientFrom: "#7C3AED", gradientVia: "#A855F7", gradientTo: "#D8B4FE",
  },
  {
    id: "mod-hot-pink", label: "Hot Pink", category: "modern",
    primary: "#EC4899", primaryForeground: "#ffffff",
    secondary: "#DB2777", secondaryForeground: "#ffffff",
    accent: "#F9A8D4", accentForeground: "#831843",
    complement: "#34D399", complementForeground: "#000000",
    success: "#4ADE80", warning: "#FCD34D", destructive: "#EF4444", info: "#38BDF8",
    surfaceTint: "236, 72, 153", ring: "#EC4899",
    gradientFrom: "#DB2777", gradientVia: "#EC4899", gradientTo: "#F9A8D4",
  },
  {
    id: "mod-forest", label: "Forest", category: "modern",
    primary: "#16A34A", primaryForeground: "#ffffff",
    secondary: "#15803D", secondaryForeground: "#ffffff",
    accent: "#86EFAC", accentForeground: "#14532d",
    complement: "#F472B6", complementForeground: "#ffffff",
    success: "#4ADE80", warning: "#FBBF24", destructive: "#F43F5E", info: "#38BDF8",
    surfaceTint: "22, 163, 74", ring: "#16A34A",
    gradientFrom: "#15803D", gradientVia: "#16A34A", gradientTo: "#86EFAC",
  },
  {
    id: "mod-slate-steel", label: "Slate Steel", category: "modern",
    primary: "#64748B", primaryForeground: "#ffffff",
    secondary: "#475569", secondaryForeground: "#ffffff",
    accent: "#94A3B8", accentForeground: "#1e293b",
    complement: "#F59E0B", complementForeground: "#000000",
    success: "#22C55E", warning: "#EAB308", destructive: "#EF4444", info: "#0EA5E9",
    surfaceTint: "100, 116, 139", ring: "#64748B",
    gradientFrom: "#475569", gradientVia: "#64748B", gradientTo: "#94A3B8",
  },
  {
    id: "mod-coral", label: "Coral Reef", category: "modern",
    primary: "#FB7185", primaryForeground: "#ffffff",
    secondary: "#F43F5E", secondaryForeground: "#ffffff",
    accent: "#FECDD3", accentForeground: "#881337",
    complement: "#06B6D4", complementForeground: "#ffffff",
    success: "#34D399", warning: "#FBBF24", destructive: "#DC2626", info: "#38BDF8",
    surfaceTint: "251, 113, 133", ring: "#FB7185",
    gradientFrom: "#F43F5E", gradientVia: "#FB7185", gradientTo: "#FECDD3",
  },
  {
    id: "mod-neon-lime", label: "Neon Lime", category: "modern",
    primary: "#84CC16", primaryForeground: "#000000",
    secondary: "#65A30D", secondaryForeground: "#ffffff",
    accent: "#BEF264", accentForeground: "#365314",
    complement: "#D946EF", complementForeground: "#ffffff",
    success: "#22C55E", warning: "#F59E0B", destructive: "#EF4444", info: "#06B6D4",
    surfaceTint: "132, 204, 22", ring: "#84CC16",
    gradientFrom: "#65A30D", gradientVia: "#84CC16", gradientTo: "#BEF264",
  },
];

export type ThemeMode = "dark" | "light";

interface ThemeState {
  mode: ThemeMode;
  paletteId: string;
  fullscreen: boolean;
}

interface ThemeContextValue extends ThemeState {
  setMode: (mode: ThemeMode) => void;
  setPaletteId: (id: string) => void;
  toggleFullscreen: () => void;
  palette: ThemePalette;
}

const STORAGE_KEY = "memelab-theme";

const defaults: ThemeState = { mode: "dark", paletteId: "violet", fullscreen: false };

function loadState(): ThemeState {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === "light" ? "light" : "dark",
      paletteId: PALETTES.find((p) => p.id === parsed.paletteId) ? parsed.paletteId : "violet",
      fullscreen: false,
    };
  } catch {
    return defaults;
  }
}

function saveState(state: ThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode, paletteId: state.paletteId }));
  } catch {}
}

// ── Apply full theme to DOM ──────────────────────────────────────────

function applyPalette(palette: ThemePalette, mode: ThemeMode) {
  const el = document.documentElement;
  const s = el.style;

  // Core colors
  s.setProperty("--color-primary", palette.primary);
  s.setProperty("--color-primary-foreground", palette.primaryForeground);
  s.setProperty("--color-ring", palette.ring);
  s.setProperty("--color-accent", palette.accent);
  s.setProperty("--color-accent-foreground", palette.accentForeground);

  // Semantic
  s.setProperty("--color-success", palette.success);
  s.setProperty("--color-warning", palette.warning);
  s.setProperty("--color-destructive", palette.destructive);
  s.setProperty("--color-destructive-foreground", "#ffffff");
  s.setProperty("--color-info", palette.info);

  // Complement (available as CSS var for badges, highlights)
  s.setProperty("--color-complement", palette.complement);
  s.setProperty("--color-complement-foreground", palette.complementForeground);

  // Secondary accent — direct palette color for explicit use
  s.setProperty("--color-secondary-accent", palette.secondary);
  s.setProperty("--color-secondary-accent-foreground", palette.secondaryForeground);

  // Chart colors (used by Recharts, dashboards, etc.)
  s.setProperty("--color-chart-1", palette.primary);
  s.setProperty("--color-chart-2", palette.accent);
  s.setProperty("--color-chart-3", palette.complement);
  s.setProperty("--color-chart-4", palette.info);
  s.setProperty("--color-chart-5", palette.success);

  // Gradients
  s.setProperty("--gradient-from", palette.gradientFrom);
  s.setProperty("--gradient-via", palette.gradientVia);
  s.setProperty("--gradient-to", palette.gradientTo);

  // Surface tints — subtle primary tint in dark surfaces
  const t = palette.surfaceTint;
  if (mode === "dark") {
    s.setProperty("--color-surface-0", `rgba(${t}, 0.01)`);
    s.setProperty("--color-surface-1", `rgba(${t}, 0.03)`);
    s.setProperty("--color-surface-2", `rgba(${t}, 0.05)`);
    s.setProperty("--color-surface-3", `rgba(${t}, 0.07)`);
    // Blend tinted surfaces onto dark base
    s.setProperty("--color-background", "#06060a");
    s.setProperty("--color-foreground", "#f0f0f5");
    s.setProperty("--color-card", `color-mix(in srgb, #0f0f14 96%, ${palette.primary})`);
    s.setProperty("--color-card-foreground", "#f0f0f5");
    s.setProperty("--color-popover", `color-mix(in srgb, #16161d 94%, ${palette.primary})`);
    s.setProperty("--color-popover-foreground", "#f0f0f5");
    s.setProperty("--color-secondary", `color-mix(in srgb, #1a1a24 94%, ${palette.primary})`);
    s.setProperty("--color-secondary-foreground", "#f0f0f5");
    s.setProperty("--color-muted", `color-mix(in srgb, #1a1a24 96%, ${palette.primary})`);
    s.setProperty("--color-muted-foreground", "#8888a0");
    s.setProperty("--color-border", `rgba(${t}, 0.08)`);
    s.setProperty("--color-input", `color-mix(in srgb, #1a1a24 94%, ${palette.primary})`);
  } else {
    s.setProperty("--color-surface-0", "#f8f8fc");
    s.setProperty("--color-surface-1", `color-mix(in srgb, #f0f0f5 97%, ${palette.primary})`);
    s.setProperty("--color-surface-2", `color-mix(in srgb, #e8e8f0 96%, ${palette.primary})`);
    s.setProperty("--color-surface-3", `color-mix(in srgb, #dddde8 95%, ${palette.primary})`);
    s.setProperty("--color-background", "#f8f8fc");
    s.setProperty("--color-foreground", "#1a1a2e");
    s.setProperty("--color-card", `color-mix(in srgb, #ffffff 98%, ${palette.primary})`);
    s.setProperty("--color-card-foreground", "#1a1a2e");
    s.setProperty("--color-popover", "#ffffff");
    s.setProperty("--color-popover-foreground", "#1a1a2e");
    s.setProperty("--color-secondary", `color-mix(in srgb, #e8e8f0 95%, ${palette.primary})`);
    s.setProperty("--color-secondary-foreground", "#1a1a2e");
    s.setProperty("--color-muted", `color-mix(in srgb, #e8e8f0 96%, ${palette.primary})`);
    s.setProperty("--color-muted-foreground", "#6b6b80");
    s.setProperty("--color-border", `rgba(${t}, 0.10)`);
    s.setProperty("--color-input", `color-mix(in srgb, #e8e8f0 95%, ${palette.primary})`);
  }
}

function applyMode(mode: ThemeMode) {
  const el = document.documentElement;
  el.classList.remove("dark", "light");
  el.classList.add(mode);
}

// ── Context ──────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(defaults);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const palette = PALETTES.find((p) => p.id === state.paletteId) ?? PALETTES[0];
    applyMode(state.mode);
    applyPalette(palette, state.mode);
    saveState(state);
  }, [state, mounted]);

  const setMode = useCallback((mode: ThemeMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const setPaletteId = useCallback((paletteId: string) => {
    setState((s) => ({ ...s, paletteId }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setState((s) => ({ ...s, fullscreen: true }));
    } else {
      document.exitFullscreen().catch(() => {});
      setState((s) => ({ ...s, fullscreen: false }));
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      setState((s) => ({ ...s, fullscreen: !!document.fullscreenElement }));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const palette = PALETTES.find((p) => p.id === state.paletteId) ?? PALETTES[0];

  return (
    <ThemeContext.Provider value={{ ...state, setMode, setPaletteId, toggleFullscreen, palette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
