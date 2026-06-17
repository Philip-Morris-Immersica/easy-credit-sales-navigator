"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChatWindow } from "./ChatWindow";
import type { PersonaData } from "@/components/navigator/types";

interface BotInfo {
  key: string;
  title: string;
  welcomeMessage: string;
}

interface SimulationModalProps {
  bot: BotInfo;
  persona?: PersonaData;
  onClose: () => void;
}

export function SimulationModal({ bot, persona, onClose }: SimulationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col">
      <ChatWindow
        botKey={bot.key}
        botTitle={bot.title}
        welcomeMessage={bot.welcomeMessage}
        kind="simulation"
        persona={persona}
        onClose={onClose}
        className="h-full rounded-none"
      />
    </div>,
    document.body
  );
}
