// Category → Lucide icon + tile colors. Single source of truth for the
// category avatars on Discover / org listings (icon pass 2026-07-20; replaces
// the per-page CAT_EMOJI/CAT_BG maps). Pastel bgs are the v1 originals; fg is
// a matching darker tone from the existing palette family.
import {
  Apple,
  BookOpen,
  FlaskConical,
  Handshake,
  HeartPulse,
  Landmark,
  Palette,
  PawPrint,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react";

type CategoryMeta = { Icon: LucideIcon; bg: string; fg: string };

const FALLBACK: CategoryMeta = { Icon: Landmark, bg: "#e8f5ef", fg: "#175c41" };

const CATEGORY_META: Record<string, CategoryMeta> = {
  Education: { Icon: BookOpen, bg: "#eef4ff", fg: "#2563eb" },
  Environment: { Icon: Sprout, bg: "#e8f5ef", fg: "#175c41" },
  Health: { Icon: HeartPulse, bg: "#fdecef", fg: "#be123c" },
  Animals: { Icon: PawPrint, bg: "#fef3e0", fg: "#c2410c" },
  "Food & Hunger": { Icon: Apple, bg: "#fef2f2", fg: "#dc2626" },
  "Arts & Culture": { Icon: Palette, bg: "#f5edff", fg: "#6b21a8" },
  Community: { Icon: Handshake, bg: "#e8f5ef", fg: "#175c41" },
  STEM: { Icon: FlaskConical, bg: "#fdf5e0", fg: "#d97706" },
  Agriculture: { Icon: Wheat, bg: "#eef7e6", fg: "#4d7c0f" },
};

export function getCategoryMeta(category?: string | null): CategoryMeta {
  return CATEGORY_META[category ?? ""] ?? FALLBACK;
}

export function CategoryIcon({ category, size = 20 }: { category?: string | null; size?: number }) {
  const { Icon } = getCategoryMeta(category);
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
