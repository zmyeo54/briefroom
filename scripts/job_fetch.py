"""Fetch + clean job posting text (LinkedIn guest API and generic pages)."""

from __future__ import annotations

import html as html_lib
import json
import re
import urllib.error
import urllib.parse
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
SEEK_HOST_RE = re.compile(r"(?:jobsdb|jobstreet|seek)\.", re.I)
SEEK_JOB_RE = re.compile(r"/job/(\d+)", re.I)
SEEK_JOB_QUERY = """
query($id: ID!) {
  jobDetails(id: $id) {
    job {
      id
      title
      content
      advertiser { name }
      location { label }
    }
  }
}
""".strip()


def linkedin_job_id(url: str) -> str | None:
    m = LINKEDIN_JOB_RE.search(url or "")
    return m.group(1) if m else None


def seek_job_id(url: str) -> str | None:
    u = url or ""
    if not SEEK_HOST_RE.search(u):
        return None
    m = SEEK_JOB_RE.search(u)
    return m.group(1) if m else None


def _seek_graphql_hosts(url: str) -> list[str]:
    hosts: list[str] = []
    try:
        p = urlparse(url)
        if p.scheme and p.hostname:
            hosts.append(f"{p.scheme}://{p.hostname}")
    except Exception:
        pass
    for h in (
        "https://hk.jobsdb.com",
        "https://www.seek.com.au",
        "https://sg.jobstreet.com",
    ):
        if h not in hosts:
            hosts.append(h)
    return hosts


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


def _parse_reader_meta(text: str) -> dict[str, str]:
    title = ""
    company = ""
    m = re.search(r"(?:^|\n)Title:\s*(.+)", text, re.I)
    if m:
        title = _strip_tags(m.group(1))
    m = re.search(r"(?:^|\n)(?:Company|Publisher):\s*(.+)", text, re.I)
    if m:
        company = _strip_tags(m.group(1))
    return {"title": title, "company": company}


def _fetch_google_cache(url: str) -> str | None:
    """Try Google Web Cache as a fallback for Cloudflare-protected sites."""
    try:
        cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{urllib.parse.quote(url)}"
        req = urllib.request.Request(
            cache_url,
            headers={
                "User-Agent": UA,
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as res:
            html = res.read().decode("utf-8", errors="replace")
        # Clean the cached HTML
        text = re.sub(r"(?is)<(script|style|noscript|svg|iframe)[^>]*>.*?</\1>", " ", html)
        text = re.sub(r"<[^>]+>", " ", text)
        text = html_lib.unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) >= 100 and "Just a moment" not in text:
            return text
    except Exception:
        pass
    return None


def _http_json(url: str, payload: dict, headers: dict | None = None, timeout: int = 25) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
            "Content-Type": "application/json",
            **(headers or {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8", errors="replace"))


def fetch_seek_job(url: str) -> dict[str, str]:
    """JobsDB / JobStreet / SEEK — GraphQL jobDetails (HTML is Cloudflare-walled)."""
    job_id = seek_job_id(url)
    if not job_id:
        raise ValueError("Not a SEEK / JobsDB job URL")

    last_err: Exception | None = None
    for host in _seek_graphql_hosts(url):
        try:
            data = _http_json(
                f"{host}/graphql",
                {"query": SEEK_JOB_QUERY, "variables": {"id": job_id}},
                headers={"Origin": host, "Referer": url or f"{host}/job/{job_id}"},
            )
            job = ((data.get("data") or {}).get("jobDetails") or {}).get("job") or {}
            title = str(job.get("title") or "").strip()
            content = str(job.get("content") or "")
            company = str(((job.get("advertiser") or {}).get("name")) or "").strip()
            location = str(((job.get("location") or {}).get("label")) or "").strip()
            description = _strip_tags(content)
            if not title or len(description) < 80:
                raise ValueError("SEEK job had too little description")
            lines = [
                f"Role: {title}" if title else "",
                f"Company: {company}" if company else "",
                f"Location: {location}" if location else "",
                "",
                description,
            ]
            text = "\n".join(ln for ln in lines if ln is not None).strip()
            return {
                "title": title,
                "company": company,
                "location": location,
                "description": description,
                "text": text,
                "sourceUrl": url,
                "jobId": job_id,
                "source": "seek",
            }
        except Exception as e:
            last_err = e
    raise ValueError(f"SEEK / JobsDB fetch failed ({last_err})") from last_err


def fetch_generic_page(url: str) -> dict[str, str]:
    # 1) Try Jina reader
    jina = f"https://r.jina.ai/{url}"
    try:
        text = _http_get(jina, timeout=40).strip()
        if len(text) >= 80 and "AbuseAlleviationError" not in text and "AuthenticationRequiredError" not in text:
            meta = _parse_reader_meta(text)
            return {"text": text, "sourceUrl": url, **meta}
    except Exception:
        pass

    # 2) Try Google cache (works for some Cloudflare-protected sites)
    cache_text = _fetch_google_cache(url)
    if cache_text:
        return {"text": cache_text, "sourceUrl": url, "title": "", "company": ""}

    # 3) Try direct HTTP fetch
    html = _http_get(url, timeout=30)
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
    if seek_job_id(url):
        return fetch_seek_job(url)
    return fetch_generic_page(url)
