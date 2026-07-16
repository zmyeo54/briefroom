import { cors } from "./_ttsShared.js";

export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: "8kb" } },
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function linkedinJobId(url) {
  const m = String(url || "").match(/linkedin\.com\/jobs\/view\/(?:[^/?#]*-)?(\d+)/i);
  return m?.[1] || null;
}

function stripTags(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function firstMatch(html, patterns) {
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[1]) {
      const v = stripTags(m[1]);
      if (v) return v;
    }
  }
  return "";
}

async function fetchLinkedIn(url) {
  const id = linkedinJobId(url);
  if (!id) throw new Error("Not a LinkedIn job URL");
  const guest = `https://www.linkedin.com/jobs/view/${id}`;
  const res = await fetch(guest, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`LinkedIn fetch failed (${res.status})`);
  const html = await res.text();
  let title = firstMatch(html, [
    /class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i,
    /class="[^"]*topcard__title[^"]*"[^>]*>([\s\S]*?)<\//i,
    /<title>([\s\S]*?)<\/title>/i,
  ]);
  const hiring = title.match(/(.+?)\s+hiring\s+(.+?)\s+in\s+/i);
  if (hiring) title = hiring[2].trim();

  const company = firstMatch(html, [
    /class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    /data-tracking-control-name="public_jobs_topcard-org-name"[^>]*>([\s\S]*?)<\/a>/i,
  ]);
  let description = firstMatch(html, [
    /class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
  ]);
  description = description
    .replace(/Join to apply for[\s\S]*/i, "")
    .replace(/Sign in to[\s\S]*/i, "")
    .trim();

  const parts = [
    title && `Role: ${title}`,
    company && `Company: ${company}`,
    description,
  ].filter(Boolean);
  const text = parts.join("\n\n").trim();
  if (text.length < 80) throw new Error("LinkedIn page did not include a usable job description");
  return { text, title, company, source: "linkedin" };
}

async function fetchGeneric(url) {
  const reader = `https://r.jina.ai/${url}`;
  const res = await fetch(reader, { headers: { Accept: "text/plain" } });
  if (!res.ok) throw new Error(`Reader failed (${res.status})`);
  const text = (await res.text()).trim();
  if (text.length < 80) throw new Error("Could not extract enough text from this link");
  return { text, title: "", company: "", source: "reader" };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const url = String(body.url || "").trim();
    if (!url) {
      res.status(400).json({ error: "url required" });
      return;
    }
    let data;
    try {
      if (linkedinJobId(url)) data = await fetchLinkedIn(url);
      else data = await fetchGeneric(url);
    } catch (e) {
      // LinkedIn often blocks serverless IPs — fall back to reader
      if (linkedinJobId(url)) {
        try {
          data = await fetchGeneric(url);
        } catch {
          throw e;
        }
      } else {
        throw e;
      }
    }
    res.status(200).json({ ok: true, ...data });
  } catch (e) {
    res.status(502).json({ error: e?.message || "fetch failed" });
  }
}
