import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DuotoneIcon } from "@/components/navigator/DuotoneIcon";

interface ScreenHeaderProps {
  title: string;
  icon?: string;
  iconAccent?: string;
  iconImage?: string;
  backHref: string;
  className?: string;
}

export function ScreenHeader({ title, icon, iconAccent, iconImage, backHref, className }: ScreenHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      {/* Icon + title */}
      <div className="flex items-center gap-4">
        {(icon || iconImage) && (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <DuotoneIcon name={icon} accent={iconAccent} src={iconImage} className="h-8 w-8" />
          </div>
        )}
        <h1 className="t-heading font-bold text-foreground leading-tight">{title}</h1>
      </div>

      {/* X / back button */}
      <Link
        href={backHref}
        aria-label="Назад"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground/50 hover:bg-primary hover:text-white hover:border-primary transition-all"
      >
        <X className="h-5 w-5" />
      </Link>
    </div>
  );
}
