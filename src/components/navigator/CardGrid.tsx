import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DuotoneIcon } from "@/components/navigator/DuotoneIcon";
import type { NavNode } from "@/components/navigator/types";

interface CardGridProps {
  node: NavNode;
  parentSlugPath: string;
}

export function CardGrid({ node, parentSlugPath }: CardGridProps) {
  const children = node.children ?? [];
  return (
    <div className="space-y-5">
      <h1 className="t-heading font-bold text-foreground">{node.title}</h1>
      {node.content && node.content.length > 0 && (
        <p className="t-body text-foreground/60 max-w-xl">
          {node.content.find((b) => b.type === "goal")?.text}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {children.map((child) => {
          const href = `${parentSlugPath}/${child.slug}`;
          return (
            <Link key={child.id} href={href} className="flex">
              <Card className="group w-full min-h-[7rem] bg-card border border-border/60 rounded-2xl px-6 flex flex-row items-center gap-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                <DuotoneIcon
                  name={child.icon}
                  accent={child.iconAccent}
                  src={child.iconImage}
                  className="h-12 w-12 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="t-subheading font-bold text-foreground leading-snug group-hover:text-primary transition-colors truncate">
                    {child.title}
                  </h3>
                  {child.cardDescription && (
                    <p className="t-body text-foreground/55 mt-0.5 leading-snug line-clamp-1">
                      {child.cardDescription}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
