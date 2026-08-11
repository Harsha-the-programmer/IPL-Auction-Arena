# Tech Specifications

## Technology Stack

| Layer                      | Technology                            | Version | Rationale                                      |
| -------------------------- | ------------------------------------- | ------- | ---------------------------------------------- |
| **Frontend Framework**     | Next.js 14 (App Router)               | 14.x    | SSR, RSC, great DX, Vercel native              |
| **Language**               | TypeScript                            | 5.x     | Type safety, Prisma integration                |
| **Styling**                | Tailwind CSS + shadcn/ui              | 3.x     | Dark theme, auction-game-like aesthetic        |
| **Real-time**              | Socket.io                             | 4.x     | Simple WebSocket, rooms, broadcasting          |
| **Backend API**            | Next.js API Routes + Socket.io Server | 14.x    | Unified deployment (Vercel + Railway)          |
| **Database**               | PostgreSQL (Neon) + Prisma ORM        | 5.x     | Relational, free tier, type-safe               |
| **AI Service**             | Grok API (`llama-3.1-8b-instant`)     | -       | Free daily limits, structured JSON output      |
| **Userscript**             | Tampermonkey (ESM, Vite)              | -       | Free distribution, cross-browser, auto-updates |
| **Drag & Drop**            | dnd-kit                               | 6.x     | Accessible, touch-friendly, headless           |
| **Animations**             | Framer Motion                         | 11.x    | Reveal flips, countdown, confetti              |
| **Deployment (Web)**       | Vercel                                | -       | Free tier, Next.js native                      |
| **Deployment (Socket.io)** | Railway / Render                      | -       | Free tier, WebSocket support                   |
| **Database Hosting**       | Neon (Serverless PostgreSQL)          | -       | Free tier (0.5 GB), branching                  |
| **Version Control**        | Git + GitHub                          | -       | `.gh_token` for auto-push                      |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYAUCTIONGAME.COM                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Tampermonkey Userscript (Content Script)           │   │
│  │  - Detects auction COMPLETED status                 │   │
│  │  - Reads localStorage (visitorId, secretToken)      │   │
│  │  - Parses PartyKit messages from __NEXT_DATA__      │   │
│  │  - Injects "Export to Arena" button in header       │   │
│  │  - GM_xmlhttpRequest → POST /api/import-room        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS POST
┌─────────────────────────────────────────────────────────────┐
│                      IPL AUCTION ARENA                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Next.js 14  │  │  Socket.io   │  │  PostgreSQL      │  │
│  │  (Vercel)    │◄─►│  (Railway)   │◄─►│  (Neon + Prisma) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│        │                  │                    │             │
│        ▼                  ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Grok API (llama-3.1-8b-instant)                     │  │
│  │  POST /chat/completions → Structured JSON ranking    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Userscript → Web App

```typescript
// Userscript extracts this payload:
interface ExportPayload {
  auctionRoomId: string; // "9TM8LF"
  teams: TeamData[]; // All 10 IPL teams with squads
  players: PlayerData[]; // All players with roles, prices, overseas flag
  auctionSettings: {
    mode: "MINI_2026" | "MEGA";
    purseAmount: number;
    bidTimer: number;
  };
  exportedAt: string; // ISO timestamp
  exportedBy: string; // visitorId from localStorage
}

// POST to: https://arena.app/api/import-room
// Creates Room + Teams + Players in DB (idempotent by auctionRoomId)
// Returns: { roomId, shareUrl }
```

## Socket.io Events

### Client → Server

```typescript
// Lobby
"room:join"; // { roomId, displayName, clientId?, resumeOnly? }
"team:request"; // { teamId } - request to claim team
"team:approve"; // { teamId, socketId } - host approves
"team:reject"; // { teamId, socketId } - host rejects
"lineup:update"; // { lineupSlots: LineupSlot[] } - drag-drop changes (debounced)
"lineup:lock"; // { position } - lock current position
"match:start"; // {} - host starts match

// Match
"round:ready"; // {} - client confirms ready for next round
```

### Server → Client

```typescript
// Lobby
"room:state"; // Full room state (teams, players, lineups, users)
"room:resume:failed"; // Saved clientId has no participant in this room; show name form
"user:joined"; // { userId, displayName, teamId? }
"user:left"; // { userId }
"team:claimed"; // { teamId, userId, displayName }
"team:requested"; // { teamId, userId, displayName } - host notification
"lineup:synced"; // { teamId, lineupSlots, lockedPositions }
"pending:update"; // { waitingFor: string[] } - teams not ready

// Match
"round:start"; // { roundNumber, position, countdown: 3 }
"round:reveal"; // { picks: Pick[] } - all teams' picks for this position
"round:ranking"; // { ranking: AIRanking[], points: Score[] }
"round:complete"; // { leaderboard: TeamScore[] }
"match:complete"; // { finalStandings, winner }
"error"; // { message }
```

## AI Prompt Specification (Grok)

```typescript
// Request
const prompt = `
Rank these cricket players for batting position ${position} in a T20 match.
Return JSON array sorted best to worst.

Players:
${players.map((p) => `- ${p.name} (${p.role}, ${p.team}, ₹${p.price}Cr, ${p.isOverseas ? "Overseas" : "Local"})`).join("\n")}

Output format:
[
  {"playerId": "uuid", "teamId": "MI", "rank": 1, "reasoning": "..."},
  {"playerId": "uuid", "teamId": "CSK", "rank": 2, "reasoning": "..."}
]
`;

// Response parsing
interface AIRanking {
  playerId: string;
  teamId: string;
  rank: number; // 1 = best
  reasoning: string;
}

// Points calculation (deterministic code)
const points = activeTeamsCount - rank + 1; // 4 teams: 1st=4, 2nd=3, 3rd=2, 4th=1
```

## Environment Variables

```env
# Web App (Vercel)
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://arena.app"
GROK_API_KEY="xai-..."
GROK_API_URL="https://api.x.ai/v1/chat/completions"

# Socket.io Server (Railway)
PORT=3001
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://arena.app"
ALLOWED_ORIGIN="https://arena.app"

# Userscript (build-time)
VITE_API_URL="https://arena.app/api"
```

## Userscript Build (Vite + TypeScript)

```json
// package.json (userscript folder)
{
  "name": "ipl-auction-arena-userscript",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && node scripts/build-userscript.js"
  },
  "devDependencies": {
    "vite": "^5.x",
    "typescript": "^5.x",
    "@types/tampermonkey": "^4.x"
  }
}
```

```typescript
// userscript/src/main.ts
// ==UserScript==
// @name         IPL Auction Arena Exporter
// @match        https://www.playauctiongame.com/room/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      arena.app
// @run-at       document-idle
// ==/UserScript==
```

## Git & GitHub Workflow (Project Rules)

1. **Commit after every completed task/feature** (not every prompt)
2. **Branch strategy**: `main` (protected) → feature branches → PR → merge
3. **Commit format**: `type(scope): message` (feat, fix, chore, docs, refactor)
4. **Pre-commit**: ESLint + Prettier + TypeScript check (via Husky)
5. **No direct pushes to main** - PR required
6. **Update markdown docs** with progress/changes in each commit

## Markdown Files Management (Project Rules)

All 8 markdown files in project root are **living documents**:

- `Product-requirement-document.md` - Update when scope changes
- `Tech-specifications.md` - Update when tech decisions change
- `Appflow.md` - Update when user flows change
- `Design.md` - Update when UI/UX changes
- `schema.md` - Update when Prisma schema changes (run `prisma migrate dev` after)
- `implementation-plan.md` - Update task statuses (⬜/🟨/✅) each phase
- `rules.md` - Project rules (this section)
- `Tracker.md` - Progress tracker with timestamps

**Update these in every commit** where relevant.
