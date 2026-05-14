// Terminal-HUD is dark-only by design. Light mode no longer exists.
// These hooks are kept as no-op shims so existing callsites compile while
// the migration is in progress; remove them once no route imports them.

type Theme = "light" | "dark" | "system";

export function setTheme(theme: Theme) {
  void theme;
}

/** Always returns true — the app is dark-only. */
export function useIsDark() {
  return true;
}

/** No-op — the app is dark-only. Kept so existing route components still compile. */
export function useForceTheme(forced: "light" | "dark") {
  void forced;
}

/** No-op — kept for main.tsx compat in case anything still calls it. */
export function listenForSystemThemeChanges() {
  return () => {};
}
