export const LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "ko-KR", label: "한국어" },
  { value: "ja-JP", label: "日本語" },
  { value: "zh-CN", label: "中文 (简体)" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
];

// All canonical IANA timezones. Native <select> handles type-ahead search.
export const TIMEZONES: { value: string; label: string }[] = Intl
  .supportedValuesOf("timeZone")
  .map((tz) => ({ value: tz, label: tz }));
