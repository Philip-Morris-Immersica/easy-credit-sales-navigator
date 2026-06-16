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

// ─── ActionsRenderer ─────────────────────────────────────────────────────

function ActionsRenderer({ block }: { block: ActionsBlock }) {
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      {block.trainDisabled && (
        <Button
          variant="default"
          disabled
          className="flex items-center gap-2 bg-primary/90 text-white cursor-not-allowed opacity-80 hover:bg-primary/90"
        >
          <Dumbbell className="h-4 w-4" />
          Тренирай
        </Button>
      )}
      {"videoUrl" in block &&
        (block.videoUrl ? (
          <a
            href={block.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
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
