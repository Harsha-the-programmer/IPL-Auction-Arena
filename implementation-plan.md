# Implementation Plan - Phased Approach

## Target: 2-3 Days Total

| Phase | Focus | Est. Time |
|-------|-------|-----------|
| **0** | Foundation: Next.js + Prisma + Socket.io + Deploy | ~4-6 hrs |
| **1** | Tampermonkey Userscript (Host-only) + Import API | ~4-6 hrs |
| **2** | Lobby + Team Claims + Lineup Builder + Progressive Lock | ~6-8 hrs |
| **3** | Match Engine (10 rounds) + Grok AI + Leaderboard | ~6-8 hrs |
| **4** | Results + Polish + Mobile + Landing + Deploy | ~4-6 hrs |

---

## Phase 0: Foundation (Critical Path)

### 0.1 Project Setup
- [x] Create Git repo: `IPL-Auction-Arena`
- [x] Initialize Next.js 14 + TypeScript + Tailwind + ESLint + Prettier
- [x] Configure Husky pre-commit (lint + typecheck + format)
- [x] Set up Prisma + Neon PostgreSQL
- [x] Run `prisma migrate dev --name init`
- [x] Deploy to Vercel (web) + Railway (Socket.io)
- [x] Verify: `pnpm dev` works, DB connects, Socket.io connects

### 0.2 Core Infrastructure
- [x] Socket.io server (Railway) with room management
- [x] Shared TypeScript types package (socket events, payloads)
- [x] API route: `POST /api/import-room` (userscript target)
- [x] API route: `GET /api/room/:roomId` (initial state for SSR)
- [x] Environment variables configured on both platforms

### 0.3 Design System
- [x] Tailwind config: colors, fonts (Geist), team color utilities
- [x] shadcn/ui components: Button, Card, Dialog, Dropdown, Toast
- [x] Global CSS: dark mode only, scrollbar styling, focus rings
- [x] Layout components: Header, Sidebar, Container, PageWrapper

**Deliverable**: Empty app deployed, DB schema live, Socket.io running

---

## Phase 1: Tampermonkey Userscript (Host Only)

### 1.1 Userscript Development
- [x] Vite + TypeScript userscript template
- [x] Content script: Inject into `playauctiongame.com/room/*`
- [x] Detect auction `COMPLETED` status (watch PartyKit messages / DOM)
- [x] Extract data from:
  - `localStorage` (visitorId, secretToken)
  - `__NEXT_DATA__` (room bootstrap state)
  - PartyKit WebSocket messages (intercept)
- [x] Build "Export to Arena" button injection (header top-right)
- [x] `GM_xmlhttpRequest` POST to `/api/import-room` with payload

### 1.2 Import API
- [x] Validate payload structure (Zod)
- [x] Create Room + Teams + Players in transaction
- [x] Idempotent by `auctionRoomId` (upsert)
- [x] Return `{ roomId, shareUrl }`

### 1.3 Testing & Distribution
- [x] Test with real auction game room (play mock auction)
- [x] Build `.user.js` with metadata header
- [x] Host on GitHub (raw.githubusercontent.com URL)
- [x] Create `/install` page with Tampermonkey install instructions
- [x] Verify auto-updates work via `@updateURL`

**Deliverable**: Host installs userscript → plays auction → clicks export → room created in arena

---

## Phase 2: Lobby & Lineup

### 2.1 Lobby Page (`/room/:roomId`)
- [x] SSR: Fetch room state via `GET /api/room/:roomId`
- [x] Client: Socket.io connect, join `room:{roomId}`
- [x] Team grid with 4 states (UNCLAIMED/PENDING/APPROVED-YOU/APPROVED-OTHER)
- [x] Team request flow: User clicks → `team:request` → Host sees toast
- [x] Host panel: Pending requests with Approve/Reject buttons
- [x] Name input + Join → creates Participant
- [x] Real-time: `user:joined`, `team:claimed`, `team:requested`
- [x] Host detection: First socket = host (`isHost: true`)
- [x] "Start Match" button (enabled when all approved teams locked)

### 2.2 Lineup Builder (`/room/:roomId/lineup`)
- [x] Fetch squad players for team
- [x] dnd-kit: Two zones (batting order 1-11 + available squad)
- [x] Drag-drop: squad → order, reorder within order, remove from order
- [x] Filter tabs: All / BAT / BOWL / AR / WK
- [x] Validation: Exactly 11 players required
- [x] Lock Position button: Locks current position (1→2→3...)
- [x] Socket sync: `lineup:update` (debounced 300ms), `lineup:lock`
- [x] Real-time: Show other teams' lock status
- [x] Mobile touch: Tap to add, long-press to drag

### 2.3 Progressive Locking Logic
- [x] Server tracks `currentPosition` per room (1-11)
- [x] When all teams lock position N → advance to N+1
- [x] LineupSlot `isLocked` = position <= currentPosition
- [x] Position 11 auto-locks when position 10 locks
- [x] Client shows 🔒/🔓 badges per slot

**Deliverable**: 4 friends join, claim teams, build lineups, lock positions

---

## Phase 3: Match Engine & AI

### 3.1 Match State Machine
- [x] Round progression: 10 rounds (Round 1 = openers pos 1&2, Rounds 2-10 = pos 3-11)
- [x] Phase per round: PENDING → COUNTDOWN → REVEALED → RANKED → COMPLETED
- [x] Auto-advance: All locked → 3s countdown → reveal → AI → points → next round
- [x] Host can pause/resume
- [x] Socket events for each phase transition

### 3.2 Countdown & Reveal UI
- [x] Full-screen countdown overlay (3→2→1) with Framer Motion
- [x] Reveal grid: All teams' picks for current position
- [x] Card flip animation on reveal
- [x] Team color rings, player name, role, price

### 3.3 Grok AI Integration
- [x] API route: `POST /api/rank-players`
- [x] Prompt engineering: Structured JSON output
- [x] Request: Current position + all teams' picked players
- [x] Response: Ranked array with reasoning
- [x] Error handling: Fallback to price-based ranking if AI fails
- [x] Rate limiting: Cache by `(roundNumber, position, playerIdsHash)`

### 3.4 Points & Leaderboard
- [x] Points formula: `points = activeTeams - rank + 1`
- [x] Score model: Round + Team + Points + Rank + Total
- [x] Real-time leaderboard sidebar updates
- [x] Round complete: `round:ranking` event with full standings
- [x] Match complete: Final standings, winner detection

### 3.5 Match Arena Page (`/room/:roomId/match`)
- [x] Header: Round X/10, Position badge (OPENER / #3 / #4...)
- [x] Pending banner: "Waiting for CSK to lock Position 3"
- [x] Main stage: Countdown → Reveal → AI Ranking (animated transitions)
- [x] Leaderboard sidebar (collapsible on mobile)
- [x] Host controls: Pause, Skip Round, End Match
- [x] Auto-transition between phases (2s delay after ranking)

**Deliverable**: Full 10-round match plays automatically with AI ranking

---

## Phase 4: Polish & Production

### 4.1 Results & Sharing
- [x] Results page (`/room/:roomId/results`)
- [x] Winner podium with confetti (canvas-confetti)
- [x] Round-by-round scoreboard expansion
- [x] Share: WhatsApp deep link, Copy URL, Screenshot (html2canvas)
- [x] "Play Again" → Creates new room, copies teams

### 4.2 Error Handling & Edge Cases
- [x] Reconnection: Full state sync on socket reconnect
- [x] Late join during match: Spectator mode (read-only)
- [x] Host disconnect: Next senior participant becomes host
- [x] AI failure: Deterministic fallback (price/role-based)
- [x] Network errors: Toast notifications, retry buttons

### 4.3 Mobile Optimization
- [x] Touch-friendly drag-drop (dnd-kit sensors)
- [x] Collapsible leaderboard (drawer on mobile)
- [x] Sticky footers for primary actions
- [x] Viewport units for full-screen countdown
- [ ] Test on iOS Safari / Chrome Android

### 4.4 Landing Page & Userscript Install
- [x] `/`: Hero, "Enter Room Code", "How it Works", Userscript link
- [x] `/install`: Clear host-only messaging, Tampermonkey install steps
- [x] SEO meta tags, Open Graph, Twitter cards
- [ ] Favicon, manifest.json

### 4.5 Deployment & Monitoring
- [ ] Vercel: Preview deployments on PR, production on main
- [ ] Railway: Socket.io server with health checks
- [ ] Neon: Branch per preview, main for production
- [ ] Error tracking: Sentry (free tier) or console.log
- [ ] Analytics: Vercel Analytics (free)

### 4.6 Documentation
- [ ] README: Setup, env vars, deploy, userscript install
- [ ] ARCHITECTURE.md: System diagram, data flows
- [ ] SOCKET_EVENTS.md: Complete event reference
- [ ] CHANGELOG.md: Version history (Keep a Changelog format)

**Deliverable**: Production-ready app, userscript installable by friends

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PartyKit data extraction fails | Medium | High | Multiple fallback sources (localStorage, __NEXT_DATA__, WS messages) |
| Grok API rate limits | Low | Medium | Cache responses, deterministic fallback |
| Socket.io scaling | Low | Medium | Railway auto-scales, single room per match |
| Userscript breaks on auction update | Medium | High | Version detection, graceful degradation, quick patch deploys |
| Mobile drag-drop issues | Medium | Medium | dnd-kit touch sensors, tap-to-add fallback |

---

## Team & Roles (Solo Dev)

- **Full Stack**: All phases
- **Userscript**: Phase 1 focus
- **DevOps**: Vercel + Railway + Neon config
- **QA**: Test with 4+ friends in Phases 2-3