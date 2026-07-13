---
name: generate-blog-post-idea
description: Generates 5 distinct blog post ideas from a given context (a topic, existing post, tech stack, code snippet, or rough note). Use when the user wants blog post ideas, content brainstorming, or help finding what to write about next. Goes beyond the literal input to surface adjacent, unexplored, or contrarian angles instead of just restating the given context.
---

# Generate Blog Post Idea

Generate 5 distinct, high-quality blog post ideas from whatever context the user provides (a topic, a link, an existing draft/post, a technology, a personal experience, a code snippet, etc.).

## Core principle

Do not just summarize or rephrase the input context into a title. The given context is a **seed**, not a boundary. Your job is to explore the surrounding idea-space and find angles the user likely hasn't considered.

## Workflow

1. **Absorb the context.** If the user points to a file, existing post, or repo, read it. If it's a topic/technology, use your own knowledge. If it's vague, ask one clarifying question only if truly necessary (e.g. missing target audience) — otherwise proceed with reasonable assumptions.

2. **Map the idea-space** before writing titles. Think across these lenses to find unexplored niches:
   - **Adjacent technologies/tools** — what pairs with or competes with the subject that nobody covers well?
   - **Failure/postmortem angle** — what breaks, what went wrong, lessons from production incidents.
   - **Beginner vs. expert gap** — a topic well covered for beginners but not for intermediate/advanced readers, or vice versa.
   - **Comparison/tradeoff angle** — X vs Y for a specific real use case, not a generic feature comparison.
   - **Opinion/contrarian angle** — a common practice challenged with reasoning and evidence.
   - **Under-the-hood/how-it-works angle** — explaining internals of a tool/library/protocol people use daily but don't understand.
   - **Migration/decision-making angle** — "when to move away from X", "how we chose between X and Y".
   - **Personal experience/case study angle** — a specific real project, numbers, and outcomes.
   - **Cross-domain angle** — combining the subject with an unrelated field (e.g. DevOps + cost engineering, frontend + accessibility law, AI + legacy systems).

   Pick 5 ideas that are spread across different lenses above — avoid proposing 5 ideas that are all minor variations of the same angle.

3. **For each of the 5 ideas, output:**
   - **Title** — a concrete, specific, non-generic working title (avoid "Introduction to X" style unless genuinely justified).
   - **Angle** — 1 sentence on what makes this idea distinct/unexplored.
   - **Why it's worth writing** — 1 sentence on reader value or gap in existing content.
   - **Rough outline** — 3-5 bullet points sketching the structure/sections.
   - **Target audience** — who this is written for (beginner/intermediate/advanced, which role).

4. **Diversity check.** Before finalizing, verify the 5 ideas:
   - Cover at least 3 different lenses from step 2.
   - Are not all obvious/expected extensions of the input context.
   - Include at least 1 idea that deliberately steps outside the given context into a related-but-different niche.

5. **If the site/repo has an existing blog** (e.g. a `content/` folder with posts), quickly check existing post titles/topics to avoid suggesting something already written, and to match tone/style/language conventions used (e.g. bilingual EN/TR posts, personal narrative style, technical depth level).

## Output format

Present as a numbered list of 5 ideas using the structure in step 3. Keep the total response focused — no filler intro/outro paragraphs beyond a one-line summary of the context used.

## Constraints

- Always produce exactly 5 ideas unless the user asks for a different number.
- Never produce 5 ideas that are trivial rewordings of each other.
- Do not restate the input context as an idea; use it only as a jumping-off point.
- Match the language of the input context (respond in Turkish if context/request is in Turkish, English otherwise), unless the user specifies otherwise.
