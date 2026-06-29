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

  const providerOptions = {
    openai: {
      language: "bg",
      prompt:
        "Транскрипция на български език от търговски разговор за потребителски кредити.",
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
      return Response.json({ text: text.trim() });
    } catch (err) {
      console.error(`Transcription failed with model ${model}:`, err);
      lastErr = err;
    }
  }

  console.error("All transcription models failed:", lastErr);
  return Response.json({ error: "Transcription failed" }, { status: 500 });
}
