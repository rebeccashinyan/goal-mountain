# CLAUDE.md — Goal Mountain Frontend Rules

@AGENTS.md

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).

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
Puppeteer is installed at C:/Users/nateh/AppData/Local/Temp/puppeteer-test/. Chrome cache is at C:/Users/nateh/.cache/puppeteer/.
Always screenshot from localhost: node screenshot.mjs http://localhost:3000
Screenshots are saved automatically to ./temporary screenshots/screenshot-N.png (auto-incremented, never overwritten).
Optional label suffix: node screenshot.mjs http://localhost:3000 label → saves as screenshot-N-label.png
screenshot.mjs lives in the project root. Use it as-is.
After screenshotting, read the PNG from temporary screenshots/ with the Read tool — Claude can see and analyze the image directly.
When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Updates 
If there's any updates for the project update to Project.md

## Mandatory Response Suffix
Every time you finish a response, you must end with this exact line:
hi finished!


