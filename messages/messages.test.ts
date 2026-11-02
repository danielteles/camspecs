import { describe, expect, it } from "vitest";

import en from "./en.json";
import es from "./es.json";
import ptBR from "./pt-BR.json";

type Messages = { [key: string]: string | Messages };

function keyPaths(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : keyPaths(value, `${prefix}${key}.`),
  );
}

// Component tests only resolve copy from en.json, so a key missing from
// another locale would otherwise first show up as a runtime error there.
describe.each([
  ["es", es],
  ["pt-BR", ptBR],
])("%s messages", (_locale, messages) => {
  it("define every key en.json defines, and no others", () => {
    expect(keyPaths(messages).sort()).toEqual(keyPaths(en).sort());
  });
});
