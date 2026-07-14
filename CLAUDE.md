# CLAUDE.md — Goal Mountain Frontend Rules

@AGENTS.md

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Think First, Align Once, Then Execute

Before executing any frontend, backend, database, or documentation change, first think through the user's request and make sure the intended outcome is clear.

Claude should not blindly execute a request if important product, design, technical, or content details are missing.

If the request is unclear, incomplete, risky, conflicts with the current product direction, or has multiple reasonable interpretations, Claude should pause before implementation and discuss the main direction with me first.

If Claude has a different opinion, does not agree with the requested change, or believes there is a stronger product, design, technical, or content approach, Claude should not immediately execute. It should pause, explain the concern, state its recommended approach, and ask me to confirm the direction before implementation.

After thinking through the request, Claude should do one of two things:

1. If the request is clear and aligned with the project direction, briefly state:
"Finished thinking — executing now."
Then proceed with the implementation without asking for confirmation.

2. If the request is unclear, incomplete, risky, or Claude disagrees with the direction, briefly explain the concern, state the recommended approach, and ask me to confirm before executing.

After the main direction is confirmed, Claude should execute the full task independently without repeatedly asking for small sub-decisions.

Claude should make reasonable implementation decisions on its own for details such as spacing, component structure, naming, minor layout adjustments, and code organization, as long as they follow the confirmed direction and existing project rules.

Claude should only stop again if it discovers a major issue that changes the product direction, architecture, database structure, or user experience.

The goal is:
- Think before acting
- Clarify the intention once when needed
- Raise concerns when Claude disagrees or sees a better approach
- Then execute confidently
- Do not blindly follow unclear or weak instructions
- Do not interrupt constantly for minor details

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (configured in project)
- **AI:** OpenAI API (server-side only via `lib/openai.ts`)
- **Database:** Supabase (via `lib/supabase.ts`)
- **Platform:** macOS

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `npm run dev` (serves at `http://localhost:3000`)
- If the server is already running, do not start a second instance.

## Output Defaults
- Next.js pages in `app/` directory using App Router conventions
- Components in `components/` directory
- Tailwind CSS for all styling (project-configured, no CDN)
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive
- Server components by default; add `"use client"` only when needed

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

## Screenshot Workflow
Puppeteer is installed as a dev dependency in this project (Chrome is downloaded to ~/.cache/puppeteer/).
Always screenshot from localhost: node screenshot.mjs http://localhost:3000
Screenshots are saved automatically to ./temporary screenshots/screenshot-N.png (auto-incremented, never overwritten).
Optional label suffix: node screenshot.mjs http://localhost:3000 label → saves as screenshot-N-label.png
screenshot.mjs lives in the project root. Use it as-is.
After screenshotting, read the PNG from temporary screenshots/ with the Read tool — Claude can see and analyze the image directly.
When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Updates 
If there's any updates for the project update to Project.md
After updating Project.md, reply with:
Updated in Project.md

If there's any updates for the project update to AGENTS.md
After updating Project.md, reply with:
Updated in AGENTS.md

If there's any updates for the project update to UI_SPEC.md
After updating Project.md, reply with:
Updated in UI_SPEC.md

If there's any updates for the project update to DATABASE.md
After updating Project.md, reply with:
Updated in DATABASE.md

If there's any updates for the project update to CLAUDE.md
After updating Project.md, reply with:
Updated in CLAUDE.md

## Change Summary
- After completing any change, end the reply with one line in this format:
  **Change:** <a few words describing what changed>
- Keep it under ~10 words, plain language, no file paths or code details.
- Example: **Change:** removed eyebrow label from Planning Agent card


