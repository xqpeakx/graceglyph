<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import fixtures from "../../playground-fixtures.json";

type Profile = { id: string; label: string };
type Fixture = { width: number; height: number; ansi: string };
type Example = {
  id: string;
  title: string;
  description: string;
  code: string;
  fixtures: Record<string, Fixture>;
};

const payload = fixtures as {
  generatedAt: string;
  profiles: Profile[];
  examples: Example[];
};

const selectedExampleId = ref(payload.examples[0]?.id ?? "");
const selectedProfileId = ref(payload.profiles[0]?.id ?? "");
const host = ref<HTMLElement | null>(null);
const isReady = ref(false);

let term: any | null = null;
let fitAddon: any | null = null;
let resizeObserver: ResizeObserver | null = null;

const selectedExample = computed(
  () => payload.examples.find((entry) => entry.id === selectedExampleId.value) ?? payload.examples[0],
);
const selectedFixture = computed(() => {
  const example = selectedExample.value;
  if (!example) return null;
  return example.fixtures[selectedProfileId.value] ?? null;
});

function repaintTerminal(): void {
  if (!term) return;
  const fixture = selectedFixture.value;
  if (!fixture) return;
  term.reset();
  term.write(fixture.ansi);
}

onMounted(async () => {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);
  term = new Terminal({
    convertEol: true,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
    fontSize: 12,
    lineHeight: 1.15,
    cursorBlink: true,
    theme: {
      background: "#0b1020",
      foreground: "#d9e1ff",
      cursor: "#8cb4ff",
      selectionBackground: "#2a3f79",
    },
  });
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  if (host.value) {
    term.open(host.value);
    fitAddon.fit();
  }
  resizeObserver = new ResizeObserver(() => fitAddon?.fit());
  if (host.value) resizeObserver.observe(host.value);
  isReady.value = true;
  repaintTerminal();
});

onBeforeUnmount(() => {
  if (resizeObserver && host.value) resizeObserver.unobserve(host.value);
  resizeObserver?.disconnect();
  resizeObserver = null;
  term?.dispose();
  term = null;
  fitAddon = null;
});

watch([selectedExampleId, selectedProfileId], () => repaintTerminal());
</script>

<template>
  <div class="playground">
    <div class="controls">
      <label>
        Example
        <select v-model="selectedExampleId">
          <option v-for="example in payload.examples" :key="example.id" :value="example.id">
            {{ example.title }}
          </option>
        </select>
      </label>
      <label>
        Capability profile
        <select v-model="selectedProfileId">
          <option v-for="profile in payload.profiles" :key="profile.id" :value="profile.id">
            {{ profile.label }}
          </option>
        </select>
      </label>
    </div>

    <p class="description">{{ selectedExample?.description }}</p>
    <div ref="host" class="terminal" />
    <p class="meta">Fixture generated: {{ payload.generatedAt }}</p>

    <details>
      <summary>Show source snippet</summary>
      <pre><code>{{ selectedExample?.code }}</code></pre>
    </details>

    <p v-if="!isReady" class="meta">Loading terminal runtime...</p>
  </div>
</template>

<style scoped>
.playground {
  display: grid;
  gap: 0.75rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.9rem;
}

select {
  min-width: 13rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}

.description {
  margin: 0;
  color: var(--vp-c-text-2);
}

.terminal {
  min-height: 19rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 0.35rem;
  background: #0b1020;
}

.meta {
  margin: 0;
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
}

pre {
  overflow-x: auto;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  padding: 0.75rem;
}
</style>
