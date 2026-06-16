"use client";

import Image from "next/image";

export function RobiButton() {
  return (
    <button
      aria-label="Роби — асистент"
      title="Роби — асистент"
      className="fixed bottom-5 right-5 z-50 h-16 w-16 rounded-full overflow-hidden ring-[3px] ring-white shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)] hover:scale-105 transition-all duration-200"
      onClick={() => {
        /* чатбот — Фаза 4 */
      }}
    >
      <Image
        src="/robi.jpg"
        alt="Роби"
        width={64}
        height={64}
        className="object-cover w-full h-full"
      />
    </button>
  );
}
