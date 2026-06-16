"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { Card } from "@/components/ui/card";
import { activeConfig } from "@/content";
import type { NavNode } from "@/components/navigator/types";

function splitTitle(title: string): { main: string; sub: string } {
  const idx = title.indexOf(" ");
  if (idx === -1) return { main: title, sub: "" };
  return { main: title.slice(0, idx), sub: title.slice(idx + 1) };
}

function DirectionIcon({ slug }: { slug: string }) {
  const src = slug === "meeting" ? "/icon-meeting.svg" : "/icon-call.svg";
  return (
    <div className="relative shrink-0" style={{ width: "clamp(3.25rem,5vw,5.5rem)", height: "clamp(3.25rem,5vw,5.5rem)" }}>
      <Image src={src} alt={slug} fill className="object-contain" priority />
    </div>
  );
}

function RippleLink({ href, children }: { href: string; children: React.ReactNode }) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple-wave";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }, []);

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="nav-button ripple-container flex items-center justify-center rounded-xl font-medium text-center text-foreground hover:text-white select-none"
      style={{
        fontSize: "clamp(1rem, 1.25vw, 1.4rem)", /* 12pt floor, scales up like a slide */
        padding: "clamp(0.7rem, 1vw, 1.1rem) 1.25rem",
      }}
    >
      {children}
    </Link>
  );
}

function DirectionCard({ direction }: { direction: NavNode }) {
  const { main, sub } = splitTitle(direction.title);

  return (
    <Card
      className="bg-white border-0 shadow-md rounded-3xl flex flex-col flex-1"
      style={{ padding: "clamp(1.75rem, 2.8vw, 3.5rem)", gap: "clamp(1.5rem, 2.6vw, 2.75rem)" }}
    >
      <div className="flex items-center" style={{ gap: "clamp(0.75rem, 1.3vw, 1.5rem)" }}>
        <DirectionIcon slug={direction.slug} />
        <div className="leading-tight">
          {/* Card title — scales with slide */}
          <span
            className="block font-extrabold uppercase tracking-wide text-primary leading-none"
            style={{ fontSize: "clamp(1.625rem, 2.5vw, 2.9rem)" }}
          >
            {main}
          </span>
          {sub && (
            /* 14–16pt floor */
            <span
              className="block font-medium text-foreground/80"
              style={{ fontSize: "clamp(1.1875rem, 1.65vw, 1.9rem)", marginTop: "0.3em" }}
            >
              {sub}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: "clamp(0.7rem, 1.1vw, 1.15rem)" }}>
        {direction.children?.map((section) => (
          <RippleLink key={section.id} href={`/${direction.slug}/${section.slug}`}>
            {section.title}
          </RippleLink>
        ))}
      </div>
    </Card>
  );
}

export function HomeScreen() {
  const { title, theme, directions } = activeConfig;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #eef3f8 0%, #F0F5FA 60%, #e7eef4 100%)" }}
    >
      {/* Dark header band — pill straddles its bottom edge and sticks out downward
          onto the light area (mirrors the menu's "dark on half" treatment). */}
      <div
        className="flex w-full justify-center bg-gradient-to-b from-[#49575f] to-[#5a6772]"
        style={{ padding: "clamp(2rem, 4.5vh, 3.5rem) clamp(1rem, 3vw, 2.75rem) 0" }}
      >
        <div
          className="rounded-2xl bg-[#cad7e0]/95 text-center shadow-[0_18px_40px_-12px_rgba(23,23,23,0.45)]"
          style={{
            maxWidth: "min(1500px, 94vw)",
            width: "100%",
            padding: "clamp(0.85rem, 1.4vw, 1.4rem) clamp(1.5rem, 4vw, 3rem)",
            marginBottom: "clamp(-3.25rem, -3vw, -2.25rem)",
          }}
        >
          {/* 24–28pt floor, scales with slide */}
          <h1
            className="font-bold text-[#52626F] tracking-wide"
            style={{ fontSize: "clamp(2rem, 3vw, 3.4rem)", lineHeight: 1.2 }}
          >
            {title}
          </h1>
        </div>
      </div>

      {/* Cards — centered group; extra top padding clears the overhanging title pill. */}
      <main className="flex-1 flex items-center justify-center" style={{ padding: "clamp(3.5rem, 6vh, 5rem) clamp(1rem, 4vw, 3rem) clamp(1.5rem, 3vh, 3rem)" }}>
        <div
          className="w-full flex flex-col md:flex-row justify-center"
          style={{ gap: "clamp(1.5rem, 3vw, 3.5rem)", maxWidth: "min(1400px, 80vw)" }}
        >
          {directions.map((direction) => (
            <DirectionCard key={direction.id} direction={direction} />
          ))}
        </div>
      </main>

      {/* Footer — bottom padding = 1.25rem (20px) to align logo bottom with the bot widget's bottom-5 */}
      <footer className="grid grid-cols-3 items-center" style={{ padding: "clamp(0.5rem, 1vh, 0.85rem) clamp(1.5rem, 3vw, 3rem) 1.25rem" }}>
        <div className="flex justify-start">
          <Image src={theme.logoRed} alt={theme.name} width={185} height={52} className="object-contain" priority />
        </div>
        <div className="flex items-center justify-center gap-2 text-foreground/50" style={{ fontSize: "0.8125rem" }}>
          <span>Осъществено от</span>
          {theme.partnerLogo && (
            <Image src={theme.partnerLogo} alt={theme.partnerName ?? "Partner"} width={91} height={16} className="object-contain opacity-70" />
          )}
        </div>
        <div aria-hidden />
      </footer>
    </div>
  );
}
