// Shared application state — persisted to localStorage, mutated in place by
// modules that own their slice of the UI (editor, companion, pets, sheet…).

export const invoke = window.__TAURI__?.core?.invoke;
export const STORE_KEY = "rune.state.v1";

export const SAMPLES = {
  javascript: `// JavaScript runs in the app's webview.
// A basic filesystem is available via the injected \`fs\` API.
console.log("Hello from Rune");

const nums = [1, 2, 3, 4, 5];
const sum = nums.reduce((a, b) => a + b, 0);
console.log("sum:", sum);

sum; // last expression shows as return value
`,
  python: `# Python runs via the system python3 interpreter.
print("Hello from Rune")

nums = [1, 2, 3, 4, 5]
print("sum:", sum(nums))
`,
};

export const THEMES = ["dark", "matte", "light"];
export const PROVIDERS = ["anthropic", "claude-cli", "ollama"];
export const PETS = ["none", "cat", "koala"];
export const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5",
  "claude-cli": "sonnet",
  ollama: "qwen2.5-coder:7b",
};

// Curated Anthropic list — kept in preference order (fastest → most capable).
export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5",  label: "Haiku 4.5 — fast, cheap (recommended)" },
  { id: "claude-sonnet-5",   label: "Sonnet 5 — balanced quality" },
  { id: "claude-opus-5",     label: "Opus 5 — best quality" },
  { id: "claude-fable-5",    label: "Fable 5" },
];

// Claude CLI shorthand names auto-resolve to the current tier's latest model.
export const CLAUDE_CLI_MODELS = [
  { id: "sonnet", label: "Sonnet — balanced (recommended)" },
  { id: "haiku",  label: "Haiku — fast, cheap" },
  { id: "opus",   label: "Opus — best quality" },
];

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function defaultState() {
  return {
    lang: "javascript",
    theme: "dark",
    fontSize: 13,
    editorW: "60%",
    code: { ...SAMPLES },
    companion: {
      enabled: false,
      provider: "anthropic",
      style: "guidance",
      apiKey: "",
      model: { ...DEFAULT_MODELS },
      idleMs: 4000,
    },
    pet: "none",
    multiplayer: {
      enabled: false,
      host: "",
      roomId: "",
      name: "",
      userId: "",
      color: "",
    },
    problems: { enabled: false },
    currentProblem: null,
  };
}

function loadState() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      lang: p.lang || "javascript",
      theme: THEMES.includes(p.theme) ? p.theme : "dark",
      fontSize: clamp(p.fontSize || 13, 9, 28),
      editorW: p.editorW || "60%",
      code: {
        javascript: p.code?.javascript ?? SAMPLES.javascript,
        python: p.code?.python ?? SAMPLES.python,
      },
      companion: {
        enabled: !!p.companion?.enabled,
        provider: PROVIDERS.includes(p.companion?.provider) ? p.companion.provider : "anthropic",
        style: p.companion?.style === "code" ? "code" : "guidance", // default: help me think
        apiKey: p.companion?.apiKey || "",
        model: {
          anthropic: p.companion?.model?.anthropic || DEFAULT_MODELS.anthropic,
          "claude-cli": p.companion?.model?.["claude-cli"] || DEFAULT_MODELS["claude-cli"],
          ollama: p.companion?.model?.ollama || DEFAULT_MODELS.ollama,
        },
        idleMs: clamp(p.companion?.idleMs || 4000, 1500, 8000),
      },
      pet: ["cat", "koala"].includes(p.pet) ? p.pet : "none",
      multiplayer: {
        enabled: !!p.multiplayer?.enabled,
        host: p.multiplayer?.host || "",
        roomId: p.multiplayer?.roomId || "",
        name: p.multiplayer?.name || "",
        userId: p.multiplayer?.userId || "",
        color: p.multiplayer?.color || "",
      },
      problems: { enabled: !!p.problems?.enabled },
      currentProblem: p.currentProblem || null,
    };
  } catch {
    return defaultState();
  }
}

export const state = loadState();

export function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}
