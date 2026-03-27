import {
  LayoutDashboard, Search, Store, ShoppingCart,
  ClipboardList, BarChart3, Settings, Package,
  Users, Star, MapPin, Plus, Truck, HelpCircle,
  TrendingUp, TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Search,
  Store,
  ShoppingCart,
  ClipboardList,
  BarChart3,
  Settings,
  Package,
  Users,
  Star,
  MapPin,
  Plus,
  Truck,
  HelpCircle,
  TrendingUp,
  TrendingDown,
};

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || LayoutDashboard;
}
