"""Fetch + clean job posting text (LinkedIn guest API and generic pages)."""

from __future__ import annotations

import html as html_lib
import re
import urllib.error
import urllib.request
from urllib.parse import urlparse

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

LINKEDIN_JOB_RE = re.compile(
    r"linkedin\.com/jobs/view/(?:[^/?#]*-)?(\d+)",
    re.I,
)


def linkedin_job_id(url: str) -> str | None:
    m = LINKEDIN_JOB_RE.search(url or "")
    return m.group(1) if m else None


def _http_get(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        charset = res.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def _strip_tags(chunk: str) -> str:
    text = html_lib.unescape(chunk)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n\n", text)
    text = re.sub(r"(?i)</h[1-6]\s*>", "\n\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "\n- ", text)
    text = re.sub(r"(?i)</li\s*>", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _first(patterns: list[str], html: str) -> str:
    for pat in patterns:
        m = re.search(pat, html, re.I | re.S)
        if m:
            val = _strip_tags(m.group(1))
            if val:
                return val
    return ""


def parse_linkedin_guest_html(html: str) -> dict[str, str]:
    title = _first(
        [
            r'class="[^"]*top-card-layout__title[^"]*"[^>]*>(.*?)</h2>',
            r'class="[^"]*topcard__title[^"]*"[^>]*>(.*?)</',
            r"<title>(.*?)</title>",
        ],
        html,
    )
    # Title tags often look like "Resmed hiring Senior Business Analyst..."
    if " hiring " in title.lower() and " | " in title:
        # Prefer h2 if we already have a short title; else parse <title>
        pass
    if len(title) > 120 or "linkedin" in title.lower():
        hiring = re.search(
            r"(.+?)\s+hiring\s+(.+?)\s+in\s+",
            title,
            re.I,
        )
        if hiring:
            title = hiring.group(2).strip()

    company = _first(
        [
            r'class="[^"]*topcard__org-name-link[^"]*"[^>]*>(.*?)</a>',
            r'class="[^"]*topcard__flavor--black-link[^"]*"[^>]*>(.*?)</a>',
            r'data-tracking-control-name="public_jobs_topcard-org-name"[^>]*>(.*?)</a>',
        ],
        html,
    )
    location = _first(
        [
            r'class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>(.*?)</span>',
            r'class="[^"]*topcard__flavor[^"]*topcard__flavor--bullet[^"]*"[^>]*>(.*?)</',
        ],
        html,
    )
    description = _first(
        [
            r'class="[^"]*show-more-less-html__markup[^"]*"[^>]*>(.*?)</div>',
            r'class="[^"]*description__text[^"]*"[^>]*>(.*?)</div>\s*</div>',
            r'class="[^"]*core-section-container__content[^"]*"[^>]*>(.*?)</div>',
        ],
        html,
    )

    # Drop login-wall noise if it leaked in
    noise = [
        r"Join to apply for.*",
        r"Sign in to.*",
        r"New to LinkedIn\?.*",
        r"By clicking Continue to join.*",
        r"Forgot password\?.*",
    ]
    for n in noise:
        description = re.sub(n, "", description, flags=re.I | re.S)

    description = description.strip()
    if len(description) < 80:
        raise ValueError("LinkedIn page did not include a usable job description")

    lines = [
        f"Job title: {title}" if title else "",
        f"Company: {company}" if company else "",
        f"Location: {location}" if location else "",
        "",
        "Job description:",
        description,
    ]
    text = "\n".join([ln for ln in lines if ln is not None]).strip()
    return {
        "title": title,
        "company": company,
        "location": location,
        "description": description,
        "text": text,
    }


def fetch_linkedin_job(url: str) -> dict[str, str]:
    job_id = linkedin_job_id(url)
    if not job_id:
        raise ValueError("Not a LinkedIn job URL")

    guest = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    try:
        html = _http_get(guest)
    except urllib.error.HTTPError as e:
        # Regional host fallback from original URL
        host = urlparse(url).hostname or "www.linkedin.com"
        guest2 = f"https://{host}/jobs-guest/jobs/api/jobPosting/{job_id}"
        if guest2 != guest:
            html = _http_get(guest2)
        else:
            raise ValueError(f"LinkedIn guest fetch failed ({e.code})") from e

    parsed = parse_linkedin_guest_html(html)
    parsed["sourceUrl"] = url
    parsed["jobId"] = job_id
    return parsed


def fetch_generic_page(url: str) -> dict[str, str]:
    # Prefer Jina reader from the server (no browser CORS)
    jina = f"https://r.jina.ai/{url}"
    try:
        text = _http_get(jina, timeout=40).strip()
        if len(text) >= 80 and "AbuseAlleviationError" not in text:
            return {"text": text, "sourceUrl": url}
    except Exception:
        pass

    html = _http_get(url, timeout=30)
    # crude title
    title = _first([r"<title>(.*?)</title>"], html)
    body = re.sub(
        r"(?is)<(script|style|noscript|svg|iframe)[^>]*>.*?</\1>",
        " ",
        html,
    )
    text = _strip_tags(body)
    if len(text) < 80:
        raise ValueError("Page had too little readable text")
    if title and title.lower() not in text.lower()[:200]:
        text = f"{title}\n\n{text}"
    return {"text": text, "sourceUrl": url, "title": title}


def fetch_job_text(url: str) -> dict[str, str]:
    url = (url or "").strip()
    if not url:
        raise ValueError("URL required")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url

    if linkedin_job_id(url):
        return fetch_linkedin_job(url)
    return fetch_generic_page(url)
