import Link from "next/link";
import {
  Phone,
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
  PhoneCall,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { NavNode } from "@/components/navigator/types";

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

function NodeIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name ? iconMap[name] : null;
  if (!Icon) return <span className={className} />;
  return <Icon className={className} />;
}

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
        {children.map((child) => {
          const href = `${parentSlugPath}/${child.slug}`;
          return (
            <Link key={child.id} href={href}>
              <Card className="group h-full bg-card border border-border/60 rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary transition-colors">
                    <NodeIcon
                      name={child.icon}
                      className="h-6 w-6 text-primary group-hover:text-white transition-colors"
                    />
                  </div>
                  <h3 className="t-subheading font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                    {child.title}
                  </h3>
                </div>
                {child.cardDescription && (
                  <p className="t-body text-foreground/55">
                    {child.cardDescription}
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
