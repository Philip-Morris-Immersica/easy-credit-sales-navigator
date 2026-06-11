"use client";

import * as React from "react";
import { ChevronDown, Video, Dumbbell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ContentBlock,
  TabsBlock,
  CollapsibleBlock,
  ActionsBlock,
} from "@/components/navigator/types";

// Forward ref for recursive rendering — assigned externally via prop
type RenderFn = (blocks: ContentBlock[]) => React.ReactNode;

// ─── TabsRenderer ─────────────────────────────────────────────────────────

function TabsRenderer({ block, render }: { block: TabsBlock; render: RenderFn }) {
  const [openTab, setOpenTab] = React.useState<string>(block.tabs[0]?.label ?? "");

  return (
    <>
      {/* Desktop: shadcn Tabs */}
      <div className="hidden sm:block">
        <Tabs defaultValue={block.tabs[0]?.label}>
          <TabsList className="mb-4">
            {block.tabs.map((tab) => (
              <TabsTrigger key={tab.label} value={tab.label}>
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
}: {
  block: CollapsibleBlock;
  render: RenderFn;
}) {
  const [open, setOpen] = React.useState(false);

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
            "h-4 w-4 shrink-0 transition-transform text-foreground/50",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 rounded-b-xl border border-t-0 border-border px-4 pt-4 pb-4">
        {render(block.blocks)}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── ActionsRenderer ─────────────────────────────────────────────────────

function ActionsRenderer({ block }: { block: ActionsBlock }) {
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      {block.trainDisabled && (
        <Button
          variant="outline"
          disabled
          className="flex items-center gap-2 opacity-60 cursor-not-allowed"
        >
          <Dumbbell className="h-4 w-4" />
          Тренирай
          <span className="ml-1 text-xs font-normal text-foreground/40">
            (очаквайте скоро)
          </span>
        </Button>
      )}
      {"videoUrl" in block &&
        (block.videoUrl ? (
          <a
            href={block.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 h-8",
              "text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
            )}
          >
            <Video className="h-4 w-4 text-primary" />
            Видео
          </a>
        ) : (
          <Button
            variant="outline"
            disabled
            className="flex items-center gap-2 opacity-60 cursor-not-allowed"
          >
            <Video className="h-4 w-4" />
            Видео
            <span className="ml-1 text-xs font-normal text-foreground/40">
              (очаквайте скоро)
            </span>
          </Button>
        ))}
    </div>
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
