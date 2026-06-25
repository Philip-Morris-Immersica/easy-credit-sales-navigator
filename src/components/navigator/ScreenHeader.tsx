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
    <div className={cn("sticky top-0 z-10 bg-background pt-[4.75rem] md:pt-4 flex items-start justify-between gap-4 pb-6", className)}>
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DAE5ED] text-[#52626F] shadow-[3px_4px_6px_0px_rgba(90,122,150,0.35),-3px_0px_11px_-2px_rgba(255,255,255,0.85)] hover:bg-primary hover:text-white transition-all"
      >
        <X className="h-4 w-4" />
      </Link>
    </div>
  );
}
