// Choosing a browser voice for the narrated show. The platform lists voices in an arbitrary
// order, and the first match for a language is often a compact or wrong-region voice (a Hong
// Kong or Taiwan voice for a Mainland script, a low-quality English voice). Rank them: the
// Google voice for the locale first wherever the browser offers it, then exact locale, then
// any voice of the language, with higher-quality names ahead.

export type VoiceLike = {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
  voiceURI?: string;
};

// The locale the narration is written for.
export const narrationLocale = (language: "en" | "zh") =>
  language === "zh" ? "zh-CN" : "en-US";

// The default narrator per language: Google's voices, which Chrome ships on every platform
// and which read both scripts evenly. Checked by substring, case-insensitive.
const firstChoice: Record<"en" | "zh", string> = {
  en: "google us english",
  zh: "google 普通话",
};
// Voice names (platform families) known to read the language well. Checked by substring,
// case-insensitive; the list is a preference, not a requirement.
const preferredNames: Record<"en" | "zh", string[]> = {
  zh: [
    // Yu-Shu (Enhanced) is Apple's Siri-grade Mandarin voice; Tingting follows.
    "yu-shu",
    "yushu",
    "tingting",
    "lili",
    "meijia",
    "xiaoxiao",
    "yunxi",
    "google 普通话",
    "google 國語",
    "huihui",
  ],
  en: [
    "samantha",
    "ava",
    "allison",
    "zoe",
    "google us english",
    "aria",
    "jenny",
    "daniel",
    "serena",
  ],
};
const qualityMarks = [
  "premium",
  "enhanced",
  "natural",
  "neural",
  "online",
  "google",
  "microsoft",
];
const lowMarks = [
  "compact",
  "eloquence",
  "novelty",
  "espeak",
  "fred",
  "whisper",
  "bells",
  "bubbles",
  "junior",
  "superstar",
  "ralph",
  "trinoids",
  "zarvox",
  "albert",
  "bad news",
  "bahh",
  "boing",
  "cellos",
  "deranged",
  "good news",
  "hysterical",
  "organ",
  "jester",
  "wobble",
  "grandma",
  "grandpa",
  "rocko",
  "shelley",
  "sandy",
  "flo",
  "eddy",
  "reed",
];

const norm = (s: string | undefined) =>
  (s ?? "").toLowerCase().replace(/_/g, "-");

// A numeric score: higher is better. Exposed for tests and for the picker's ordering.
export const scoreVoice = (voice: VoiceLike, language: "en" | "zh"): number => {
  const lang = norm(voice.lang),
    name = norm(voice.name);
  const base = language === "zh" ? "zh" : "en";
  if (!lang.startsWith(base)) return -1;
  let score = 10;
  const locale = norm(narrationLocale(language));
  if (lang === locale) score += 40;
  else if (language === "zh" && lang.startsWith("zh-hans")) score += 35;
  else if (language === "zh" && (lang === "zh" || lang.startsWith("zh-sg")))
    score += 30;
  else if (
    language === "en" &&
    (lang.startsWith("en-gb") ||
      lang.startsWith("en-au") ||
      lang.startsWith("en-ca") ||
      lang === "en")
  )
    score += 25;
  else score += 5;
  if (qualityMarks.some((m) => name.includes(m))) score += 20;
  if (name.includes("premium")) score += 5;
  const preferredAt = preferredNames[language].findIndex((m) =>
    name.includes(m),
  );
  if (preferredAt >= 0) score += preferredAt === 0 ? 17 : 15;
  if (name.includes(firstChoice[language])) score += 30;
  if (lowMarks.some((m) => name.includes(m))) score -= 40;
  if (voice.default) score += 1;
  return score;
};

// Voices for the language, best first; a stable sort keeps the platform order for ties.
export const rankVoices = <V extends VoiceLike>(
  voices: readonly V[],
  language: "en" | "zh",
): V[] =>
  voices
    .map((voice, i) => ({ voice, i, score: scoreVoice(voice, language) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.voice);

// A stable key for remembering a choice: voiceURI where the platform gives one, else name+lang.
export const voiceKey = (voice: VoiceLike) =>
  voice.voiceURI || `${voice.name}|${voice.lang}`;

const storageKey = (language: "en" | "zh") =>
  `explainback.show-voice.${language}`;
export const rememberedVoiceKey = (language: "en" | "zh"): string | null => {
  try {
    return window.localStorage.getItem(storageKey(language));
  } catch {
    return null;
  }
};
export const rememberVoiceKey = (language: "en" | "zh", key: string | null) => {
  try {
    if (key) window.localStorage.setItem(storageKey(language), key);
    else window.localStorage.removeItem(storageKey(language));
  } catch {
    /* private mode or blocked storage: the choice lasts for the session only */
  }
};

// The voice to speak with: the remembered one when it still exists, else the best ranked.
export const pickVoice = <V extends VoiceLike>(
  voices: readonly V[],
  language: "en" | "zh",
  remembered: string | null = null,
): V | null => {
  const ranked = rankVoices(voices, language);
  if (remembered) {
    const kept = ranked.find((v) => voiceKey(v) === remembered);
    if (kept) return kept;
  }
  return ranked[0] ?? null;
};

// Short label for the picker: the name, with the region when it differs from the narration locale.
export const voiceLabel = (voice: VoiceLike, language: "en" | "zh") => {
  const lang = norm(voice.lang);
  return lang === norm(narrationLocale(language))
    ? voice.name
    : `${voice.name} (${voice.lang})`;
};
