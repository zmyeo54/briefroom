const KEYS = {
  settings: "briefroom_settings_v2",
  draft: "briefroom_draft_v2",
  qa: "briefroom_qa_v2",
};

const LEGACY = {
  settings: ["ic_settings_v1", "briefroom_settings_v1"],
  draft: ["ic_draft_v1", "briefroom_draft_v1"],
  qa: ["ic_qa_v1", "briefroom_qa_v1"],
};

function readRaw(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasApiKey(obj) {
  return Boolean(obj && typeof obj === "object" && String(obj.apiKey || "").trim());
}

export function loadJson(key, fallback) {
  const primary = KEYS[key] || key;
  const current = readRaw(primary);
  const legacyKeys = LEGACY[key] || [];

  // Settings: if current exists but has no API key, still try legacy (empty autosave
  // used to block migration from the older app).
  if (key === "settings") {
    if (hasApiKey(current)) return current;

    for (const lk of legacyKeys) {
      const legacy = readRaw(lk);
      if (hasApiKey(legacy)) {
        const merged = { ...(current || {}), ...legacy };
        localStorage.setItem(primary, JSON.stringify(merged));
        return merged;
      }
    }
    return current != null ? current : fallback;
  }

  if (current != null) return current;

  for (const lk of legacyKeys) {
    const legacy = readRaw(lk);
    if (legacy != null) {
      localStorage.setItem(primary, JSON.stringify(legacy));
      return legacy;
    }
  }
  return fallback;
}

export function saveJson(key, value) {
  localStorage.setItem(KEYS[key] || key, JSON.stringify(value));
  // Let other open tabs / Shell refresh badge
  try {
    window.dispatchEvent(
      new CustomEvent("briefroom-storage", { detail: { key } })
    );
  } catch {
    /* ignore */
  }
}

export { KEYS };
