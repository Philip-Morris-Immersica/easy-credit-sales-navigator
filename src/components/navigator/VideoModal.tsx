"use client";

import * as React from "react";
import { Video, X, Maximize, Minimize } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VideoModalProps {
  videoUrl: string;
  label?: string;
}

/** Build the Google Drive preview embed URL from any share/view/preview link */
function toEmbedUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/?]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  if (!url.includes("/")) return `https://drive.google.com/file/d/${url}/preview`;
  return url;
}

export function VideoModal({ videoUrl, label = "Видео" }: VideoModalProps) {
  const [open, setOpen] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const embedUrl = toEmbedUrl(videoUrl);

  // Sync our state with browser fullscreen changes (e.g. user presses Escape)
  React.useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        try { screen.orientation.unlock(); } catch { /* not supported */ }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen({ navigationUI: "hide" });
      try { await (screen.orientation as unknown as { lock: (o: string) => Promise<void> }).lock("landscape"); } catch { /* iOS doesn't support */ }
    } catch (e) {
      console.warn("Fullscreen not available", e);
    }
  };

  const exitFullscreen = async () => {
    try { screen.orientation.unlock(); } catch { /* ignore */ }
    if (document.fullscreenElement) await document.exitFullscreen();
  };

  const toggleFullscreen = () =>
    document.fullscreenElement ? exitFullscreen() : enterFullscreen();

  const handleClose = async () => {
    await exitFullscreen();
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Video className="h-4 w-4 text-primary" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 overflow-hidden border-0 bg-black w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none sm:w-[96vw] sm:max-w-[96vw] sm:h-[92vh] sm:max-h-[92vh] sm:rounded-2xl"
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>

          {/* Wrapper that goes fullscreen on demand */}
          <div
            ref={containerRef}
            className="relative flex h-full w-full flex-col bg-black"
          >
            {/* Top control bar — also masks Google's Вход / Изтегляне buttons */}
            <div className="absolute top-0 inset-x-0 h-12 bg-black z-40 flex items-center justify-between px-4">
              <div className="flex items-center gap-2 min-w-0">
                <Video className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-white/80 truncate">{label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Изход от цял екран" : "Цял екран"}
                  className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"
                >
                  {isFullscreen
                    ? <Minimize className="h-4 w-4 text-white" />
                    : <Maximize className="h-4 w-4 text-white" />
                  }
                </button>
                <button
                  onClick={handleClose}
                  title="Затвори"
                  className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Video fills the whole modal; Google player letterboxes itself */}
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={label}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
