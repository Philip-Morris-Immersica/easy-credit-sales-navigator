/**
 * Параметри на повикването към модела (temperature / reasoning / лимит на токени)
 * според типа модел. Ползва се от чата (`api/chat/route.ts`) и от анализа
 * (`lib/analysis.ts`), за да има само едно място с тази логика.
 *
 * - Класически модели (gpt-4.1, gpt-4o…): `temperature` + `maxOutputTokens` точно
 *   както са в настройките на бота; никакви други опции.
 * - Reasoning модели (gpt-5.x, gpt-6-sol/luna, o-серия): НЕ се праща `temperature`
 *   (при reasoning усилие различно от „none“ OpenAI го отхвърля — виж
 *   https://developers.openai.com/api/docs/guides/latest-model), задава се
 *   `reasoningEffort`, а `maxOutputTokens` се увеличава с резерв за „мисленето“,
 *   защото `max_output_tokens` включва и reasoning токените
 *   (https://developers.openai.com/api/docs/guides/reasoning).
 */

export type ModelCallPurpose = "chat" | "analysis";

/** Резерв токени за reasoning, добавян към лимита от настройките на бота. */
const REASONING_HEADROOM: Record<ModelCallPurpose, number> = {
  chat: 1500, // усилие „low“ — малко мислене; забавянето е критично (глас)
  analysis: 4000, // усилие „medium“ — по-дълго мислене преди JSON отговора
};

const REASONING_EFFORT: Record<ModelCallPurpose, "low" | "medium"> = {
  chat: "low",
  analysis: "medium",
};

/** gpt-5*, gpt-6*, o1/o3/o4… са reasoning модели; `-chat-` вариантите (gpt-5-chat-latest) — не. */
export function isReasoningModel(model: string): boolean {
  if (/^o\d+(-|$)/.test(model)) return true;
  const m = /^gpt-(\d+)(?:\.\d+)?(?:-(.+))?$/.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  const variant = m[2] ?? "";
  return major >= 5 && !variant.startsWith("chat");
}

export interface ModelCallOptions {
  temperature?: number;
  maxOutputTokens: number;
  providerOptions?: {
    openai: { reasoningEffort: "low" | "medium" };
  };
}

export function getModelCallOptions(
  model: string,
  purpose: ModelCallPurpose,
  temperature: number,
  maxTokens: number
): ModelCallOptions {
  if (!isReasoningModel(model)) {
    // Непроменено поведение за gpt-4.1 и другите не-reasoning модели.
    return { temperature, maxOutputTokens: maxTokens };
  }
  return {
    maxOutputTokens: maxTokens + REASONING_HEADROOM[purpose],
    providerOptions: {
      openai: { reasoningEffort: REASONING_EFFORT[purpose] },
    },
  };
}
