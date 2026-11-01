export type Theme = "paper" | "midnight" | "glass" | "meta";
export type AppearancePreference = Readonly<{
  theme: Theme;
  reduceTransparency: boolean;
}>;
declare global {
  interface Window {
    explainbackAppearance: {
      readonly options: readonly {
        id: Theme;
        en: string;
        zh: string;
        background: string;
        scheme: string;
      }[];
      read(): AppearancePreference;
      select(value: AppearancePreference): AppearancePreference;
    };
  }
}
