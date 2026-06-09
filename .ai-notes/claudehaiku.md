# Claude Haiku Approach for NodeCommerce

## Overview
Haiku (claude-haiku-4.5) is a fast, efficient model optimized for smaller tasks and iterative work. This document outlines how Haiku will handle the NodeCommerce project given the current codebase state and constraints.

## Current Project State (as of June 4, 2026)

### Foundation (Gemini's Setup)
- **Framework**: Next.js 16.2.7 (fresh setup with breaking changes)
- **Build Stack**: React 19.2.4, TypeScript 5, Tailwind CSS 4, ESLint 9
- **Backend**: Supabase (@supabase/supabase-js, @supabase/ssr)
- **Structure**: Daraz-like e-commerce layout with layout, categories, flash sale, and product sections
- **API Routes**: Tracking, payment, predictions, profile creation, backfill events
- **Data**: Demo products, seed files, payment methods data stored in JSON

### Codebase Artifacts
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Reusable UI components (products-browser, landing, login modal)
- `src/data/` — Demo data and seed datasets
- `src/lib/` — Utilities for tracking and fake payment handling
- `db/schemas.sql` — Database schema definition

## Haiku's Constraints & Strengths

### Strengths
✓ Fast iteration on small-to-medium features  
✓ Efficient code generation for focused tasks  
✓ Good at debugging and fixing specific issues  
✓ Lightweight for exploratory work  

### Constraints
✗ Smaller context window — may need to focus on specific files/tasks  
✗ Less suitable for large architectural refactors  
✗ May require more back-and-forth for complex domain work  

### When to Escalate
- Large system-wide refactors → consider Sonnet/Opus
- Complex architectural decisions → escalate to planning phase
- Multi-day, context-heavy projects → consider switching models

## Haiku's Core Guidelines for NodeCommerce

### 1. Next.js 16 Breaking Changes Handling
**CRITICAL**: Before writing any Next.js/React code:
- Check `node_modules/next/dist/docs/` for relevant guides
- Verify API compatibility (App Router, Server Components, etc.)
- Read deprecation notices before using patterns
- Flag any assumptions about Next.js based on older versions

### 2. Code Quality Standards
- Prefer reading existing files before suggesting modifications
- Only modify necessary code — avoid over-engineering
- Follow Tailwind CSS patterns already in place (minimal color use, utility-first)
- Maintain TypeScript strict mode compliance

### 3. Task Scope Management
- Break large requests into focused sub-tasks
- Use TodoWrite for multi-step work
- Escalate architectural questions via EnterPlanMode for alignment
- Communicate blockers early without silent failures

### 4. Database & Supabase Integration
- Respect existing Supabase setup (@supabase/ssr for server-side access)
- Seed data workflows in seed-*.js files
- Schema changes coordinated with `db/schemas.sql`
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 5. API Development
- Existing routes: `/api/track`, `/api/fake-payment`, `/api/predict-demand`, `/api/create-profile`, `/api/backfill-events`
- Keep APIs focused and single-responsibility
- Use type-safe request/response patterns
- Document new endpoints clearly

## Workflow for Feature Requests

1. **Clarify** → Ask if scope is clear or suggest focused MVP
2. **Read** → Examine relevant code files first
3. **Plan** (if needed) → Use EnterPlanMode for architectural questions
4. **Implement** → Write code with backward compatibility in mind
5. **Test** → Run `npm run dev` and `npm run build` to validate
6. **Commit** → Atomic, well-described commits via git

## Known Patterns in This Codebase

- **UI Structure**: Flexbox-first, 16-column product grids, Daraz-inspired layout
- **Styling**: Tailwind utilities (orange-500 accent color, gray-scale base, shadow-sm for subtle elevation)
- **Data**: JSON files for seed/demo, SQL schema in `db/schemas.sql`, Supabase row-level security likely needed
- **Components**: Modular and reusable, prefixed with function names (e.g., `products-browser-demo`)
- **API Routes**: Use Next.js route handlers with TypeScript, return JSON responses

## What Haiku Will NOT Do

✗ Silently break Next.js upgrade compatibility  
✗ Add features beyond the request scope  
✗ Over-abstract or over-generalize code  
✗ Commit without asking for risky operations (force push, destructive deletes, etc.)  
✗ Guess at project architecture — will ask/plan instead  

## How to Request Work from Haiku

**Effective request format**:
- Clear task: "Add a product detail page"
- Context: "Link from the product grid cards"
- Success criteria: "Page loads product data from Supabase and displays specs"
- Optional: "Use existing product-card component for consistency"

**Less effective requests**:
- "Make the app faster" (vague — need profiling/specific targets)
- "Refactor everything" (too large — focus on one area)
- "Add authentication" (likely too complex for one task — break it down)

---

**Last Updated**: June 4, 2026  
**Model**: Claude Haiku 4.5  
**Status**: Ready for feature work within scope constraints
