"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  /** Reserved for API compatibility — transcription language is fixed server-side (bg). */
  lang?: string;
  onFinal?: (text: string) => void;
}

export type MicPermission = "unknown" | "granted" | "denied" | "unavailable";

interface UseSpeechRecognitionReturn {
  supported: boolean;
  listening: boolean;
  /** Live partial transcription shown while recording. */
  interim: string;
  /** True while a final transcription request is in flight after stopping. */
  processing: boolean;
  permission: MicPermission;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
}

// How often (ms) to send the audio-so-far for a live preview transcription.
const PARTIAL_INTERVAL_MS = 2500;

// Silence-based auto-stop. We monitor microphone loudness and, once the user
// has actually spoken, automatically stop recording after a short stretch of
// continuous silence — so the mic doesn't stay open forever.
const SILENCE_RMS_THRESHOLD = 0.015; // below this RMS amplitude counts as silence
const SILENCE_TIMEOUT_MS = 2500; // continuous silence before auto-stop
const SILENCE_CHECK_MS = 150; // how often to sample loudness

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

/**
 * Browser-independent voice typing.
 *
 * Records microphone audio with `MediaRecorder` and sends it to the
 * `/api/transcribe` endpoint (OpenAI speech-to-text). Unlike the Web Speech
 * API, this behaves identically across Edge, Chrome, Firefox, Safari and
 * mobile browsers and does not depend on the browser's built-in speech engine.
 *
 * While recording it periodically transcribes the audio captured so far to
 * provide a near-real-time preview (`interim`). On stop it runs one final,
 * higher-accuracy transcription and emits it via `onFinal`.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { onFinal } = options;

  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      pickMimeType() !== ""
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [processing, setProcessing] = useState(false);
  const [permission, setPermission] = useState<MicPermission>("unknown");

  const onFinalRef = useRef(onFinal);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");
  const partialTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const partialBusyRef = useRef(false);
  const stoppingRef = useRef(false);

  // Silence detection (Web Audio) for automatic stop.
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechAtRef = useRef(0);
  const speechDetectedRef = useRef(false);
  // Holds the latest `stop` implementation so the silence loop (created in
  // `start`) can call it even though `stop` is defined afterwards.
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Check existing permission state on mount (no prompt triggered).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        const sync = () => {
          if (status.state === "granted") setPermission("granted");
          else if (status.state === "denied") setPermission("denied");
          else setPermission("unknown");
        };
        sync();
        status.onchange = sync;
      })
      .catch(() => {/* permissions API unavailable — will resolve on start() */});
  }, []);

  const transcribe = useCallback(
    async (blob: Blob, final: boolean): Promise<string | null> => {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("audio", blob, `audio.${ext}`);
      form.append("model", "gpt-4o-transcribe");
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) return null;
        const data = (await res.json()) as { text?: string };
        return data.text?.trim() ?? "";
      } catch {
        return null;
      }
    },
    []
  );

  const cleanup = useCallback(() => {
    if (partialTimerRef.current) {
      clearInterval(partialTimerRef.current);
      partialTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {/* already closed */});
      audioContextRef.current = null;
    }
    speechDetectedRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    partialBusyRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (!supported || listening || stoppingRef.current) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission("granted");
    } catch (err) {
      const name = (err as { name?: string }).name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermission("denied");
      }
      return;
    }

    const mime = pickMimeType();
    mimeRef.current = mime;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeRef.current || "audio/webm",
      });
      cleanup();
      setListening(false);
      setInterim("");

      if (blob.size === 0) {
        setProcessing(false);
        return;
      }
      setProcessing(true);
      const text = await transcribe(blob, true);
      setProcessing(false);
      if (text) onFinalRef.current?.(text);
    };

    // Collect data in 1s chunks so the cumulative blob stays a valid file
    // (the first chunk carries the container header).
    recorder.start(1000);
    setInterim("");
    setProcessing(false);
    setListening(true);

    // Monitor loudness and auto-stop after a stretch of silence (once the user
    // has actually spoken). Falls back to manual stop if Web Audio is missing.
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        sourceNode.connect(analyser);
        audioContextRef.current = audioCtx;
        speechDetectedRef.current = false;
        lastSpeechAtRef.current = Date.now();

        const samples = new Uint8Array(analyser.frequencyBinCount);
        silenceTimerRef.current = setInterval(() => {
          if (stoppingRef.current || !recorderRef.current) return;
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          for (let i = 0; i < samples.length; i++) {
            const deviation = (samples[i] - 128) / 128;
            sumSquares += deviation * deviation;
          }
          const rms = Math.sqrt(sumSquares / samples.length);
          const now = Date.now();
          if (rms > SILENCE_RMS_THRESHOLD) {
            speechDetectedRef.current = true;
            lastSpeechAtRef.current = now;
          } else if (
            speechDetectedRef.current &&
            now - lastSpeechAtRef.current > SILENCE_TIMEOUT_MS
          ) {
            stopRef.current();
          }
        }, SILENCE_CHECK_MS);
      }
    } catch {
      /* silence detection unavailable — user can stop manually */
    }

    // Periodic live preview while recording.
    partialTimerRef.current = setInterval(async () => {
      if (partialBusyRef.current || stoppingRef.current) return;
      if (chunksRef.current.length === 0) return;
      partialBusyRef.current = true;
      const blob = new Blob(chunksRef.current, {
        type: mimeRef.current || "audio/webm",
      });
      const text = await transcribe(blob, false);
      partialBusyRef.current = false;
      // Only apply if we're still recording (ignore late responses after stop).
      if (text && recorderRef.current && !stoppingRef.current) {
        setInterim(text);
      }
    }, PARTIAL_INTERVAL_MS);
  }, [supported, listening, transcribe, cleanup]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) {
      setListening(false);
      setInterim("");
      return;
    }
    stoppingRef.current = true;
    if (partialTimerRef.current) {
      clearInterval(partialTimerRef.current);
      partialTimerRef.current = null;
    }
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      cleanup();
      setListening(false);
      setInterim("");
    } finally {
      // Reset after the async onstop has had a chance to read the flag.
      setTimeout(() => {
        stoppingRef.current = false;
      }, 0);
    }
  }, [cleanup]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const toggle = useCallback(async () => {
    if (recorderRef.current) stop();
    else await start();
  }, [start, stop]);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      cleanup();
    };
  }, [cleanup]);

  return { supported, listening, interim, processing, permission, start, stop, toggle };
}
