---
name: write-blog-post
description: Writes a full English blog post for this site under content/english/posts/, using advanced SEO techniques and storytelling flow, matching the existing post style/frontmatter. Use when the user gives a title (and optionally a rough topic/idea) and wants a complete post drafted. After drafting, spins up a "griller" subagent to critique the post, fixes issues in the main agent, then spins up a translator subagent to produce a Turkish version under content/turkish/posts/.
---

# Write Blog Post

Produce a publish-ready English blog post from a title (+ optional rough idea), then critique-and-fix it, then translate it to Turkish. This is a multi-phase workflow — do not skip phases or merge the critique step into drafting.

## Phase 0 — Intake

- Required input: a **title**. Optional: a rough topic/idea/angle.
- If the topic is vague, do NOT stop to ask clarifying questions unless something blocking is missing (e.g. title itself). Make reasonable technical assumptions based on Berk's known stack (`.NET`/C#, microservices, Vue, Docker, Keycloak, feature flags, AI/LLM tooling) and proceed.
- Derive the file slug: kebab-case of the title, matching existing filename conventions (e.g. `feature-flagging-in-dotnet-with-openfeature-and-flagd.md`).

## Phase 1 — Learn the house style (do this every time, don't rely on memory)

Read 2-3 existing posts from `content/english/posts/` before writing (pick ones topically closest to the new post if possible, otherwise any recent ones e.g. `feature-flagging-in-dotnet-with-openfeature-and-flagd.md`, `events-vs-commands-in-software-architecture-a-complete-dotnet-guide.md`, `refactoring-from-an-anemic-to-a-rich-domain-model-in-dotnet.md`). Extract:

- **Frontmatter** (TOML, `+++` delimited):
  ```toml
  +++
  title = "..."
  date = "YYYY-MM-DDT00:00:00+03:00"
  author = "Berk Selvi"
  authorTwitter = "berkslv" #do not include @
  keywords = ["kw1","kw2","kw3"]
  description = "..."
  showFullContent = false
  readingTime = true
  cover = "img/<slug>/cover.jpg"
  +++
  ```
  Use today's actual date for `date`. `cover` path always follows `img/<slug>/cover.<ext>` — the image file itself likely does NOT exist yet (see Phase 2 note).

- **Voice**: first-person, practitioner tone ("I", "we"), grounded in real production experience/pain points, not generic tutorial-speak.
- **Structure**: `##` for major sections, `###` sparingly for subsections. Common recurring pattern: hook/problem → "the old way" (pain, code example of the bad approach) → "why X" (the better tool/technique) → concrete real-life walkthrough with code blocks → wrap-up/reflection.
- **Code blocks**: fenced with language identifier (```csharp, ```bash, ```json, etc.), often preceded by a blank line inside the fence in this codebase's style — mirror what you observe in the sampled posts.
- **Images**: `<img src="/img/<slug>/name.ext" alt="..." loading="lazy" />` followed by `<p class="image-sub-title">Caption</p>` on the next line. Only include these if the post genuinely needs illustrative screenshots — do not fabricate placeholder images for a code-heavy conceptual post unless the sampled posts in that vein use them.
- **Links**: inline markdown links to real, relevant external docs/tools (e.g. `[OpenFeature](https://openfeature.dev/)`).

## Phase 2 — Draft the post

Write directly to `content/english/posts/<slug>.md`.

Apply these techniques concretely (don't just gesture at them):

**SEO**
- Title: concrete and specific, matches user's given title exactly (don't rewrite it) unless it's clearly broken.
- `description`: 150-160 characters, includes primary keyword(s) naturally, states the concrete value/outcome of reading.
- `keywords`: 4-8 specific terms (tech names, patterns, tools) actually used in the body — no generic filler like "programming" or "software".
- Headings (`##`/`###`) should be descriptive and keyword-relevant, not cute/vague ("Why flagd?" not "A Cool Tool").
- Front-load the core value/problem in the first 2-3 sentences — a reader (and search snippet) should immediately understand what problem this post solves.
- Naturally repeat primary keyword phrases across intro, at least one heading, and conclusion — without keyword stuffing.
- Prefer concrete, specific numbers/versions/tool names over vague claims.

**Storytelling / flow**
- Open with a hook: a real pain point, a production incident, a question, or a concrete scenario — not "In this post I will explain...".
- Use a problem → context → tension → resolution arc. The "old/naive way" vs "better way" contrast pattern seen in existing posts (e.g. env vars vs OpenFeature) works well when applicable — reuse it when the topic has a "before/after" shape.
- Break up long technical stretches with short transition sentences that re-orient the reader ("So where does this leave us?", "Here's the catch:").
- Ground abstractions immediately with a code example or concrete scenario — never leave a concept purely abstract for more than a paragraph.
- End with a real reflection/closing section — lessons learned, trade-offs, or what to explore next — not just a summary restatement.
- Vary sentence length; avoid uniform robotic paragraph rhythm.

**Compatibility**
- Match heading depth, tone, and frontmatter shape exactly to sampled posts.
- If a cover image is referenced but doesn't exist under `static/img/<slug>/`, tell the user explicitly at the end of the workflow that they need to add `static/img/<slug>/cover.jpg` (or matching ext) — do not attempt to generate a binary image file.

## Phase 3 — Grill it (critique subagent)

Spin up a **general** subagent (fresh context) with a detailed, self-contained prompt. It cannot see this conversation, so give it everything it needs:

- Instruct it to read the newly drafted file at `content/english/posts/<slug>.md`.
- Instruct it to also read 2-3 other existing posts in `content/english/posts/` for calibration of expected quality/style.
- Ask it to act as a harsh, specific editor/critic — not a cheerleader. It must find real problems, not generic praise. Cover at minimum:
  - SEO: weak/missing keyword usage, bad description length, vague headings, thin content sections, missed internal-linking-worthy concepts.
  - Storytelling/flow: where the narrative arc breaks, sections that read as generic filler, weak opening hook, weak or abrupt ending, inconsistent tone, repetitive sentence structure.
  - Technical accuracy: flag anything that looks wrong, outdated, or unsupported for the technologies discussed.
  - Style compatibility: anything that doesn't match the voice/structure of the sampled existing posts.
- Require the subagent's final message to return ONLY a concrete, itemized list of problems (with quoted excerpts or section names) — no rewriting, no fixing, just diagnosis.

## Phase 4 — Fix

Back in the main agent: review the griller's feedback, decide which points are valid (use judgment — reject nitpicks that would break house style), and directly edit `content/english/posts/<slug>.md` to address the valid issues. Briefly tell the user what was flagged and what you changed/rejected and why.

## Phase 5 — Translate (translator subagent)

Spin up a second **general** subagent (fresh context) with a self-contained prompt to produce the Turkish version:

- Instruct it to read the finalized `content/english/posts/<slug>.md`.
- Instruct it to also read 1-2 existing Turkish posts from `content/turkish/posts/` (e.g. `how-to-secure-dotnet-vue-application-with-keycloak.md`) to learn Turkish frontmatter/style conventions.
- Requirements for the translation:
  - Same TOML frontmatter shape, but `title`, `description`, and (where sensible) `keywords` translated/localized to natural Turkish — not a literal word-for-word translation of keywords if a Turkish practitioner would search differently.
  - Same `date`, `author`, `authorTwitter`, `showFullContent`, `readingTime` fields as the English version.
  - `cover` path mirrors the English one's slug (same `img/<slug>/cover.ext`).
  - Body translated to natural, fluent technical Turkish matching the register used in existing Turkish posts (informal-professional, first-person) — do not translate code, code comments in code blocks should stay as-is unless the sampled Turkish posts show translated comments, tool/library/product names, or established English technical terms that Turkish developers use as-is (e.g. "deployment", "pipeline", "feature flag" often stay in English within Turkish text — check sampled posts for what's kept vs translated).
  - Preserve all code blocks, links, and image tags exactly (only translate `alt` text and captions if the sampled posts do so).
  - Write the result to `content/turkish/posts/<slug>.md` (same slug as the English file).
- Require the subagent to return the file path it wrote and a short note on any terms it deliberately left in English.

## Phase 6 — Wrap up

Report to the user:
- Path to the English post and Turkish post created.
- Summary of griller feedback and what was fixed vs. rejected.
- Any missing assets the user must add manually (cover images).
- Do not commit/push unless explicitly asked.
