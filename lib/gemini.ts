import "server-only";

export const CAPTION_STYLES = [
  "Chronically online",
  "Midwest transplant",
  "Columbia insider",
  "Deadpan",
  "Wholesome",
] as const;

export type GeneratedCaption = { style: string; text: string };

export function buildPrompt(theme: string, note: string | null) {
  return [
    "You write captions for CapCity, a photo-caption app for Columbia College students.",
    "The typical user is chronically online, grew up in the Midwest, is fairly new to New York City,",
    "lives in the dorms and explores the city on weekends.",
    "",
    `Write ${CAPTION_STYLES.length} funny, specific captions for the attached photo, one in each style:`,
    ...CAPTION_STYLES.map((style) => `- ${style}`),
    "",
    "Style notes: 'Chronically online' uses current internet slang and meme formats.",
    "'Midwest transplant' is a newcomer reacting to NYC. 'Columbia insider' may reference campus life",
    "(Butler Library, John Jay, the Low Steps, the 1 train, Morningside Heights, finals).",
    "'Deadpan' is dry and understated. 'Wholesome' is sweet but still funny.",
    "",
    `Today's theme is "${theme}". Lean into it if it fits the photo.`,
    note ? `Context from the person who posted it: "${note}"` : "",
    "",
    "Rules: under 120 characters each, refer to what is actually in the photo, no hashtags,",
    "no emojis-only captions, nothing mean about a real person's appearance, no slurs.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function generateCaptions(
  image: { data: ArrayBuffer; mimeType: string },
  prompt: string,
): Promise<{ captions: GeneratedCaption[]; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
  // Free-tier models are sometimes overloaded (503), so try the fallback before giving up.
  const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-3.8-flash"].filter(
    (m, i, all) => all.indexOf(m) === i,
  );

  let response: Response | undefined;
  let model = models[0];
  for (model of models) {
    response = await callGemini(model, apiKey, image, prompt);
    if (![429, 500, 503].includes(response.status)) break;
  }
  response = response!;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no captions (the photo may have been blocked).");

  const parsed = JSON.parse(raw) as GeneratedCaption[];
  const captions = parsed
    .map((c) => ({ style: String(c.style).trim(), text: String(c.text).trim() }))
    .filter((c) => c.text.length > 0)
    .slice(0, CAPTION_STYLES.length);

  if (captions.length === 0) throw new Error("Gemini returned no usable captions.");
  return { captions, model };
}

function callGemini(
  model: string,
  apiKey: string,
  image: { data: ArrayBuffer; mimeType: string },
  prompt: string,
) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: Buffer.from(image.data).toString("base64"),
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { style: { type: "STRING" }, text: { type: "STRING" } },
              required: ["style", "text"],
            },
          },
        },
      }),
    },
  );
}
