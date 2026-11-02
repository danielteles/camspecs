import type en from "@/messages/en.json";

import type { locales } from "./routing";

export type Messages = typeof en;

// One static import per locale (rather than a template-string import) so
// each bundle stays lazily loaded but the result is typed, not `any`.
const MESSAGE_LOADERS = {
  en: () => import("@/messages/en.json"),
  "pt-BR": () => import("@/messages/pt-BR.json"),
  es: () => import("@/messages/es.json"),
} satisfies Record<
  (typeof locales)[number],
  () => Promise<{ default: Messages }>
>;

export async function loadMessages(
  locale: (typeof locales)[number],
): Promise<Messages> {
  return (await MESSAGE_LOADERS[locale]()).default;
}
