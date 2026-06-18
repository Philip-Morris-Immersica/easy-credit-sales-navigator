"use client";

import { useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { createPortal } from "react-dom";
import { getBotAvatar } from "@/lib/bot-avatars";

const ROBI_BOT_KEY = "consultant";
const ROBI_TITLE = "Роби — Консултант";
const ROBI_WELCOME =
  "Здравей! Аз съм Роби. С какво мога да помогна днес — имаш въпрос от курса, искаш да обсъдим симулация, или нещо друго?";

export function RobiButton() {
  const [open, setOpen] = useState(false);
  const { status } = useSession();
  const router = useRouter();
  const robiAvatar = getBotAvatar(ROBI_BOT_KEY) ?? "/robi.jpg";

  function handleClick() {
    // Chat requires a session — send anonymous visitors to login first.
    if (status !== "authenticated") {
      router.push("/login?callbackUrl=/");
      return;
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        aria-label="Роби — асистент"
        title="Роби — асистент"
        className={`fixed bottom-5 right-5 z-50 h-16 w-16 rounded-full overflow-hidden ring-[3px] ring-white shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)] hover:scale-105 transition-all duration-200 ${open ? "hidden" : ""}`}
        onClick={handleClick}
      >
        <Image
          src={robiAvatar}
          alt="Роби"
          width={64}
          height={64}
          className="object-cover w-full h-full"
        />
      </button>

      {open &&
        typeof window !== "undefined" &&
        createPortal(
          <>
            {/* Transparent backdrop — click outside to close */}
            <div
              className="fixed inset-0 z-[99]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            {/* Chat window — clamped to viewport with top + bottom anchors */}
            <div className="fixed top-4 bottom-5 right-5 z-[100] w-[768px] max-w-[calc(100vw-2.5rem)] flex flex-col rounded-2xl overflow-hidden shadow-2xl">
              <ChatWindow
                botKey={ROBI_BOT_KEY}
                botTitle={ROBI_TITLE}
                welcomeMessage={ROBI_WELCOME}
                kind="consultant"
                onClose={() => setOpen(false)}
                className="h-full"
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
