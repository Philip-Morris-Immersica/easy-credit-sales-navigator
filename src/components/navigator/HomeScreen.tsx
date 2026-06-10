import Image from "next/image";
import Link from "next/link";
import { Phone, Users, MessageCircleMore, MessagesSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { activeConfig } from "@/content";
import type { NavNode } from "@/components/navigator/types";

function splitTitle(title: string): { main: string; sub: string } {
  const idx = title.indexOf(" ");
  if (idx === -1) return { main: title, sub: "" };
  return { main: title.slice(0, idx), sub: title.slice(idx + 1) };
}

/** Composed icons that approximate the mockup (handset + chat bubble / people + chat bubbles) */
function DirectionIcon({ slug }: { slug: string }) {
  if (slug === "meeting") {
    return (
      <div className="relative h-14 w-14 shrink-0">
        <Users className="absolute bottom-0 left-0 h-11 w-11 text-foreground" strokeWidth={1.6} />
        <MessagesSquare className="absolute -top-1 right-0 h-6 w-6 text-primary fill-primary/10" strokeWidth={1.8} />
      </div>
    );
  }
  return (
    <div className="relative h-14 w-14 shrink-0">
      <Phone className="absolute bottom-0 left-0 h-11 w-11 text-foreground" strokeWidth={1.6} />
      <MessageCircleMore className="absolute -top-1 right-0 h-6 w-6 text-primary fill-primary/10" strokeWidth={1.8} />
    </div>
  );
}

function DirectionCard({ direction }: { direction: NavNode }) {
  const { main, sub } = splitTitle(direction.title);

  return (
    <Card className="bg-white border-0 shadow-md rounded-3xl px-10 py-10 flex flex-col gap-7 flex-1">
      {/* Card header: icon + two-line title */}
      <div className="flex items-center gap-4">
        <DirectionIcon slug={direction.slug} />
        <div className="leading-tight">
          <span className="block text-[1.75rem] font-extrabold uppercase tracking-wide text-primary leading-none">
            {main}
          </span>
          {sub && (
            <span className="block mt-1 text-xl font-medium text-foreground/80">
              {sub}
            </span>
          )}
        </div>
      </div>

      {/* Section pill buttons */}
      <div className="flex flex-col gap-4">
        {direction.children?.map((section) => (
          <Link
            key={section.id}
            href={`/${direction.slug}/${section.slug}`}
            className="nav-button flex items-center justify-center px-5 py-4 rounded-xl text-[1.0625rem] font-medium text-center text-foreground hover:text-white"
          >
            {section.title}
          </Link>
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
      style={{
        background:
          "linear-gradient(180deg, #eef3f8 0%, #F0F5FA 60%, #e7eef4 100%)",
      }}
    >
      {/* Dark header band with floating rounded title bar */}
      <div className="w-full bg-gradient-to-b from-[#49575f] to-[#5a6772] px-4 py-4 md:px-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-[#c9d6e0]/90 px-8 py-5 shadow-inner">
          <h1 className="text-[2.25rem] md:text-[2.5rem] font-bold text-[#52626F] text-center tracking-wide leading-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Cards — centered, filling the space */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
          {directions.map((direction) => (
            <DirectionCard key={direction.id} direction={direction} />
          ))}
        </div>
      </main>

      {/* Footer: EasyCredit logo (left), credit centered, robot is the global floating button */}
      <footer className="grid grid-cols-3 items-center px-8 py-5">
        <div className="flex justify-start">
          <Image
            src={theme.logoRed}
            alt={theme.name}
            width={190}
            height={54}
            className="object-contain"
            priority
          />
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-foreground/45">
          <span>Осъществено от</span>
          {theme.partnerLogo && (
            <Image
              src={theme.partnerLogo}
              alt={theme.partnerName ?? "Partner"}
              width={91}
              height={16}
              className="object-contain opacity-70"
            />
          )}
        </div>
        <div aria-hidden />
      </footer>
    </div>
  );
}
