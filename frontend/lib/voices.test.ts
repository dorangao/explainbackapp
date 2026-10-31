import { describe, expect, it } from "vitest";
import { pickVoice, rankVoices, scoreVoice, voiceLabel } from "./voices";

const v = (
  name: string,
  lang: string,
  extra: Partial<{
    localService: boolean;
    default: boolean;
    voiceURI: string;
  }> = {},
) => ({ name, lang, ...extra });

// A macOS-like list in the order Safari and Chrome tend to report it.
const macVoices = [
  v("Sinji", "zh-HK"),
  v("Meijia", "zh-TW"),
  v("Tingting", "zh-CN", { localService: true }),
  v("Tingting (Enhanced)", "zh-CN", { localService: true }),
  v("Fred", "en-US"),
  v("Albert", "en-US"),
  v("Samantha", "en-US", { default: true }),
  v("Daniel", "en-GB"),
  v("Google US English", "en-US", { localService: false }),
  v("Google 普通话（中国大陆）", "zh-CN", { localService: false }),
  v("Bubbles", "en-US"),
  v("Marie", "fr-FR"),
];

describe("voice ranking", () => {
  it("prefers a Mainland voice over the first zh voice the platform lists", () => {
    const ranked = rankVoices(macVoices, "zh");
    expect(ranked[0].name).not.toBe("Sinji");
    expect(ranked.map((x) => x.lang).every((l) => l.startsWith("zh"))).toBe(
      true,
    );
    expect(ranked[0].lang).toBe("zh-CN");
    // Enhanced and Google voices come before the compact Tingting; regional voices last.
    expect(
      ranked
        .slice(0, 2)
        .map((x) => x.name)
        .sort(),
    ).toEqual(["Google 普通话（中国大陆）", "Tingting (Enhanced)"]);
    expect(ranked.at(-1)?.lang).not.toBe("zh-CN");
  });
  it("defaults to the Google voice for each language when the browser offers it, and falls back to the platform favourites otherwise", () => {
    const chrome = [
      v("Samantha (Enhanced)", "en-US", { default: true }),
      v("Yu-Shu (Enhanced)", "zh-CN"),
      v("Tingting (Enhanced)", "zh-CN"),
      v("Google US English", "en-US", { localService: false }),
      v("Google UK English Female", "en-GB", { localService: false }),
      v("Google 普通话（中国大陆）", "zh-CN", { localService: false }),
      v("Google 國語（臺灣）", "zh-TW", { localService: false }),
    ];
    expect(pickVoice(chrome, "en")?.name).toBe("Google US English");
    expect(pickVoice(chrome, "zh")?.name).toBe("Google 普通话（中国大陆）");
    const safari = chrome.filter((x) => !x.name.startsWith("Google"));
    expect(pickVoice(safari, "en")?.name).toBe("Samantha (Enhanced)");
    expect(pickVoice(safari, "zh")?.name).toBe("Yu-Shu (Enhanced)");
  });
  it("puts Yu-Shu (Enhanced) ahead of Tingting (Enhanced) and both ahead of the compact voice", () => {
    const ranked = rankVoices(
      [
        v("Tingting", "zh-CN"),
        v("Tingting (Enhanced)", "zh-CN"),
        v("Yu-Shu (Enhanced)", "zh-CN"),
        v("Yue (Premium)", "zh-CN"),
      ],
      "zh",
    );
    expect(ranked.map((x) => x.name)).toEqual([
      "Yu-Shu (Enhanced)",
      "Tingting (Enhanced)",
      "Yue (Premium)",
      "Tingting",
    ]);
  });
  it("skips novelty English voices and keeps the natural ones first", () => {
    const ranked = rankVoices(macVoices, "en");
    expect(
      ranked
        .slice(0, 2)
        .map((x) => x.name)
        .sort(),
    ).toEqual(["Google US English", "Samantha"]);
    expect(ranked.findIndex((x) => x.name === "Fred")).toBeGreaterThan(
      ranked.findIndex((x) => x.name === "Daniel"),
    );
    expect(ranked.some((x) => x.lang === "fr-FR")).toBe(false);
  });
  it("scores other languages below zero and keeps platform order for ties", () => {
    expect(scoreVoice(v("Marie", "fr-FR"), "en")).toBe(-1);
    const twins = [v("A", "en-US"), v("B", "en-US")];
    expect(rankVoices(twins, "en").map((x) => x.name)).toEqual(["A", "B"]);
  });
  it("picks the remembered voice when it still exists, else the best one", () => {
    expect(pickVoice(macVoices, "zh", "Tingting|zh-CN")?.name).toBe("Tingting");
    expect(pickVoice(macVoices, "zh", "Gone|zh-CN")?.name).not.toBe("Gone");
    expect(pickVoice([], "zh")).toBeNull();
    expect(pickVoice([v("Marie", "fr-FR")], "en")).toBeNull();
  });
  it("labels a voice with its region only when it differs from the narration locale", () => {
    expect(voiceLabel(v("Tingting", "zh-CN"), "zh")).toBe("Tingting");
    expect(voiceLabel(v("Meijia", "zh-TW"), "zh")).toBe("Meijia (zh-TW)");
    expect(voiceLabel(v("Daniel", "en-GB"), "en")).toBe("Daniel (en-GB)");
  });
});
