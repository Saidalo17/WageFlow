import {
  Baby,
  Banknote,
  Beer,
  Bike,
  Building2,
  Camera,
  CreditCard,
  Glasses,
  Palette,
  Pill,
  Pizza,
  Receipt,
  Scissors,
  ShoppingCart,
  Sparkles,
  Star,
  Stethoscope,
  TrainFront,
  TreePine,
  Trophy,
  Tv,
  Umbrella,
  Book,
  Briefcase,
  Bus,
  Car,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIconKey } from "@/lib/category-meta";
import { cn } from "@/lib/utils";

const ICONS: Record<CategoryIconKey, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  home: House,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  book: Book,
  clapperboard: Clapperboard,
  gamepad: Gamepad2,
  music: Music,
  gift: Gift,
  baby: Baby,
  "paw-print": PawPrint,
  wrench: Wrench,
  repeat: Repeat,
  briefcase: Briefcase,
  laptop: Laptop,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  landmark: Landmark,
  gem: Gem,
  "circle-ellipsis": CircleEllipsis,
  pizza: Pizza,
  beer: Beer,
  glasses: Glasses,
  scissors: Scissors,
  train: TrainFront,
  bike: Bike,
  umbrella: Umbrella,
  tv: Tv,
  camera: Camera,
  palette: Palette,
  stethoscope: Stethoscope,
  pill: Pill,
  building: Building2,
  tree: TreePine,
  sparkles: Sparkles,
  star: Star,
  trophy: Trophy,
  "shopping-cart": ShoppingCart,
  "credit-card": CreditCard,
  receipt: Receipt,
};

export function CategoryIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name as CategoryIconKey] ?? CircleEllipsis;
  return <Icon className={cn("size-5", className)} aria-hidden />;
}

/** Round colored badge with the category icon. */
export function CategoryBadge({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn("grid size-11 shrink-0 place-items-center rounded-full", className)}
      style={{ backgroundColor: `${color}26`, color }}
    >
      <CategoryIcon name={icon} />
    </span>
  );
}
