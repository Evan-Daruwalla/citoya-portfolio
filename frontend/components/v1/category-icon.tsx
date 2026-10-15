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

const FALLBACK: CategoryMeta = { Icon: Landmark, bg: "var(--c-cat-fallback-bg)", fg: "var(--c-cat-fallback-fg)" };

const CATEGORY_META: Record<string, CategoryMeta> = {
  Education: { Icon: BookOpen, bg: "var(--c-cat-education-bg)", fg: "var(--c-cat-education-fg)" },
  Environment: { Icon: Sprout, bg: "var(--c-cat-environment-bg)", fg: "var(--c-cat-environment-fg)" },
  Health: { Icon: HeartPulse, bg: "var(--c-cat-health-bg)", fg: "var(--c-cat-health-fg)" },
  Animals: { Icon: PawPrint, bg: "var(--c-cat-animals-bg)", fg: "var(--c-cat-animals-fg)" },
  "Food & Hunger": { Icon: Apple, bg: "var(--c-cat-food-bg)", fg: "var(--c-cat-food-fg)" },
  "Arts & Culture": { Icon: Palette, bg: "var(--c-cat-arts-bg)", fg: "var(--c-cat-arts-fg)" },
  Community: { Icon: Handshake, bg: "var(--c-cat-community-bg)", fg: "var(--c-cat-community-fg)" },
  STEM: { Icon: FlaskConical, bg: "var(--c-cat-stem-bg)", fg: "var(--c-cat-stem-fg)" },
  Agriculture: { Icon: Wheat, bg: "var(--c-cat-agriculture-bg)", fg: "var(--c-cat-agriculture-fg)" },
};

export function getCategoryMeta(category?: string | null): CategoryMeta {
  return CATEGORY_META[category ?? ""] ?? FALLBACK;
}

export function CategoryIcon({ category, size = 20 }: { category?: string | null; size?: number }) {
  const { Icon } = getCategoryMeta(category);
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
