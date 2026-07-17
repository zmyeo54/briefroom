import html2pdf from "html2pdf.js";
import { downloadBlob } from "./tts.js";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Title-case a string for professional filenames. */
function titleCase(text) {
  return String(text || "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+-\s+/g, " - ")
    .slice(0, 60);
}

/**
 * Build a printable mindmap HTML block from map data.
 * Uses pure CSS table-like layout for PDF compatibility (no SVG/JS).
 */
function buildMindmapHtml(map) {
  if (!map || !map.topic || !Array.isArray(map.branches) || !map.branches.length) {
    return "";
  }

  const topic = escapeHtml(map.topic);
  const topicZh = map.topicZh ? `<span class="mm-topic-zh">${escapeHtml(map.topicZh)}</span>` : "";

  const branchColors = ["#c49a3c", "#4a7ff8", "#ff7648", "#c5b4e3", "#4a9ff8"];

  const branches = map.branches.map((b, idx) => {
    const color = branchColors[idx % branchColors.length];
    const label = escapeHtml(b.label || "");
    const labelZh = b.labelZh ? `<span class="mm-branch-zh">${escapeHtml(b.labelZh)}</span>` : "";
    const detail = b.detail ? `<span class="mm-detail">${escapeHtml(b.detail)}</span>` : "";
    const example = b.example ? `<span class="mm-example">${escapeHtml(b.example)}</span>` : "";

    return `
      <div class="mm-branch-row">
        <div class="mm-connector" style="background:${color}"></div>
        <div class="mm-branch-card">
          <span class="mm-label" style="border-left:3px solid ${color}">${label}</span>
          ${labelZh}
          ${detail}
          ${example}
        </div>
      </div>`;
  }).join("");

  return `
    <div class="mm-wrap">
      <div class="mm-topic">
        <span class="mm-topic-text">${topic}</span>
        ${topicZh}
      </div>
      <div class="mm-branches">${branches}</div>
    </div>`;
}

function buildPrintHtml(items, { jobTitle, company, candidateName, brand }) {
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const headline = jobTitle || "Interview Practice Set";
  const sub = [company, candidateName].filter(Boolean).join("  ·  ");

  const rows = items
    .map((item, i) => {
      const q = escapeHtml(item.q || "").replace(/\n/g, "<br/>");
      const a = escapeHtml(item.a || "—").replace(/\n/g, "<br/>");
      const mindmap = buildMindmapHtml(item.map);
      const mindmapSection = mindmap
        ? `<div class="qa-mindmap"><p class="mm-heading">Key Points</p>${mindmap}</div>`
        : "";

      return `
        <article class="qa-block">
          <p class="qa-num">Q${i + 1}</p>
          <h2 class="qa-q">${q}</h2>
          <div class="qa-a">${a}</div>
          ${mindmapSection}
        </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #1a1d21;
    background: #fff;
    font-size: 11pt;
    line-height: 1.55;
  }
  .page {
    width: 170mm;
    margin: 0 auto;
    padding: 4mm 0 8mm;
  }
  .mast {
    border-bottom: 2px solid #4a7ff8;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .brand {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #4a7ff8;
    margin-bottom: 6px;
  }
  h1 {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: #111;
    margin-bottom: 4px;
  }
  .sub, .date {
    font-size: 10pt;
    color: #5c6570;
  }
  .date { margin-top: 6px; }
  .qa-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 16px;
    padding: 12px 14px;
    border: 1px solid #e8ecf0;
    border-radius: 8px;
    background: #fafbfc;
  }
  .qa-num {
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #4a7ff8;
    margin-bottom: 6px;
  }
  .qa-q {
    font-size: 12pt;
    font-weight: 700;
    line-height: 1.35;
    color: #111;
    margin-bottom: 10px;
  }
  .qa-a {
    font-size: 10.5pt;
    color: #2a3038;
    white-space: pre-wrap;
  }

  /* ─── Mindmap Section ─────────────────────────────────────────── */
  .qa-mindmap {
    margin-top: 12px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #eef0f2;
    border-radius: 8px;
  }
  .mm-heading {
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #c49a3c;
    margin-bottom: 8px;
  }
  .mm-wrap {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .mm-topic {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    background: linear-gradient(135deg, #c49a3c, #a67c2e);
    color: #fff;
    border-radius: 10px;
    text-align: center;
    width: 90px;
    min-height: 52px;
    box-shadow: 0 2px 6px rgba(196, 154, 60, 0.25);
  }
  .mm-topic-text {
    font-size: 8.5pt;
    font-weight: 700;
    line-height: 1.25;
    word-break: break-word;
    hyphens: auto;
  }
  .mm-topic-zh {
    font-size: 6.5pt;
    opacity: 0.85;
    margin-top: 3px;
    line-height: 1.2;
  }
  .mm-branches {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .mm-branch-row {
    display: flex;
    align-items: center;
    gap: 0;
  }
  .mm-connector {
    flex-shrink: 0;
    width: 10px;
    height: 2px;
    border-radius: 1px;
  }
  .mm-branch-card {
    flex: 1;
    padding: 5px 10px;
    background: #fff;
    border: 1px solid #eef0f2;
    border-radius: 6px;
    min-width: 0;
  }
  .mm-label {
    display: block;
    font-size: 9.5pt;
    font-weight: 700;
    color: #1a1d21;
    line-height: 1.3;
    padding-left: 6px;
  }
  .mm-branch-zh {
    display: block;
    font-size: 7pt;
    color: #8a8a8a;
    margin-top: 1px;
    padding-left: 6px;
  }
  .mm-detail {
    display: block;
    font-size: 7.5pt;
    color: #6b7280;
    margin-top: 2px;
    padding-left: 6px;
    line-height: 1.3;
  }
  .mm-example {
    display: block;
    font-size: 7pt;
    color: #9ca3af;
    font-style: italic;
    margin-top: 1px;
    padding-left: 6px;
  }

  @media print {
    .qa-block { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="page">
    <header class="mast">
      <p class="brand">${escapeHtml(brand)}</p>
      <h1>${escapeHtml(headline)}</h1>
      ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}
      <p class="date">${escapeHtml(date)}  ·  ${items.length} Q&amp;A</p>
    </header>
    ${rows}
  </div>
</body>
</html>`;
}

/**
 * Export selected Q&A as a formatted PDF with mindmaps.
 * Returns number of items included.
 */
export async function exportQaPdf(items, options = {}) {
  const list = (items || []).filter((it) => it?.a?.trim() || it?.q?.trim());
  if (!list.length) throw new Error("Nothing to export");

  const html = buildPrintHtml(list, {
    jobTitle: options.jobTitle || "",
    company: options.company || "",
    candidateName: options.candidateName || "",
    brand: options.brand || "Line Check",
  });

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-9999px;top:0;width:170mm;opacity:0;pointer-events:none;";
  host.innerHTML = html;
  document.body.appendChild(host);

  const stamp = new Date().toISOString().slice(0, 10);
  const parts = ["Line Check"];
  if (options.jobTitle) parts.push(titleCase(options.jobTitle));
  if (options.candidateName) parts.push(titleCase(options.candidateName));
  parts.push(stamp);
  const filename = `${parts.join(" - ")}.pdf`;

  try {
    const blob = await html2pdf()
      .set({
        margin: [10, 12, 10, 12],
        filename,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(host.querySelector(".page") || host)
      .outputPdf("blob");

    downloadBlob(blob, filename);
    return list.length;
  } finally {
    host.remove();
  }
}
