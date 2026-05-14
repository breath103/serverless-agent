// Free-form debug overrides on `profiles.debug`. Not user-editable; set by
// dev tooling (e.g. `create-dummy-profile.ts`) to surface demo affordances.
export type ProfileDebug = {
  /** Shown next to the chat input as one-tap starter prompts. */
  chat_suggestions?: string[];
};
