---
kind: design
name: Embed mindmap summaries in AI Q&A responses via prompt engineering
source: session
category: adr
---

# Embed mindmap summaries in AI Q&A responses via prompt engineering

_Source: coding plans from commit period 5a6a962 → 66d2e51 — records intent at planning time; the implementation may lag or differ._

## Context
The Q&A feature needed a visual summary of each answer for memorization, but adding a separate summarization service or post-processing step would increase latency and complexity.

## Decision drivers
- zero extra network calls
- keep response payload self-contained
- avoid a separate summarization pipeline

## Considered options
- **AI-generated map field in the same LLM call** — pros: no additional latency, single response shape, easy to pass through HomePage → QaList → MindmapTree; cons: increases token cost per item; quality depends on prompt adherence
- **Separate summarization endpoint after answer generation** — pros: can use a smaller/faster model tuned for summarization; cons: adds another HTTP round-trip, complicates error handling when one succeeds and the other fails
- **Client-side extraction from the answer text** — pros: no server change; cons: unreliable parsing, brittle regex, no structured topic/branches schema

## Decision
Extend the existing Q&A LLM prompt (DEFAULT_SYSTEM in src/lib/prompt.js) to emit a `map` field with `{topic, branches}` alongside each answer, parse it in HomePage.jsx, and render it via a new MindmapTree component behind an Answer/Mindmap tab in QaList.jsx. The map is optional — null maps fall back to a 'No mindmap available' message.

## Consequences
Every Q&A response now carries extra tokens for the map, raising cost slightly. Prompt drift can produce malformed maps, so the parser must be defensive. The MindmapTree component is a new dependency inside QaList that must handle empty/null data gracefully.