import en from "@/messages/en.json";

type MessageValue = string | { [key: string]: MessageValue };
type Messages = Record<string, MessageValue>;

function getByPath(source: Messages, path: string): MessageValue | undefined {
  return path.split(".").reduce<MessageValue | undefined>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Messages)[segment];
    }
    return undefined;
  }, source);
}

function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Stand-in for next-intl's `useTranslations`/`getTranslations`, resolving
 * real strings from `messages/en.json` so component tests assert against
 * actual UI copy instead of raw i18n keys.
 */
export function createTranslator(namespace?: string) {
  return (key: string, values?: Record<string, string | number>) => {
    const fullPath = namespace ? `${namespace}.${key}` : key;
    const value = getByPath(en as Messages, fullPath);

    if (typeof value !== "string") {
      throw new Error(`Missing mock translation for "${fullPath}"`);
    }

    return interpolate(value, values);
  };
}
