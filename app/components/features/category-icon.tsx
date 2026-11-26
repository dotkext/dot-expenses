import {
  Banknote,
  BookOpen,
  Bus,
  Car,
  CircleDashed,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Landmark,
  Plane,
  PlugZap,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Curated icon registry (keeps the bundle small vs. importing all icons). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  tag: Tag,
  "bank-note": Banknote,
  banknote: Banknote,
  book: BookOpen,
  bus: Bus,
  car: Car,
  "circle-dashed": CircleDashed,
  clapperboard: Clapperboard,
  coffee: Coffee,
  dumbbell: Dumbbell,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  home: Home,
  laptop: Laptop,
  landmark: Landmark,
  plane: Plane,
  "plug-zap": PlugZap,
  repeat: Repeat,
  "shopping-bag": ShoppingBag,
  "shopping-basket": ShoppingBasket,
  smartphone: Smartphone,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  wrench: Wrench,
  "credit-card": CreditCard,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS).sort();

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
}) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Tag;
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      style={color ? { color } : undefined}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
