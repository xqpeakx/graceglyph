import { definePlugin } from "../../src/plugin.js";

export const fixturePlugin = definePlugin({
  id: "fixture.object",
  description: "fixture object plugin export",
});

export function createFixturePlugin(options?: unknown) {
  const suffix =
    typeof options === "object" && options !== null && "suffix" in options
      ? String((options as { suffix?: unknown }).suffix ?? "")
      : "";
  return definePlugin({
    id: `fixture.factory${suffix}`,
    description: "fixture factory plugin export",
  });
}

export default createFixturePlugin;
