import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/components/navigator/types";
import {
  Info,
  Lightbulb,
  Wrench,
  Phone,
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
    <div className="max-w-2xl space-y-5">
      {/* Page title */}
      <div className="flex items-center gap-3 pb-2">
        {Icon && <Icon className="h-8 w-8 shrink-0 text-primary" />}
        <h1 className="t-heading font-bold text-foreground">{title}</h1>
      </div>

      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "goal":
      return (
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <p className="t-body font-medium text-foreground">
            <span className="font-semibold text-primary">Цел: </span>
            {block.text}
          </p>
        </div>
      );

    case "heading":
      return (
        <h2 className="t-subheading font-semibold text-foreground border-b border-border pb-1">
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

    default:
      return null;
  }
}
