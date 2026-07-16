# Development Rules & Conventions

## Git Workflow

### Branch Strategy
```
main (protected)
  │
  ├── feat/userscript-extraction
  ├── feat/lobby-lineup
  ├── feat/match-engine
  └── fix/...
```

### Commit Convention
```
type(scope): message

Types:
  feat     - New feature
  fix      - Bug fix
  chore    - Maintenance (deps, config)
  docs     - Documentation only
  refactor - Code restructure (no behavior change)
  test     - Adding tests
  perf     - Performance improvement

Scopes:
  userscript, lobby, lineup, match, ai, db, ui, deploy

Examples:
  feat(userscript): add export button injection
  fix(match): handle host disconnect during round
  chore(db): add index on team claim_status
  docs(readme): update deployment instructions
```

### Commit Rules
- **Commit after every logical task completion** (not every prompt)
- **No direct pushes to main** - PR required
- **Squash merge** to main
- **Delete branch** after merge

### Pre-commit (Husky)
```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```
Runs: ESLint + Prettier + TypeScript check

---

## Code Standards

### TypeScript
- **Strict mode**: `"strict": true` in tsconfig
- **No `any`** - use `unknown` or proper types
- **Explicit return types** for public functions
- **Zod schemas** for API validation + Socket payloads
- **Shared types** in `src/lib/types` (or `packages/shared-types`)

### React/Next.js
- **Server Components by default** - only `'use client'` when needed
- **Client Components**: Interactive UI, Socket.io, drag-drop, animations
- **Server Actions** for mutations (create room, lock lineup)
- **Route Handlers** for webhook/API endpoints
- **Suspense boundaries** for async components

### Styling (Tailwind)
- **Utility-first** - no custom CSS files
- **Design tokens** in `tailwind.config.ts` (colors, fonts, spacing)
- **Component variants** with `class-variance-authority` (cva)
- **Dark mode only** - base is dark, no `dark:` prefix needed

### Database (Prisma)
- **All queries via Prisma Client** - no raw SQL
- **Transactions** for multi-model operations
- **Select/Include** precisely - avoid over-fetching
- **Middleware** for soft deletes, timestamps (if needed)

### Socket.io
- **Typed events** via shared Zod schemas
- **Acknowledge callbacks** for critical operations
- **Room naming**: `room:{roomId}`, `user:{socketId}`
- **Connection lifecycle**: Join on mount, leave on unmount

---

## API Design

### REST Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/import-room` | Userscript data import |
| GET | `/api/room/:roomId` | Initial room state (SSR) |
| POST | `/api/room/:roomId/lineup` | Save lineup (Server Action preferred) |
| POST | `/api/rank-players` | Grok AI ranking |

### Response Format
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string } }
```

---

## Userscript Rules

- **Minimal permissions**: `@grant GM_xmlhttpRequest`, `@connect arena.app`
- **No data persistence** except temporary export state
- **Content script** communicates via `window.postMessage` if needed
- **Build output**: Single `.user.js` with metadata header
- **Version**: Increment in `package.json`, auto-injected at build
- **Update URL**: Raw GitHub URL for auto-updates

---

## AI Prompt Rules

- **Structured output only** - JSON schema enforced
- **Prompt versioning** in code (not external files)
- **Deterministic fallback** if AI fails (price-based ranking)
- **Token limits**: Max 2000 tokens per request
- **Caching**: Cache by `(roundNumber, position, playerIdsHash)`

---

## Security

- **No authentication** - room code is the secret
- **Rate limiting**: 
  - `/api/import-room`: 10/min/IP
  - `/api/rank-players`: 30/min/room
- **CORS**: Only `arena.app` origin for Socket.io
- **Input validation**: Zod on all API routes
- **Socket authorization**: Room membership verified on join

---

## Testing Strategy

- **Unit**: Utility functions (points calc, prompt builder)
- **Integration**: API routes, Prisma queries
- **E2E**: Playwright for critical flows (join → lineup → match)
- **Manual**: Play with 4+ friends before each deploy

---

## Documentation (Living Documents)

All 8 markdown files in project root are **living documents**:
- `Product-requirement-document.md` - Update when scope changes
- `Tech-specifications.md` - Update when tech decisions change
- `Appflow.md` - Update when user flows change
- `Design.md` - Update when UI/UX changes
- `schema.md` - Update when Prisma schema changes (run `prisma migrate dev` after)
- `implementation-plan.md` - Update task statuses (⬜/🟨/✅) each phase
- `rules.md` - Project rules (this file)
- `Tracker.md` - Progress tracker with timestamps

**Update relevant files in every commit where changes occur.**