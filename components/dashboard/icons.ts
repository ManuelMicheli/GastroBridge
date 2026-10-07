import {
  LayoutDashboard, Search, Store, ShoppingCart,
  ClipboardList, BarChart3, Settings, Package,
  Users, Star, MapPin, Plus, Truck, HelpCircle,
  TrendingUp, TrendingDown, BookMarked, Tag, UserCog,
  Warehouse, FileText, Bell, MessageCircle, Receipt,
  RotateCcw, ChefHat, CalendarClock, ShieldCheck, Wand2,
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
  BookMarked,
  Tag,
  UserCog,
  Warehouse,
  FileText,
  Bell,
  MessageCircle,
  Receipt,
  RotateCcw,
  ChefHat,
  CalendarClock,
  ShieldCheck,
  Wand2,
};

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || LayoutDashboard;
}
