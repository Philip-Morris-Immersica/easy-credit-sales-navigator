import Link from "next/link";
import { DuotoneIcon } from "@/components/navigator/DuotoneIcon";
import type { NavNode } from "@/components/navigator/types";

interface StageListProps {
  node: NavNode;
  parentSlugPath: string;
}

export function StageList({ node, parentSlugPath }: StageListProps) {
  const stages = node.children ?? [];

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="t-heading font-bold text-foreground">{node.title}</h1>

      <div className="flex flex-col gap-3">
        {stages.map((stage, idx) => {
          const href = `${parentSlugPath}/${stage.slug}`;
          const stageNum = idx + 1;

          return (
            <Link key={stage.id} href={href}>
              <div className="flex flex-row items-center gap-5 rounded-2xl border border-border/60 bg-white px-5 py-6 shadow-sm hover:border-primary/30 hover:shadow-md transition-all">
                {/* Icon */}
                <DuotoneIcon
                  name={stage.icon}
                  accent={stage.iconAccent}
                  src={stage.iconImage}
                  className="h-11 w-11 shrink-0"
                />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="t-subheading font-semibold leading-snug">
                    <span className="text-primary">Етап {stageNum}: </span><span className="text-foreground">{stage.title}</span>
                  </p>
                  {stage.cardDescription && (
                    <p className="t-body text-foreground/55 mt-1 leading-snug">
                      {stage.cardDescription}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
