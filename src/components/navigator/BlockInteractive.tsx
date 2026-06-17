"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Video, Dumbbell, X, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VideoModal } from "@/components/navigator/VideoModal";
import { SimulationModal } from "@/components/chat/SimulationModal";
import type {
  ContentBlock,
  TabsBlock,
  CollapsibleBlock,
  ActionsBlock,
  PersonaData,
} from "@/components/navigator/types";

// Forward ref for recursive rendering — assigned externally via prop
type RenderFn = (blocks: ContentBlock[]) => React.ReactNode;

// ─── TabsRenderer ─────────────────────────────────────────────────────────

function TabsRenderer({ block, render }: { block: TabsBlock; render: RenderFn }) {
  const [openTab, setOpenTab] = React.useState<string>(block.tabs[0]?.label ?? "");

  return (
    <>
      {/* Desktop: visible pill/segment tab bar */}
      <div className="hidden sm:block">
        <Tabs defaultValue={block.tabs[0]?.label}>
          <TabsList className="mb-5 flex h-auto w-full flex-wrap gap-1 rounded-2xl bg-muted/60 p-1.5 border border-border/60">
            {block.tabs.map((tab) => (
              <TabsTrigger
                key={tab.label}
                value={tab.label}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-foreground/60 transition-all data-active:bg-primary data-active:text-white data-active:shadow-sm hover:text-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {block.tabs.map((tab) => (
            <TabsContent key={tab.label} value={tab.label} className="space-y-4">
              {render(tab.blocks)}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Mobile: accordion-style collapsibles */}
      <div className="sm:hidden space-y-2">
        {block.tabs.map((tab) => (
          <Collapsible
            key={tab.label}
            open={openTab === tab.label}
            onOpenChange={(isOpen: boolean) =>
              setOpenTab(isOpen ? tab.label : "")
            }
          >
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left",
                "t-body font-semibold text-foreground transition-colors",
                openTab === tab.label
                  ? "bg-primary text-white border-primary"
                  : "bg-card hover:border-primary/40"
              )}
            >
              {tab.label}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  openTab === tab.label
                    ? "rotate-180 text-white"
                    : "text-foreground/50"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 px-1 pt-3 pb-1">
              {render(tab.blocks)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </>
  );
}

// ─── CollapsibleRenderer ─────────────────────────────────────────────────

function CollapsibleRenderer({
  block,
  render,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  block: CollapsibleBlock;
  render: RenderFn;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (externalOnOpenChange ?? (() => {})) : setInternalOpen;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left",
          "t-body font-semibold text-foreground bg-card transition-colors hover:border-primary/40"
        )}
      >
        {block.label}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open ? "rotate-180 text-foreground/40" : "text-primary"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 rounded-b-xl border border-t-0 border-border px-4 pt-4 pb-4">
        {render(block.blocks)}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── CollapsibleGroupRenderer ─────────────────────────────────────────────
// Renders multiple sibling collapsibles as a radio-style accordion —
// opening one automatically closes the others at the same level.

export function CollapsibleGroupRenderer({
  blocks,
  render,
}: {
  blocks: CollapsibleBlock[];
  render: RenderFn;
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <CollapsibleRenderer
          key={i}
          block={block}
          render={render}
          open={openIndex === i}
          onOpenChange={(isOpen) => setOpenIndex(isOpen ? i : null)}
        />
      ))}
    </div>
  );
}

// ─── PersonaPreviewModal ─────────────────────────────────────────────────

function PersonaPreviewModal({
  persona,
  onTrain,
  onClose,
}: {
  persona: PersonaData;
  onTrain: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  const metaRows: [string, string][] = [
    ["Тип контакт", persona.contactType],
    ["Персонаж", persona.name],
    ["Профил", persona.profile],
    ["Контекст", persona.context],
    ["Цел", persona.goal],
    ["Логика на разговора", persona.conversationLogic],
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-primary text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 shrink-0" />
            <span className="font-semibold text-sm">Примерен персонаж за тренировка</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors ml-3 shrink-0"
            aria-label="Затвори"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {metaRows.map(([label, value]) => (
            <div key={label}>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-primary/80">{label}</p>
              <p className="text-sm text-foreground mt-0.5 leading-snug">{value}</p>
            </div>
          ))}

          <div>
            <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-primary/80">Примерни реплики</p>
            <ul className="mt-1 space-y-1">
              {persona.sampleReplies.map((r, i) => (
                <li key={i} className="text-sm text-foreground/80 italic leading-snug">{r}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-primary/80">Възможни възражения</p>
            <ul className="mt-1 space-y-1">
              {persona.objections.map((o, i) => (
                <li key={i} className="text-sm text-foreground/80 leading-snug">{o}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-primary/80">Подходящи техники</p>
            <p className="text-sm text-foreground mt-0.5">{persona.techniques.join(", ")}</p>
          </div>

          <div>
            <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-primary/80">Следваща стъпка / финализиране</p>
            <p className="text-sm text-foreground mt-0.5 leading-snug">{persona.nextStep}</p>
          </div>

          <div>
            <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-primary/80">Какво да не правиш</p>
            <p className="text-sm text-foreground mt-0.5 leading-snug">{persona.doNotDo}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex justify-end">
          <Button
            onClick={onTrain}
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary/80"
          >
            <Dumbbell className="h-4 w-4" />
            Тренирай
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── ActionsRenderer ─────────────────────────────────────────────────────

function ActionsRenderer({ block }: { block: ActionsBlock }) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [simOpen, setSimOpen] = React.useState(false);
  const [botInfo, setBotInfo] = React.useState<{ key: string; title: string; welcomeMessage: string } | null>(null);

  const fetchAndOpenSim = async () => {
    if (!block.botKey) return;
    try {
      const res = await fetch(`/api/bots/${block.botKey}`);
      if (res.ok) {
        const data = await res.json();
        setBotInfo(data);
        setSimOpen(true);
      } else {
        alert("Ботът не е намерен. Проверете конфигурацията.");
      }
    } catch {
      alert("Грешка при зареждане на симулацията.");
    }
  };

  const handleTrain = () => {
    if (!block.botKey) return;
    if (block.persona) {
      setPreviewOpen(true);
    } else {
      fetchAndOpenSim();
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 pt-1">
        {block.botKey ? (
          <Button
            variant="default"
            onClick={handleTrain}
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary/80"
          >
            <Dumbbell className="h-4 w-4" />
            Тренирай
          </Button>
        ) : block.trainDisabled ? (
          <Button
            variant="default"
            disabled
            className="flex items-center gap-2 bg-primary/90 text-white cursor-not-allowed opacity-80 hover:bg-primary/90"
          >
            <Dumbbell className="h-4 w-4" />
            Тренирай
          </Button>
        ) : null}

        {"videoUrl" in block &&
          (block.videoUrl ? (
            <VideoModal videoUrl={block.videoUrl} />
          ) : (
            <Button
              variant="outline"
              disabled
              className="flex items-center gap-2 opacity-60 cursor-not-allowed"
            >
              <Video className="h-4 w-4" />
              Видео
            </Button>
          ))}
      </div>

      {previewOpen && block.persona && (
        <PersonaPreviewModal
          persona={block.persona}
          onTrain={() => {
            setPreviewOpen(false);
            fetchAndOpenSim();
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {simOpen && botInfo && (
        <SimulationModal
          bot={botInfo}
          persona={block.persona}
          onClose={() => { setSimOpen(false); setBotInfo(null); }}
        />
      )}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────

interface BlockInteractiveProps {
  block: TabsBlock | CollapsibleBlock | ActionsBlock;
  renderBlocksFn: RenderFn;
}

export function BlockInteractive({ block, renderBlocksFn }: BlockInteractiveProps) {
  if (block.type === "tabs")
    return <TabsRenderer block={block} render={renderBlocksFn} />;
  if (block.type === "collapsible")
    return <CollapsibleRenderer block={block} render={renderBlocksFn} />;
  if (block.type === "actions")
    return <ActionsRenderer block={block} />;
  return null;
}
