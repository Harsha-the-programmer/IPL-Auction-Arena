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
- [ ] Create Git repo: `IPL-Auction-Arena`
- [ ] Initialize Next.js 14 + TypeScript + Tailwind + ESLint + Prettier
- [ ] Configure Husky pre-commit (lint + typecheck + format)
- [ ] Set up Prisma + Neon PostgreSQL
- [ ] Run `prisma migrate dev --name init`
- [ ] Deploy to Vercel (web) + Railway (Socket.io)
- [ ] Verify: `pnpm dev` works, DB connects, Socket.io connects

### 0.2 Core Infrastructure
- [ ] Socket.io server (Railway) with room management
- [ ] Shared TypeScript types package (socket events, payloads)
- [ ] API route: `POST /api/import-room` (userscript target)
- [ ] API route: `GET /api/room/:roomId` (initial state for SSR)
- [ ] Environment variables configured on both platforms

### 0.3 Design System
- [ ] Tailwind config: colors, fonts (Geist), team color utilities
- [ ] shadcn/ui components: Button, Card, Dialog, Dropdown, Toast
- [ ] Global CSS: dark mode only, scrollbar styling, focus rings
- [ ] Layout components: Header, Sidebar, Container, PageWrapper

**Deliverable**: Empty app deployed, DB schema live, Socket.io running

---

## Phase 1: Tampermonkey Userscript (Host Only)

### 1.1 Userscript Development
- [ ] Vite + TypeScript userscript template
- [ ] Content script: Inject into `playauctiongame.com/room/*`
- [ ] Detect auction `COMPLETED` status (watch PartyKit messages / DOM)
- [ ] Extract data from:
  - `localStorage` (visitorId, secretToken)
  - `__NEXT_DATA__` (room bootstrap state)
  - PartyKit WebSocket messages (intercept)
- [ ] Build "Export to Arena" button injection (header top-right)
- [ ] `GM_xmlhttpRequest` POST to `/api/import-room` with payload

### 1.2 Import API
- [ ] Validate payload structure (Zod)
- [ ] Create Room + Teams + Players in transaction
- [ ] Idempotent by `auctionRoomId` (upsert)
- [ ] Return `{ roomId, shareUrl }`

### 1.3 Testing & Distribution
- [ ] Test with real auction game room (play mock auction)
- [ ] Build `.user.js` with metadata header
- [ ] Host on GitHub (raw.githubusercontent.com URL)
- [ ] Create `/install` page with Tampermonkey install instructions
- [ ] Verify auto-updates work via `@updateURL`

**Deliverable**: Host installs userscript → plays auction → clicks export → room created in arena

---

## Phase 2: Lobby & Lineup

### 2.1 Lobby Page (`/room/:roomId`)
- [ ] SSR: Fetch room state via `GET /api/room/:roomId`
- [ ] Client: Socket.io connect, join `room:{roomId}`
- [ ] Team grid with 4 states (UNCLAIMED/PENDING/APPROVED-YOU/APPROVED-OTHER)
- [ ] Team request flow: User clicks → `team:request` → Host sees toast
- [ ] Host panel: Pending requests with Approve/Reject buttons
- [ ] Name input + Join → creates Participant
- [ ] Real-time: `user:joined`, `team:claimed`, `team:requested`
- [ ] Host detection: First socket = host (`isHost: true`)
- [ ] "Start Match" button (enabled when all approved teams locked)

### 2.2 Lineup Builder (`/room/:roomId/lineup`)
- [ ] Fetch squad players for team
- [ ] dnd-kit: Two zones (batting order 1-11 + available squad)
- [ ] Drag-drop: squad → order, reorder within order, remove from order
- [ ] Filter tabs: All / BAT / BOWL / AR / WK
- [ ] Validation: Exactly 11 players required
- [ ] Lock Position button: Locks current position (1→2→3...)
- [ ] Socket sync: `lineup:update` (debounced 300ms), `lineup:lock`
- [ ] Real-time: Show other teams' lock status
- [ ] Mobile touch: Tap to add, long-press to drag

### 2.3 Progressive Locking Logic
- [ ] Server tracks `currentPosition` per room (1-11)
- [ ] When all teams lock position N → advance to N+1
- [ ] LineupSlot `isLocked` = position <= currentPosition
- [ ] Position 11 auto-locks when position 10 locks
- [ ] Client shows 🔒/🔓 badges per slot

**Deliverable**: 4 friends join, claim teams, build lineups, lock positions

---

## Phase 3: Match Engine & AI

### 3.1 Match State Machine
- [ ] Round progression: 10 rounds (Round 1 = openers pos 1&2, Rounds 2-10 = pos 3-11)
- [ ] Phase per round: PENDING → COUNTDOWN → REVEALED → RANKED → COMPLETED
- [ ] Auto-advance: All locked → 3s countdown → reveal → AI → points → next round
- [ ] Host can pause/resume
- [ ] Socket events for each phase transition

### 3.2 Countdown & Reveal UI
- [ ] Full-screen countdown overlay (3→2→1) with Framer Motion
- [ ] Reveal grid: All teams' picks for current position
- [ ] Card flip animation on reveal
- [ ] Team color rings, player name, role, price

### 3.3 Grok AI Integration
- [ ] API route: `POST /api/rank-players`
- [ ] Prompt engineering: Structured JSON output
- [ ] Request: Current position + all teams' picked players
- [ ] Response: Ranked array with reasoning
- [ ] Error handling: Fallback to price-based ranking if AI fails
- [ ] Rate limiting: Cache by `(roundNumber, position, playerIdsHash)`

### 3.4 Points & Leaderboard
- [ ] Points formula: `points = activeTeams - rank + 1`
- [ ] Score model: Round + Team + Points + Rank + Total
- [ ] Real-time leaderboard sidebar updates
- [ ] Round complete: `round:ranking` event with full standings
- [ ] Match complete: Final standings, winner detection

### 3.5 Match Arena Page (`/room/:roomId/match`)
- [ ] Header: Round X/10, Position badge (OPENER / #3 / #4...)
- [ ] Pending banner: "Waiting for CSK to lock Position 3"
- [ ] Main stage: Countdown → Reveal → AI Ranking (animated transitions)
- [ ] Leaderboard sidebar (collapsible on mobile)
- [ ] Host controls: Pause, Skip Round, End Match
- [ ] Auto-transition between phases (2s delay after ranking)

**Deliverable**: Full 10-round match plays automatically with AI ranking

---

## Phase 4: Polish & Production

### 4.1 Results & Sharing
- [ ] Results page (`/room/:roomId/results`)
- [ ] Winner podium with confetti (canvas-confetti)
- [ ] Round-by-round scoreboard expansion
- [ ] Share: WhatsApp deep link, Copy URL, Screenshot (html2canvas)
- [ ] "Play Again" → Creates new room, copies teams

### 4.2 Error Handling & Edge Cases
- [ ] Reconnection: Full state sync on socket reconnect
- [ ] Late join during match: Spectator mode (read-only)
- [ ] Host disconnect: Next senior participant becomes host
- [ ] AI failure: Deterministic fallback (price/role-based)
- [ ] Network errors: Toast notifications, retry buttons

### 4.3 Mobile Optimization
- [ ] Touch-friendly drag-drop (dnd-kit sensors)
- [ ] Collapsible leaderboard (drawer on mobile)
- [ ] Sticky footers for primary actions
- [ ] Viewport units for full-screen countdown
- [ ] Test on iOS Safari / Chrome Android

### 4.4 Landing Page & Userscript Install
- [ ] `/`: Hero, "Enter Room Code", "How it Works", Userscript link
- [ ] `/install`: Clear host-only messaging, Tampermonkey install steps
- [ ] SEO meta tags, Open Graph, Twitter cards
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