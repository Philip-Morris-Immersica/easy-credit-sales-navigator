import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/auth";

export const runtime = "nodejs";

// Browser-independent voice transcription. The client records audio with
// MediaRecorder and posts it here; we forward it to OpenAI's speech-to-text
// model. This works identically across Edge, Chrome, Firefox, Safari and
// mobile — unlike the browser Web Speech API.

const ALLOWED_MODELS = new Set([
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "whisper-1",
]);

// Phrases the transcription models tend to hallucinate on silence/faint audio.
// If the whole result is just one of these (or the biasing prompt echoed back),
// we return an empty string so nothing lands in the input box.
const HALLUCINATION_PATTERNS = [
  "разговор на български език между кредитен консултант и клиент",
  "субтитри",
  "благодаря, че гледахте",
  "продължение следва",
  "amara.org",
];

function sanitizeTranscript(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  // Drop results that are essentially just the biasing prompt or a known
  // filler hallucination, and very short punctuation-only fragments.
  if (HALLUCINATION_PATTERNS.some((p) => lower.includes(p))) return "";
  if (!/[а-яa-z0-9]/i.test(text)) return "";
  return text;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "No audio provided" }, { status: 400 });
  }

  const requestedModel = String(form.get("model") ?? "");
  const modelId = ALLOWED_MODELS.has(requestedModel)
    ? requestedModel
    : "gpt-4o-transcribe";

  const audio = new Uint8Array(await file.arrayBuffer());

  // A short, natural-sentence prompt biases the model toward Bulgarian sales
  // context WITHOUT feeding it a comma-separated vocabulary list. A keyword
  // list gets echoed back verbatim when the user is silent or the audio is
  // faint (a well-known Whisper hallucination), so we deliberately avoid it.
  const providerOptions = {
    openai: {
      language: "bg",
      temperature: 0,
      prompt:
        "Разговор на български език между кредитен консултант и клиент в Изи Кредит.",
    },
  };

  // Try the requested model first, fall back to whisper-1 on failure.
  const modelsToTry =
    modelId === "whisper-1" ? ["whisper-1"] : [modelId, "whisper-1"];

  let lastErr: unknown;
  for (const model of modelsToTry) {
    try {
      const { text } = await transcribe({
        model: openai.transcription(model),
        audio,
        providerOptions,
      });
      return Response.json({ text: sanitizeTranscript(text) });
    } catch (err) {
      console.error(`Transcription failed with model ${model}:`, err);
      lastErr = err;
    }
  }

  console.error("All transcription models failed:", lastErr);
  return Response.json({ error: "Transcription failed" }, { status: 500 });
}
