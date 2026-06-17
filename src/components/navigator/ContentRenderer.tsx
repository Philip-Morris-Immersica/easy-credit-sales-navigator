"use client";

import { cn } from "@/lib/utils";
import type { ContentBlock, CollapsibleBlock } from "@/components/navigator/types";
import { BlockInteractive, CollapsibleGroupRenderer } from "@/components/navigator/BlockInteractive";
import { DuotoneIcon } from "@/components/navigator/DuotoneIcon";
import {
  Target, Wrench, MessageSquare, AlertCircle, ChevronRight,
  GitBranch, ShieldCheck, Ban, List, MessageCircle, Info,
  Compass, BookOpen, Layers, ArrowRight, Lock, Unlock,
  Eye, EyeOff, Lightbulb, ClipboardList, ArrowRightLeft,
  DoorOpen, Search, FileText, CheckCircle,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

function getHeadingIcon(text: string): LucideIcon {
  const t = text.toLowerCase();
  // ── Meeting / call stage headings — match the step icons from /meeting/steps ──
  if (t.includes("начало") || t.includes("отваряне") || t.includes("разчупване")) return DoorOpen;
  if (t.includes("проучване") || t.includes("идентифициране") || t.includes("определяне на нужди")) return Search;
  if (t.includes("определяне") && t.includes("сума")) return Search;
  if (t.includes("финализиране") || t.includes("обобщение") || t.includes("приключване")) return CheckCircle;
  if (t.includes("затваряне") && !t.includes("затворени")) return CheckCircle;
  if (t.includes("събиране на документи")) return ClipboardList;
  // возражения must be checked before предложение to handle "Предложение, Възражение и отговор"
  if (t.includes("възражени") || t.includes("справяне")) return ShieldCheck;
  if (t.includes("представяне") || t.includes("предложение")) return FileText;
  // ── Generic content headings ─────────────────────────────────────────────────
  if (t.includes("неосъзнати")) return EyeOff;
  if (t.includes("осъзнати")) return Eye;
  if (t.includes("затворени")) return Lock;
  if (t.includes("отворени")) return Unlock;
  if (t.includes("логика")) return GitBranch;
  if (t.includes("обща")) return GitBranch;
  if (t.includes("да не правиш") || t.includes("не правиш")) return Ban;
  if (t.includes("техники")) return Wrench;
  if (t.includes("послания") || t.includes("ключови")) return MessageSquare;
  if (t.includes("комуникация")) return MessageCircle;
  if (t.includes("характеристики")) return List;
  if (t.includes("характеристика срещу") || t.includes("срещу полза")) return ArrowRightLeft;
  if (t.includes("структура")) return Layers;
  if (t.includes("елементи")) return Layers;
  if (t.includes("цел") && (t.includes("представяне") || t.includes("как"))) return Target;
  if (t.includes("включва")) return ClipboardList;
  if (t.includes("примери")) return BookOpen;
  if (t.includes("чеклист")) return ClipboardList;
  if (t.includes("съвети")) return Lightbulb;
  if (t.includes("стратеги")) return Compass;
  if (t.includes("стъпки")) return ArrowRight;
  if (t.includes("описание")) return Info;
  if (t.includes("подход")) return Compass;
  if (t.includes("важно")) return AlertCircle;
  if (t.includes("сценари")) return BookOpen;
  return ChevronRight;
}

interface ContentRendererProps {
  blocks: ContentBlock[];
  title: string;
  icon?: string;
  iconAccent?: string;
  iconImage?: string;
  hideTitle?: boolean;
}

export function ContentRenderer({ blocks, title, icon, iconAccent, iconImage, hideTitle }: ContentRendererProps) {
  return (
    <div className="max-w-3xl space-y-5">
      {/* Page title — only shown when not suppressed by ScreenHeader */}
      {!hideTitle && (
        <div className="flex items-center gap-3 pb-1">
          {(icon || iconImage) && <DuotoneIcon name={icon} accent={iconAccent} src={iconImage} className="h-9 w-9" />}
          <h1 className="t-heading font-bold text-[#52626F]">
            {title}
          </h1>
        </div>
      )}

      {renderBlocks(blocks)}
    </div>
  );
}

/** Renders an array of ContentBlocks — called recursively by container blocks.
 *  Consecutive collapsible blocks at the same level are grouped into a
 *  radio-style accordion (opening one closes the others). */
export function renderBlocks(blocks: ContentBlock[]): React.ReactNode {
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].type === "collapsible") {
      const groupStart = i;
      const group: CollapsibleBlock[] = [];
      while (i < blocks.length && blocks[i].type === "collapsible") {
        group.push(blocks[i] as CollapsibleBlock);
        i++;
      }
      result.push(
        <CollapsibleGroupRenderer key={groupStart} blocks={group} render={renderBlocks} />
      );
    } else {
      result.push(<Block key={i} block={blocks[i]} />);
      i++;
    }
  }
  return result;
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    // ── Leaf blocks ────────────────────────────────────────────────────────

    case "goal":
      return (
        <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="t-body text-foreground/80">
            <span className="font-bold text-foreground">Цел: </span>
            {block.text}
          </p>
        </div>
      );

    case "heading": {
      const HeadingIcon = getHeadingIcon(block.text);
      return (
        <h2 className="flex items-center gap-2 t-subheading font-bold text-foreground/90 pt-1">
          <HeadingIcon className="h-[1.375em] w-[1.375em] shrink-0 text-primary self-center" strokeWidth={2.3} />
          {block.text}
        </h2>
      );
    }

    case "subheading": {
      const SubIcon = getHeadingIcon(block.text);
      return (
        <h3 className="flex items-center gap-2 t-body font-bold text-foreground/90">
          <SubIcon className="h-[1.375em] w-[1.375em] shrink-0 text-primary self-center" strokeWidth={2.3} />
          {block.text}
        </h3>
      );
    }

    case "paragraph":
      return <p className="t-body text-foreground/80">{block.text}</p>;

    case "bullets":
    case "checklist":
      return (
        <ul className={cn("space-y-2.5", block.type === "checklist" && "list-none")}>
          {block.items?.map((item, i) => {
            const isNumbered = /^\d+[.)]\s/.test(item);
            return (
              <li key={i} className="flex items-start gap-2.5 t-body text-foreground/80">
                {block.type === "checklist" ? (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card text-xs text-foreground/40">
                    ✓
                  </span>
                ) : !isNumbered ? (
                  <span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#49575f" }} />
                ) : null}
                <span>{item}</span>
              </li>
            );
          })}
        </ul>
      );

    case "numbered":
      return (
        <ol className="space-y-3">
          {block.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="mt-[0.15rem] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dae5ed] text-[0.8rem] font-bold text-[#52626f]" style={{boxShadow: "2px 3px 6px rgba(90,122,150,0.35), -1px -1px 4px rgba(255,255,255,0.9)"}}>
                {i + 1}
              </span>
              <span className="t-body text-foreground/80 pt-[0.15rem]">{item}</span>
            </li>
          ))}
        </ol>
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
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="t-body text-foreground/70 italic">{block.text}</p>
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
          <div className="space-y-2 pl-1">
            {block.lines.map((line, i) => {
              const colon = line.indexOf(":");
              if (colon > 0 && colon < 25) {
                const speaker = line.slice(0, colon);
                const text = line.slice(colon + 1).trimStart();
                return (
                  <p key={i} className="t-body text-foreground/80 leading-relaxed">
                    <span className="font-bold text-foreground">{speaker}:</span>{" "}
                    {text}
                  </p>
                );
              }
              return (
                <p key={i} className="t-body text-foreground/80 leading-relaxed">
                  {line}
                </p>
              );
            })}
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
