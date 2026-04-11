// Visual grammar for badge categories — Style Guide §7.2.
// Each badge category maps to:
//   - a canonical Lucide glyph (never change these; they are part of the
//     UI's vocabulary)
//   - a stripe color class used on the BadgeChip's 4px left sliver
//   - a stroke color class for the icon itself
//
// Importing from this module keeps the mapping centralized so a future
// redesign updates one file, not every component.

import type { LucideIcon } from "lucide-react";
import { Award, Brain, Sparkles, Target, Trophy, Users } from "lucide-react";

import type { BadgeCategory } from "@rpgfc/shared";

export interface BadgeCategoryMeta {
  icon: LucideIcon;
  stripeClass: string;
  iconClass: string;
  label: string;
}

export const BADGE_CATEGORY_META: Record<BadgeCategory, BadgeCategoryMeta> = {
  NaturalGift: {
    icon: Sparkles,
    stripeClass: "bg-moss-600",
    iconClass: "text-moss-600",
    label: "Natural Gift",
  },
  MentalTrait: {
    icon: Brain,
    stripeClass: "bg-clay-600",
    iconClass: "text-clay-600",
    label: "Mental Trait",
  },
  PositionalMastery: {
    icon: Target,
    stripeClass: "bg-parchment-700",
    iconClass: "text-parchment-700",
    label: "Positional Mastery",
  },
  EarnedSkill: {
    icon: Award,
    stripeClass: "bg-moss-500",
    iconClass: "text-moss-500",
    label: "Earned Skill",
  },
  Achievement: {
    icon: Trophy,
    stripeClass: "bg-clay-500",
    iconClass: "text-clay-500",
    label: "Achievement",
  },
  Relationship: {
    icon: Users,
    stripeClass: "bg-parchment-600",
    iconClass: "text-parchment-600",
    label: "Relationship",
  },
};
