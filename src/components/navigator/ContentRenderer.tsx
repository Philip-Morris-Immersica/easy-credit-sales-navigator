"use client";

import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/components/navigator/types";
import { BlockInteractive } from "@/components/navigator/BlockInteractive";
import {
  Info,
  Lightbulb,
  Wrench,
  Users,
  ClipboardList,
  ListOrdered,
  Drama,
  UserX,
  UserCheck,
  RefreshCw,
  DoorOpen,
  Target,
  ShieldCheck,
  CheckCircle,
  Heart,
  BadgeCheck,
  Megaphone,
  Armchair,
  Share2,
  Flame,
  BarChart2,
  HelpCircle,
  Ban,
  Crown,
  Shuffle,
  Eye,
  GitBranch,
  Zap,
  MessageCircle,
  ArrowRightLeft,
  Rocket,
  Reply,
  Search,
  FileText,
  Building,
  PlusCircle,
  Home,
  PhoneCall,
  MessageSquare,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone: PhoneCall,
  PhoneCall,
  Users,
  ClipboardList,
  ListOrdered,
  Drama,
  Lightbulb,
  UserX,
  UserCheck,
  RefreshCw,
  DoorOpen,
  Target,
  ShieldCheck,
  CheckCircle,
  Heart,
  BadgeCheck,
  Megaphone,
  Armchair,
  Share2,
  Flame,
  BarChart2,
  HelpCircle,
  Ban,
  Crown,
  Shuffle,
  Eye,
  GitBranch,
  Zap,
  MessageCircle,
  ArrowRightLeft,
  Rocket,
  Reply,
  Search,
  FileText,
  Building,
  PlusCircle,
  Home,
};

interface ContentRendererProps {
  blocks: ContentBlock[];
  title: string;
  icon?: string;
}

export function ContentRenderer({ blocks, title, icon }: ContentRendererProps) {
  const Icon = icon ? iconMap[icon] : null;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Page title — icon + heading */}
      <div className="flex items-center gap-3 pb-1">
        {Icon && <Icon className="h-9 w-9 shrink-0 text-primary" />}
        <h1 className="t-heading font-bold text-[#52626F]">
          {title}
        </h1>
      </div>

      {renderBlocks(blocks)}
    </div>
  );
}

/** Renders an array of ContentBlocks — called recursively by container blocks */
export function renderBlocks(blocks: ContentBlock[]): React.ReactNode {
  return blocks.map((block, i) => <Block key={i} block={block} />);
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    // ── Leaf blocks ────────────────────────────────────────────────────────

    case "goal":
      return (
        <p className="t-body text-foreground/80">
          <span className="font-bold text-foreground">Цел: </span>
          {block.text}
        </p>
      );

    case "heading":
      return (
        <h2 className="t-subheading font-medium text-foreground/90 pt-1">
          {block.text}
        </h2>
      );

    case "subheading":
      return (
        <h3 className="t-body font-semibold text-foreground/80">{block.text}</h3>
      );

    case "paragraph":
      return <p className="t-body text-foreground/80">{block.text}</p>;

    case "bullets":
    case "checklist":
      return (
        <ul className={cn("space-y-2.5", block.type === "checklist" && "list-none")}>
          {block.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 t-body text-foreground/80">
              {block.type === "checklist" ? (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card text-xs text-foreground/40">
                  ✓
                </span>
              ) : (
                <span className="mt-[0.5rem] h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "techniques":
      return (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 t-body font-semibold text-foreground">
            <Wrench className="h-5 w-5 text-primary shrink-0" />
            <span>{block.text ?? "Техники"}</span>
          </div>
          <ul className="space-y-1.5 pl-6">
            {block.items?.map((item, i) => (
              <li key={i} className="t-body text-foreground/80 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "note":
      return (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-foreground/40" />
          <p className="t-body text-foreground/60 italic">{block.text}</p>
        </div>
      );

    case "fields":
      return (
        <dl className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {block.rows.map(({ label, value }, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 px-4 py-2.5">
              <dt className="t-body font-semibold text-foreground/60 shrink-0 sm:w-44">{label}</dt>
              <dd className="t-body text-foreground/85">{value}</dd>
            </div>
          ))}
        </dl>
      );

    case "dialogue":
      return (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          {block.label && (
            <div className="flex items-center gap-2 t-body font-semibold text-foreground/70 pb-1">
              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
              {block.label}
            </div>
          )}
          <div className="space-y-1.5 pl-1">
            {block.lines.map((line, i) => (
              <p key={i} className="t-body text-foreground/80 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      );

    // ── Container / interactive blocks — delegated to client component ──────

    case "collapsible":
    case "tabs":
    case "actions":
      return <BlockInteractive block={block} renderBlocksFn={renderBlocks} />;

    default:
      return null;
  }
}
