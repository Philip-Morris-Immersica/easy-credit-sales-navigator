"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { NavNode } from "@/components/navigator/types";
import { renderBlocks } from "@/components/navigator/ContentRenderer";
import { DuotoneIcon } from "@/components/navigator/DuotoneIcon";

interface Props {
  node: NavNode;
  parentSlugPath: string;
}

export function PreparationAccordion({ node, parentSlugPath }: Props) {
  const accordionChildren = (node.children ?? []).filter(
    (c) => c.renderAs !== "button"
  );
  const buttonChildren = (node.children ?? []).filter(
    (c) => c.renderAs === "button"
  );

  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <div className="max-w-2xl space-y-5">
      {/* Page title — sticky */}
      <div className="sticky top-0 z-10 bg-background pt-14 md:pt-4 pb-3">
        <h1 className="t-heading font-bold text-foreground">{node.title}</h1>
      </div>

      {/* Goal / intro from node.content */}
      {node.content && node.content.length > 0 && (
        <div>{renderBlocks(node.content)}</div>
      )}

      {/* Accordion items */}
      {accordionChildren.length > 0 && (
        <div className="space-y-3">
          {/* Section header */}
          <h2 className="t-subheading font-bold text-foreground/70 pb-1">Видове контакти</h2>

          {accordionChildren.map((child) => {
            const isOpen = openId === child.id;

            return (
              <Collapsible
                key={child.id}
                open={isOpen}
                onOpenChange={(v) => setOpenId(v ? child.id : null)}
              >
                <CollapsibleTrigger
                  className={cn(
                    "neu-card flex w-full items-center gap-4 rounded-2xl px-5 text-left min-h-[5rem]",
                    isOpen && "neu-card-pressed"
                  )}
                >
                  {/* Icon */}
                  <DuotoneIcon name={child.icon} accent={child.iconAccent} src={child.iconImage} className="h-12 w-12 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "t-subheading font-semibold leading-snug transition-colors",
                        isOpen ? "text-primary" : "text-foreground"
                      )}
                    >
                      {child.title}
                    </p>
                    {child.cardDescription && (
                      <p className="t-body text-foreground/55 mt-0.5 leading-snug">
                        {child.cardDescription}
                      </p>
                    )}
                  </div>

                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform duration-200",
                      isOpen ? "rotate-180 text-foreground/40" : "text-primary"
                    )}
                  />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mx-1 space-y-4 rounded-b-2xl border border-t-0 border-primary/20 bg-primary/[0.03] px-5 pt-4 pb-5">
                    {child.content ? renderBlocks(child.content) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Footer button children (e.g. Съвети при подготовка) — card-style, prominent */}
      {buttonChildren.length > 0 && (
        <div className="flex flex-col gap-3 pt-1">
          {buttonChildren.map((child) => {
            const href = `${parentSlugPath}/${child.slug}`;
            return (
              <Link
                key={child.id}
                href={href}
                className="neu-card neu-card-accent flex items-center gap-4 min-h-[5rem] rounded-2xl px-5"
              >
                {child.icon || child.iconImage ? (
                  <DuotoneIcon name={child.icon} accent={child.iconAccent} src={child.iconImage} className="h-12 w-12 shrink-0" />
                ) : (
                  <Lightbulb className="h-10 w-10 shrink-0 text-foreground/70" />
                )}
                <span className="t-subheading font-bold text-foreground">{child.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
