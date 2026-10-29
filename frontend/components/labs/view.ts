import type { PhysicsController, Store } from "./physicsController";
import type { Language, Post, Status } from "./types";
// Everything a physics subcomponent needs to render the current snapshot.
export type View = {
  s: Store;
  c: PhysicsController;
  lang: Language;
  status: Status;
  post: Post;
  onLanguage: (language: Language) => void;
};
