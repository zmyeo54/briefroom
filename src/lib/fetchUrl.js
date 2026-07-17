/**
 * Fetch readable text from a public job posting URL.
 * LinkedIn jobs go through the local helper (guest API) for accurate title + JD.
 * Other sites: local helper first, then browser Jina / AllOrigins fallbacks.
 */

import { extractJobTitle, parseJinaMeta } from "./jobMeta.js";

function normalizeUrl(input) {
  const raw = (input || "").trim();
  if (!raw) throw new Error("Paste a URL first.");
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }
  return u.toString();
}

export function isLinkedInJobUrl(input) {
  try {
    const u = normalizeUrl(input);
    return /linkedin\.com\/jobs\/view\//i.test(u);
  } catch {
    return false;
  }
}

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, svg, iframe").forEach((el) =>
    el.remove()
  );
  const text = doc.body?.textContent || "";
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

function looksLikeLoginWall(text) {
  const t = (text || "").toLowerCase();
  const wallHits = [
    "join to apply",
    "sign in to find your next job",
    "new to linkedin",
    "forgot password",
  ].filter((s) => t.includes(s)).length;
  const hasJd =
    t.includes("responsibilities") ||
    t.includes("qualifications") ||
    t.includes("job description") ||
    t.includes("let’s talk about the role") ||
    t.includes("let's talk about the role") ||
    t.includes("basic qualifications");
  return wallHits >= 2 && !hasJd;
}

async function viaLocalHelper(url) {
  const res = await fetch("/api/fetch-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Local extract failed (${res.status})`);
  }
  const text = String(data.text || "").trim();
  if (text.length < 80) throw new Error("Local extract returned too little text");
  if (looksLikeLoginWall(text)) {
    throw new Error("Got a LinkedIn login page instead of the job description");
  }
  return {
    text,
    title: String(data.title || "").trim() || extractJobTitle(text),
    company: String(data.company || "").trim(),
  };
}

async function viaJina(url) {
  const endpoint = `https://r.jina.ai/${url}`;
  const res = await fetch(endpoint, {
    headers: { Accept: "text/plain" },
  });
  if (!res.ok) throw new Error(`Reader failed (${res.status})`);
  const text = (await res.text()).trim();
  if (text.length < 40) throw new Error("Reader returned too little text");
  if (/AbuseAlleviationError/i.test(text)) {
    throw new Error("Reader blocked this site temporarily");
  }
  if (looksLikeLoginWall(text)) {
    throw new Error("Reader hit a login wall");
  }
  return { text, ...parseJinaMeta(text) };
}

async function viaAllOrigins(url) {
  const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Proxy failed (${res.status})`);
  const html = await res.text();
  const text = stripHtml(html);
  if (text.length < 40) throw new Error("Page had too little readable text");
  if (looksLikeLoginWall(text)) {
    throw new Error("Proxy hit a login wall");
  }
  return { text, title: extractJobTitle(text), company: "" };
}

export async function extractTextFromUrl(input, _onProgress) {
  const url = normalizeUrl(input);
  const linkedin = isLinkedInJobUrl(url);

  // LinkedIn must use the local guest-API helper for accurate title + JD
  try {
    return await viaLocalHelper(url);
  } catch (e) {
    if (linkedin) {
      throw new Error(
        `Couldn’t open this LinkedIn job. Try pasting the description instead. (${e.message})`
      );
    }
  }

  try {
    return await viaJina(url);
  } catch {
    return await viaAllOrigins(url);
  }
}
