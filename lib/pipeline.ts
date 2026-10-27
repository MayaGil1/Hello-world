import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Runs the caption pipeline configured in the database (prompt chains, steps, mix, models, terms,
// examples) and logs it: one generation_requests row per run, one llm_responses row per model call.
// The same file lives in the admin panel repo; keep the two copies identical.

type Model = {
  id: number;
  llm_provider_id: number;
  provider_model_id: string;
  is_temperature_supported: boolean;
  is_active: boolean;
  llm_providers: { slug: string } | null;
};

type Step = {
  id: number;
  order_by: number;
  llm_model_id: number;
  input_type: "image" | "text" | "image_and_text";
  output_type: "text" | "captions";
  temperature: number | null;
  system_prompt: string;
  user_prompt: string;
};

type MixRow = {
  caption_count: number;
  prompt_chains: { id: number; slug: string; prompt_chain_steps: Step[] } | null;
};

export type GeneratedCaption = {
  style: string;
  text: string;
  prompt: string;
  model: string;
  prompt_chain_id: number;
};

type RunInput = {
  userId: string;
  imagePath: string;
  image: { data: ArrayBuffer; mimeType: string };
  theme: string;
  note: string | null;
  source: "capcity" | "admin";
  postId?: number;
};

const RETRYABLE = [429, 500, 503];

export async function runCaptionPipeline(db: SupabaseClient, input: RunInput) {
  const started = Date.now();
  const { data: request, error: requestError } = await db
    .from("generation_requests")
    .insert({
      user_id: input.userId,
      post_id: input.postId ?? null,
      image_path: input.imagePath,
      theme: input.theme,
      note: input.note,
      source: input.source,
    })
    .select("id")
    .single();
  if (requestError || !request) throw new Error(`Could not log the generation request: ${requestError?.message}`);
  const requestId = request.id as number;

  const finish = (fields: Record<string, unknown>) =>
    db
      .from("generation_requests")
      .update({ ...fields, duration_ms: Date.now() - started, finished_at: new Date().toISOString() })
      .eq("id", requestId);

  try {
    const [mix, models, terms, examples] = await Promise.all([
      db
        .from("prompt_chain_mix")
        .select(
          "caption_count, prompt_chains(id, slug, prompt_chain_steps(id, order_by, llm_model_id, input_type, output_type, temperature, system_prompt, user_prompt))",
        )
        .gt("caption_count", 0),
      db
        .from("llm_models")
        .select("id, llm_provider_id, provider_model_id, is_temperature_supported, is_active, llm_providers(slug)"),
      db.from("terms").select("term, definition, example").order("priority", { ascending: false }).limit(15),
      db
        .from("caption_examples")
        .select("image_description, caption, explanation")
        .order("priority", { ascending: false })
        .limit(5),
    ]);
    if (mix.error) throw new Error(mix.error.message);

    const chains = ((mix.data ?? []) as unknown as MixRow[]).filter((m) => m.prompt_chains);
    if (chains.length === 0) throw new Error("The prompt chain mix asks for 0 captions.");

    const vars = {
      theme: input.theme,
      note: input.note ?? "(none)",
      terms:
        (terms.data ?? []).map((t) => `- ${t.term}: ${t.definition}${t.example ? ` (e.g. "${t.example}")` : ""}`).join("\n") ||
        "(none)",
      examples:
        (examples.data ?? [])
          .map((e) => `- Photo: ${e.image_description}\n  Caption: ${e.caption}${e.explanation ? `\n  Why it works: ${e.explanation}` : ""}`)
          .join("\n") || "(none)",
    };
    const ctx = {
      db,
      requestId,
      models: (models.data ?? []) as unknown as Model[],
      image: { mimeType: input.image.mimeType, base64: Buffer.from(input.image.data).toString("base64") },
    };

    const results = await Promise.allSettled(
      chains.map((m) => runChain(ctx, m.prompt_chains!, m.caption_count, vars)),
    );
    const captions = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const failures = results.flatMap((r) => (r.status === "rejected" ? [String(r.reason?.message ?? r.reason)] : []));

    if (captions.length === 0) throw new Error(failures.join("; ") || "No captions were generated.");
    await finish({ status: "succeeded", caption_count: captions.length, error: failures.join("; ") || null });
    return { requestId, captions };
  } catch (error) {
    await finish({ status: "failed", error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// Link the request to the post once the caller has saved it.
export async function attachPostToRequest(db: SupabaseClient, requestId: number, postId: number) {
  await db.from("generation_requests").update({ post_id: postId }).eq("id", requestId);
}

type Ctx = {
  db: SupabaseClient;
  requestId: number;
  models: Model[];
  image: { mimeType: string; base64: string };
};

async function runChain(
  ctx: Ctx,
  chain: { id: number; slug: string; prompt_chain_steps: Step[] },
  count: number,
  baseVars: Record<string, string>,
): Promise<GeneratedCaption[]> {
  const steps = [...chain.prompt_chain_steps].sort((a, b) => a.order_by - b.order_by);
  if (steps.length === 0) throw new Error(`Chain "${chain.slug}" has no steps.`);
  if (steps[steps.length - 1].output_type !== "captions") {
    throw new Error(`Chain "${chain.slug}" must end with a step that outputs captions.`);
  }

  let previous = "";
  for (const step of steps) {
    const vars = { ...baseVars, count: String(count), previous: previous || "(none)" };
    const userPrompt = render(step.user_prompt, vars);
    const systemPrompt = render(step.system_prompt, vars);
    const { text, model } = await callStep(ctx, chain.id, step, systemPrompt, userPrompt);

    if (step.output_type === "text") {
      previous = text;
      continue;
    }
    const parsed = JSON.parse(text) as { style?: unknown; text?: unknown }[];
    const captions = parsed
      .map((c) => ({ style: String(c.style ?? "").trim() || "Mixed", text: String(c.text ?? "").trim() }))
      .filter((c) => c.text.length > 0)
      .slice(0, count);
    if (captions.length === 0) throw new Error(`Chain "${chain.slug}" returned no usable captions.`);
    return captions.map((c) => ({ ...c, prompt: userPrompt, model, prompt_chain_id: chain.id }));
  }
  return [];
}

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

// Try the step's model, then the other active models from the same provider if it's overloaded.
async function callStep(ctx: Ctx, chainId: number, step: Step, systemPrompt: string, userPrompt: string) {
  const primary = ctx.models.find((m) => m.id === step.llm_model_id);
  if (!primary) throw new Error(`Step ${step.id} uses a model that no longer exists.`);
  const candidates = [primary, ...ctx.models.filter((m) => m.id !== primary.id && m.llm_provider_id === primary.llm_provider_id)]
    .filter((m) => m.is_active);
  if (candidates.length === 0) throw new Error(`No active model for step ${step.id}.`);

  let lastError = "";
  for (const model of candidates) {
    const provider = model.llm_providers?.slug;
    const temperature = model.is_temperature_supported ? step.temperature : null;
    const started = Date.now();
    let status: number | null = null;
    let text: string | null = null;
    let error: string | null = null;

    try {
      if (provider !== "google") throw new Error(`Provider "${provider}" isn't supported by CapCity's code yet.`);
      const response = await callGemini(model.provider_model_id, step, systemPrompt, userPrompt, temperature, ctx.image);
      status = response.status;
      const body = await response.text();
      if (!response.ok) {
        error = `HTTP ${response.status}: ${body.slice(0, 500)}`;
      } else {
        text = JSON.parse(body)?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        if (!text) error = "Empty response (the photo may have been blocked).";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    await ctx.db.from("llm_responses").insert({
      generation_request_id: ctx.requestId,
      prompt_chain_id: chainId,
      prompt_chain_step_id: step.id,
      llm_model_id: model.id,
      provider_model_id: model.provider_model_id,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      temperature,
      response: text,
      http_status: status,
      error,
      duration_ms: Date.now() - started,
    });

    if (text && !error) return { text, model: model.provider_model_id };
    lastError = error ?? "Unknown error";
    if (status !== null && !RETRYABLE.includes(status)) break;
  }
  throw new Error(lastError);
}

function callGemini(
  modelId: string,
  step: Step,
  systemPrompt: string,
  userPrompt: string,
  temperature: number | null,
  image: { mimeType: string; base64: string },
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");

  const parts: object[] = [];
  if (step.input_type !== "text") parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  parts.push({ text: userPrompt });

  const generationConfig: Record<string, unknown> = {};
  if (temperature !== null) generationConfig.temperature = Number(temperature);
  if (step.output_type === "captions") {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { style: { type: "STRING" }, text: { type: "STRING" } },
        required: ["style", "text"],
      },
    };
  }

  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts }],
      generationConfig,
    }),
  });
}
