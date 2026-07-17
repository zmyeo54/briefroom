import html2pdf from "html2pdf.js";
import { downloadBlob } from "./tts.js";

function slugify(text) {
  return (
    String(text || "")
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "interview"
  );
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintHtml(items, { jobTitle, company, candidateName, brand }) {
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const headline = jobTitle || "Interview Practice Set";
  const sub = [company, candidateName].filter(Boolean).join(" · ");

  const rows = items
    .map((item, i) => {
      const q = escapeHtml(item.q || "").replace(/\n/g, "<br/>");
      const a = escapeHtml(item.a || "—").replace(/\n/g, "<br/>");
      return `
        <article class="qa-block">
          <p class="qa-num">Q${i + 1}</p>
          <h2 class="qa-q">${q}</h2>
          <div class="qa-a">${a}</div>
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
</style>
</head>
<body>
  <div class="page">
    <header class="mast">
      <p class="brand">${escapeHtml(brand)}</p>
      <h1>${escapeHtml(headline)}</h1>
      ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}
      <p class="date">${escapeHtml(date)} · ${items.length} Q&amp;A</p>
    </header>
    ${rows}
  </div>
</body>
</html>`;
}

/**
 * Export selected Q&A as a formatted PDF (one file, merged in order).
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
  const filename = `linecheck-${slugify(options.jobTitle)}-${stamp}.pdf`;

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
