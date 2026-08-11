# App Flow - User Navigation

## Route Structure

```
/                                    → Landing Page
  ├── "Enter Room Code" input
  ├── "How it Works" accordion
  └── "Install Userscript" button → /install

/install                               → Userscript Install Page
  ├── Tampermonkey install link
  ├── "Only HOST needs this" notice
  ├── Direct userscript install button
  └── Step-by-step instructions

/room/:roomId                          → Lobby (Main Hub)
  ├── Header: Room code, copy link, share
  ├── Team Grid: 10 IPL teams with claim status
  │   ├── UNCLAIMED: "Request [Team]" button
  │   ├── PENDING: "Requested - awaiting host approval" + spinner
  │   ├── APPROVED (You): "🔒 You - Select Lineup →"
  │   └── APPROVED (Other): "👤 [Name] - Lineup locked" / "Editing..."
  ├── Your Name input (sticky bottom)
  ├── Host Panel (if host):
  │   ├── Pending Requests: [Approve] [Reject] per request
  │   ├── "Start Match" button (enabled when all APPROVED teams locked)
  │   └── Player list with connection status
  └── Pending indicator: "Waiting for: CSK, RR to join/lock"

/room/:roomId/lineup                   → Playing XI Builder
  ├── Header: Team name, "← Back to Lobby", lock status
  ├── BATTING ORDER (1-11) - Droppable Zone
  │   ├── Position 1: 🔒 LOCKED (after Round 1 starts) / 🔓 EDITABLE
  │   ├── Position 2: 🔒/🔓
  │   └── ...
  │   Each slot: Player card (name, role, price, drag handle, remove ×)
  │   Empty slot: "+ Add Player"
  ├── AVAILABLE SQUAD - Draggable Grid
  │   Filter tabs: [All] [Bat] [Bowl] [AR] [WK]
  │   Player cards: tap/click to add to next empty slot
  │   Shows remaining: "8 players available"
  ├── Validation: "Select 11 players" / "✓ 11/11 - Ready to Lock"
  ├── Lock Position Button: "Lock Position 1" (enabled at 11 players)
  └── Sticky footer: "Position 1 of 11" progress

/room/:roomId/match                    → Match Arena (Real-time)
  ├── Header: Room code, Round X/10, Position badge (OPENER / #3 / #4...)
  ├── Live Leaderboard Sidebar (right, collapsible on mobile)
  │   ├── Team cards: Logo, name, total score, last round points (+4)
  │   └── Highlight: Current round leader 👑
  ├── Main Arena: Center stage
  │   ├── Countdown: "3... 2... 1..." (large, animated)
  │   ├── Reveal Grid: All teams' picks for this position
  │   │   ├── Team card: Color ring, player name, role, price
  │   │   └── "🔒 LOCKED" badge on revealed picks
  │   ├── AI Ranking Panel (slides in after reveal)
  │   │   ├── "🤖 Grok Analysis"
  │   │   ├── Ranked list with reasoning
  │   │   └── Points awarded per team
  │   └── "Next Round" auto-transition (2s delay)
  ├── Pending Banner (top): "Waiting for CSK to lock Position 3..."
  └── Host controls (if host): [Pause] [Skip Round] [End Match]

/room/:roomId/results                  → Final Results
  ├── Winner Podium: 🥇 1st, 🥈 2nd, 🥉 3rd with confetti
  ├── Full Scoreboard: All teams, round-by-round breakdown
  │   ├── Expandable: "Round 1: +4, Round 2: +3..."
  │   └── Total score
  ├── Share Button: WhatsApp / Copy Link / Screenshot
  ├── "Play Again" → Creates new room with same teams
  └── "Back to Lobby"
```

## State Transitions

```
LOBBY
  │
  ├─ User joins → enters name → requests team
  │
  ├─ Host approves team → user goes to /lineup
  │
  ├─ All approved teams have 11 players + locked → Host sees "Start Match"
  │
  ▼
MATCH (Round 1)
  │
  ├─ All teams lock Position 1 → Auto countdown 3s
  │
  ├─ Reveal → AI ranks → Points → Leaderboard updates
  │
  ├─ Position 2 auto-locks for all → Round 2 starts
  │
  ▼
MATCH (Rounds 2-10) ... repeat
  │
  ▼
RESULTS (Round 10 complete)
  │
  ├─ Final standings calculated
  │
  ├─ Winner celebration
  │
  └─ Share / Play Again
```

## Real-time Sync Details

- **Lobby**: Socket.io room = `room:{roomId}`
- **Lineup**: Broadcast `lineup:synced` on every drag-drop (debounced 300ms)
- **Match**: Single Socket.io room, host controls pace via `round:start` emission
- **Reconnection**: Client resumes by saved `clientId` on refresh, then receives full `room:state`
- **Late Join**: If match started, spectator mode (view only, no lineup)

## Socket.io Events

### Client → Server

```typescript
// Lobby
"room:join"; // { roomId, displayName, clientId?, resumeOnly? }
"team:request"; // { teamId }
"team:approve"; // { teamId, socketId }
"team:reject"; // { teamId, socketId }
"lineup:update"; // { lineupSlots: LineupSlot[] }
"lineup:lock"; // { position }
"match:start"; // {}

// Match
"round:ready"; // {}
```

### Server → Client

```typescript
// Lobby
"room:state"; // Full room state
"room:resume:failed"; // Saved clientId has no participant in this room; show name form
"user:joined"; // { userId, displayName, teamId? }
"user:left"; // { userId }
"team:claimed"; // { teamId, userId, displayName }
"team:requested"; // { teamId, userId, displayName }
"lineup:synced"; // { teamId, lineupSlots, lockedPositions }
"pending:update"; // { waitingFor: string[] }

// Match
"round:start"; // { roundNumber, position, countdown: 3 }
"round:reveal"; // { picks: Pick[] }
"round:ranking"; // { ranking: AIRanking[], points: Score[] }
"round:complete"; // { leaderboard: TeamScore[] }
"match:complete"; // { finalStandings, winner }
"error"; // { message }
```
