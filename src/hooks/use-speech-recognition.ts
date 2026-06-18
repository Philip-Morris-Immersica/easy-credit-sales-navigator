"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal ambient typings for the Web Speech API ──────────────────────────
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinal?: (text: string) => void;
}

export type MicPermission = "unknown" | "granted" | "denied" | "unavailable";

interface UseSpeechRecognitionReturn {
  supported: boolean;
  listening: boolean;
  interim: string;
  /** Current microphone permission state. */
  permission: MicPermission;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
}

/**
 * Wrapper around the browser Web Speech API.
 *
 * On first `start()` call, explicitly requests microphone access via
 * `getUserMedia` so the browser shows its native permission prompt. After
 * permission is granted the stream is released immediately — SpeechRecognition
 * manages its own audio capture from that point.
 *
 * Auto-restarts on natural session end (Chrome closes sessions after silence)
 * with a small delay to avoid InvalidStateError race conditions.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { lang = "bg-BG", onFinal } = options;

  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [permission, setPermission] = useState<MicPermission>("unknown");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinal);
  const wantListeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Check existing permission state on mount (no prompt triggered).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (status.state === "granted") setPermission("granted");
        else if (status.state === "denied") setPermission("denied");
        status.onchange = () => {
          if (status.state === "granted") setPermission("granted");
          else if (status.state === "denied") setPermission("denied");
          else setPermission("unknown");
        };
      })
      .catch(() => {/* permissions API unavailable — will check on first start() */});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) onFinalRef.current?.(finalText);
      setInterim(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setPermission("denied");
        setListening(false);
      }
      // "no-speech" and "aborted" are benign — onend will handle restart.
      setInterim("");
    };

    recognition.onend = () => {
      setInterim("");
      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }
      // Delay restart slightly to avoid InvalidStateError when Chrome tears
      // down the session while we're trying to start a new one.
      restartTimerRef.current = setTimeout(() => {
        if (!wantListeningRef.current) return;
        try {
          recognition.start();
        } catch {
          wantListeningRef.current = false;
          setListening(false);
        }
      }, 200);
    };

    recognitionRef.current = recognition;

    return () => {
      wantListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(async () => {
    if (!supported) return;
    if (wantListeningRef.current) return; // already running

    // ── Ask for microphone permission explicitly ─────────────────────────────
    // Only call getUserMedia when we haven't confirmed permission yet. This
    // triggers the browser's native permission dialog. We immediately release
    // the stream — SpeechRecognition manages its own audio session.
    if (permission !== "granted") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setPermission("granted");
      } catch (err) {
        // Only treat explicit user/policy denial as "denied".
        // NotReadableError, AbortError, etc. mean the device is busy or
        // unavailable — still attempt SpeechRecognition (it may succeed).
        const name = (err as { name?: string }).name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setPermission("denied");
          return;
        }
        // For other errors, optimistically continue — let SpeechRecognition
        // report its own error if the mic is truly inaccessible.
      }
    }

    const recognition = recognitionRef.current;
    if (!recognition) return;

    wantListeningRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      wantListeningRef.current = false;
      setListening(false);
    }
  }, [supported, permission]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    setListening(false);
    setInterim("");
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(async () => {
    if (wantListeningRef.current) stop();
    else await start();
  }, [start, stop]);

  return { supported, listening, interim, permission, start, stop, toggle };
}
