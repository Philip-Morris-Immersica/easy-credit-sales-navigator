"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface Props {
  /** Адрес на маршрута, който връща .xlsx (`/api/me/export` или `/api/admin/users/<id>/export`). */
  href: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  className?: string;
}

/** Взима име на файла от Content-Disposition (предпочита filename*). */
function fileNameFrom(header: string | null): string {
  if (header) {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (star) {
      try {
        return decodeURIComponent(star[1]);
      } catch {
        /* падаме към обикновеното име */
      }
    }
    const plain = /filename="([^"]+)"/i.exec(header);
    if (plain) return plain[1];
  }
  return "Navigator_rezultati.xlsx";
}

export function ExportResultsButton({
  href,
  label = "Изтегли резултатите",
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Грешка при изтегляне.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res.headers.get("Content-Disposition"));
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Грешка при изтегляне.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant={variant} size={size} className={className} onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {label}
      </Button>
      {error && <span className="t-small text-destructive">{error}</span>}
    </span>
  );
}
