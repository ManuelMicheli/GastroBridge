"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Menu } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { SearchTrigger } from "./search-trigger";
import { NotificationBell } from "./notification-bell";
import { KeyboardHelpModal } from "./keyboard-help-modal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LiveStatus } from "@/components/supplier/signature";
import { Avatar } from "@/components/fernly/primitives";

type Props = {
  onMenuToggle?: () => void;
  liveStatus?: { count: number; label: string };
  companyName?: string;
  userEmail?: string;
  messagesHref?: string;
  unreadMessages?: number;
  settingsHref?: string;
};

/**
 * Fernly topbar — a floating panel: pill search (⌘K) on the left, round
 * icon buttons (messages, notifications, theme) and the account chip on the
 * right. Nested routes keep their breadcrumbs next to the search field.
 */
export function DarkTopbar({
  onMenuToggle,
  liveStatus,
  companyName = "",
  userEmail = "",
  messagesHref = "/messaggi",
  unreadMessages = 0,
  settingsHref = "/impostazioni",
}: Props) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[var(--f-canvas)] pb-2.5 pt-2.5">
      <div className="flex h-16 items-center justify-between gap-4 rounded-[22px] bg-[var(--f-panel)] pl-3 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="f-icon-btn lg:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SearchTrigger />
          <div className="hidden min-w-0 xl:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {liveStatus ? (
            <div className="hidden md:block">
              <LiveStatus count={liveStatus.count} label={liveStatus.label} />
            </div>
          ) : null}
          <Link
            href={messagesHref}
            prefetch={false}
            className="f-icon-btn"
            aria-label={unreadMessages > 0 ? `Messaggi (${unreadMessages} non letti)` : "Messaggi"}
          >
            <Mail className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {unreadMessages > 0 ? (
              <span aria-hidden className="absolute right-[9px] top-[9px] h-2 w-2 rounded-full bg-[#E5484D] ring-2 ring-[var(--f-card)]" />
            ) : null}
          </Link>
          <NotificationBell />
          <ThemeToggle className="f-icon-btn !h-10 !w-10 !rounded-full !bg-[var(--f-card)] !p-0 !text-[var(--f-ink)] [&_svg]:!h-[18px] [&_svg]:!w-[18px]" />
          {companyName ? (
            <Link
              href={settingsHref}
              className="ml-1 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--f-fill-2)]"
              aria-label="Account e impostazioni"
            >
              <Avatar name={companyName} size={38} />
              <span className="hidden min-w-0 flex-col leading-tight md:flex">
                <span className="max-w-[180px] truncate text-[14px] font-semibold text-[var(--f-ink)]">{companyName}</span>
                <span className="max-w-[180px] truncate text-[12px] text-[var(--f-muted)]">{userEmail}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </div>
      <KeyboardHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
