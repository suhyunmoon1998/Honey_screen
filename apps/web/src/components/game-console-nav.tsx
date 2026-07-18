"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleSwitch } from "@/components/locale-switch";
import { SignOutForm } from "@/components/signout-form";
import type { Locale } from "@honey/i18n";

type NavItem = {
  href: string;
  label: string;
  glyph: string;
  active: boolean;
};

type Props = {
  currentLocale: Locale;
  currentPath: string;
  levelNumber: number;
  levelTitle: string;
  homeLabel: string;
  rewardLabel: string;
  remindersLabel: string;
  menuLabel: string;
  openLabel: string;
  closeLabel: string;
  powerLabel: string;
  switchLanguageLabel: string;
};

export function GameConsoleNav({
  currentLocale,
  currentPath,
  levelNumber,
  levelTitle,
  homeLabel,
  rewardLabel,
  remindersLabel,
  menuLabel,
  openLabel,
  closeLabel,
  powerLabel,
  switchLanguageLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: homeLabel,
      glyph: "⌂",
      active: currentPath === "/dashboard",
    },
    {
      href: "/reward",
      label: rewardLabel,
      glyph: "♦",
      active: currentPath === "/reward",
    },
    {
      href: "/settings/notifications",
      label: remindersLabel,
      glyph: "♪",
      active: currentPath === "/settings/notifications",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        aria-expanded={open}
        className="console-trigger glow-green fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-2xl"
      >
        <span className="console-trigger-led" aria-hidden="true" />
        <span aria-hidden="true" className="flex flex-col gap-[3px]">
          <span className="h-[2px] w-4 rounded-full bg-current" />
          <span className="h-[2px] w-4 rounded-full bg-current" />
          <span className="h-[2px] w-4 rounded-full bg-current" />
        </span>
      </button>

      {open ? (
        <div className="console-nav-layer inset-0 z-50">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="console-nav-overlay absolute inset-0"
          />

          <aside className="console-shell absolute inset-y-0 left-0 flex w-[280px] max-w-[82vw] flex-col p-3">
            <span className="console-screw" style={{ top: 10, left: 10 }} />
            <span className="console-screw" style={{ top: 10, right: 10 }} />

            <div className="console-screen relative mt-2 overflow-hidden rounded-[14px] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-[#150f28]">
                    <Image
                      src="/honey-avatar.png"
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="pixel-label text-[#3ee8a8]">
                      NV.{levelNumber}
                    </p>
                    <p className="truncate text-[11px] text-[#c9b8ff]">
                      {levelTitle}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="console-led" aria-hidden="true" />
                  <span className="pixel-label text-[#8fd9bb]">
                    {powerLabel}
                  </span>
                </div>
              </div>

              <p className="pixel-label mt-4 text-white/40">{menuLabel}</p>
              <nav className="mt-2 flex flex-col">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    data-active={item.active}
                    className="console-menu-item flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm"
                  >
                    <span aria-hidden="true" className="w-4 text-center">
                      {item.active ? "›" : ""}
                    </span>
                    <span aria-hidden="true">{item.glyph}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="console-speaker my-3" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, row) => (
                <div key={row} className="console-speaker-row" />
              ))}
            </div>

            <div className="mt-auto flex items-end justify-between px-1 pb-1">
              <div className="console-dpad" aria-hidden="true">
                <span className="console-dpad-up" />
                <span className="console-dpad-down" />
                <span className="console-dpad-left" />
                <span className="console-dpad-right" />
                <span className="console-dpad-center" />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={closeLabel}
                  className="console-btn console-btn-b"
                >
                  B
                </button>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  aria-label={homeLabel}
                  className="console-btn console-btn-a"
                >
                  A
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <LocaleSwitch
                currentLocale={currentLocale}
                redirectTo={currentPath}
                label={switchLanguageLabel}
                className="button-secondary flex-1 text-center text-xs"
              />
              <div className="flex-1">
                <SignOutForm />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
