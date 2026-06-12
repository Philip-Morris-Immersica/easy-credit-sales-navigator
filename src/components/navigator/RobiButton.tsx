"use client";

import Image from "next/image";

export function RobiButton() {
  return (
    <button
      aria-label="Роби — асистент"
      title="Роби — асистент"
      className="fixed bottom-5 right-5 z-50 h-16 w-16 rounded-full bg-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 overflow-hidden border-2 border-white"
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
