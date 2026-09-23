import "server-only";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY env var.");
}

export interface PartnerProfileInput {
  role: "A" | "B";
  moods: string[];
  moodFreeText: string | null;
}

export interface SearchBrief {
  genres: string[];
  keywords: string[];
  vibeSummary: string;
}

const BRIEF_JSON_SHAPE = `{
  "genres": string[] (3-6 movie/TV genre names such as "Comedy", "Thriller", "Romance"),
  "keywords": string[] (3-8 short lowercase mood/theme words to look for in a synopsis, e.g. "heist", "slow burn", "feel-good"),
  "vibeSummary": string (one upbeat sentence describing tonight's pick, written for both partners to read)
}`;

async function callGemini(prompt: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.8,
        },
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

/**
 * This is the one function to swap if a Claude/Anthropic key is added later:
 * same signature, same JSON contract, different model call inside.
 */
export async function generateSearchBrief(
  profiles: PartnerProfileInput[],
  historyNote?: string
): Promise<SearchBrief> {
  const profileText = profiles
    .map(
      (p) =>
        `Partner ${p.role}: moods = [${p.moods.join(", ") || "none selected"}]` +
        (p.moodFreeText ? `; in their own words: "${p.moodFreeText}"` : "")
    )
    .join("\n");

  const prompt = `You are picking what to watch for two partners on a movie night in India. Read both partners' mood preferences below and produce ONE shared search brief that captures a vibe they'd BOTH enjoy tonight, giving real weight to any free-text nuance.

${profileText}
${historyNote ? `\nThis couple's past Match Night history (use it to lean toward what has actually worked for them before, not just tonight's mood): ${historyNote}\n` : ""}
Respond with ONLY minified JSON matching this shape, no markdown fences:
${BRIEF_JSON_SHAPE}`;

  const json = await callGemini(prompt);
  return {
    genres: Array.isArray(json.genres) ? (json.genres as string[]) : [],
    keywords: Array.isArray(json.keywords) ? (json.keywords as string[]) : [],
    vibeSummary:
      typeof json.vibeSummary === "string" ? json.vibeSummary : "",
  };
}

export interface LikedTitleInput {
  title: string;
  genres: string[];
}

/** Round 2: lean into what both partners actually right-swiped in round 1. */
export async function refineFromLikes(
  profiles: PartnerProfileInput[],
  likedByA: LikedTitleInput[],
  likedByB: LikedTitleInput[]
): Promise<SearchBrief> {
  const profileText = profiles
    .map(
      (p) =>
        `Partner ${p.role}: moods = [${p.moods.join(", ") || "none selected"}]` +
        (p.moodFreeText ? `; in their own words: "${p.moodFreeText}"` : "")
    )
    .join("\n");

  const likesText = [
    `Partner A liked: ${likedByA.map((t) => `${t.title} (${t.genres.join("/")})`).join(", ") || "nothing"}`,
    `Partner B liked: ${likedByB.map((t) => `${t.title} (${t.genres.join("/")})`).join(", ") || "nothing"}`,
  ].join("\n");

  const prompt = `Two partners just swiped through a first round of movie/TV suggestions for tonight and did not find a shared match. Use what they actually leaned toward (their right-swipes) to sharpen a second, more targeted search brief that's more likely to satisfy both.

Original mood preferences:
${profileText}

Round 1 right-swipes:
${likesText}

Respond with ONLY minified JSON matching this shape, no markdown fences:
${BRIEF_JSON_SHAPE}`;

  const json = await callGemini(prompt);
  return {
    genres: Array.isArray(json.genres) ? (json.genres as string[]) : [],
    keywords: Array.isArray(json.keywords) ? (json.keywords as string[]) : [],
    vibeSummary:
      typeof json.vibeSummary === "string" ? json.vibeSummary : "",
  };
}
