export type Theme = "paper" | "glass" | "meta";
export type AppearanceMode = "system" | "light" | "dark";
export type AppearancePreference = Readonly<{
  theme: Theme;
  mode: AppearanceMode;
  reduceTransparency: boolean;
}>;
export type AppearanceState = AppearancePreference & Readonly<{ scheme: "light" | "dark" }>;
declare global {
  interface Window {
    explainbackAppearance: {
      readonly version: 2;
      readonly options: readonly {
        id: Theme;
        en: string;
        zh: string;
        light: string;
        dark: string;
      }[];
      read(): AppearanceState;
      subscribe(listener: () => void): () => void;
      select(value: AppearancePreference): AppearanceState;
    };
  }
}
