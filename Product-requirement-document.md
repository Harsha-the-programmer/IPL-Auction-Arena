# Product Requirements Document (PRD)

## Project Name: IPL Auction Arena

## Problem Statement

Friends play IPL Auction Game on `playauctiongame.com` where they bid for players and build squads. After the auction ends, they manually:
1. Write down their 11-player playing XI on paper
2. Reveal players one position at a time (openers first, then #3, etc.)
3. Ask ChatGPT/Grok to rank all revealed players
4. Manually award points on paper based on AI rankings
5. Calculate final scores and declare a winner

This process is tedious, error-prone, and breaks the fun flow.

## Solution Overview

**IPL Auction Arena** is a companion web app + Tampermonkey userscript that:
1. **Userscript** (host only): Extracts squad data from the auction game after it ends
2. **Web App**: Multiplayer room where friends join via room code, pick playing XI, and compete in AI-ranked faceoffs
3. **AI Ranking**: Uses Grok's `llama-3.1-8b-instant` (free tier) to objectively rank players each round
4. **Automated Scoring**: Real-time leaderboard, no manual tracking

## Target Users

- Groups of 2-10 friends who play IPL Auction Game together
- Cricket enthusiasts who want competitive "playing XI" battles post-auction
- Casual users - no accounts, just room codes like the original game

## Core Features

### 1. Data Bridge (Tampermonkey Userscript - Host Only)
- Injects into `playauctiongame.com/room/:roomId`
- Detects when auction ends (status: `COMPLETED`)
- Extracts: all teams, squads, player details, prices from localStorage/PartyKit messages
- One-click "Export to Arena" button sends data to web app API via `GM_xmlhttpRequest`
- **Only the host needs to install this** - friends join via room code only

### 2. Arena Lobby
- Enter room code (6-char code from auction game, e.g., `9TM8LF`)
- See all teams from that auction with official colors/names
- Request to claim a team → Host approves/rejects (prevents wrong team claims)
- Enter display name
- See live status: who's joined, who's pending, team claims

### 3. Playing XI Selection (Progressive Locking)
- Each team owner sees their full squad (15-25 players)
- Drag-drop to select 11 players + assign batting order (1-11)
- **Pre-match**: All 11 positions editable
- **Round 1 starts**: Position 1 locks (cannot change). Positions 2-11 remain editable
- **Round 2 starts**: Position 2 locks. Positions 3-11 editable
- ...
- **Round 10 starts**: Position 10 locks. Position 11 auto-locks (last remaining)
- Lock lineup when ready → shows "🔒 Locked" indicator

### 4. Faceoff Rounds (Core Gameplay - 10 Rounds)

**Round 1 - Openers**: All teams reveal Position 1 & 2 simultaneously
- Auto-starts when all teams have locked Position 1
- 3-second countdown → reveal
- AI ranks all openers (1st = best, last = worst)
- Points: 1st place = N points, 2nd = N-1, ..., last = 1 point (N = active teams)

**Round 2 - Position 3**: Reveal Position 3, AI ranks, award points

**Rounds 3-10**: Continue for positions 4-11

**Total 10 rounds** = complete playing XI (11 positions, openers revealed together)

### 5. Real-time Leaderboard
- Live score updates after each round
- Team colors/names from original auction
- Shows pending players: "Waiting for: CSK, RR..."
- Final winner celebration screen with confetti

### 6. Host Controls
- First person to join room = Host
- Approve/reject team requests
- "Start Match" button (after all approved teams locked)
- Can pause/resume if needed

## User Flow Summary

```
1. Play auction on playauctiongame.com/room/9TM8LF
2. Auction ends → Userscript detects COMPLETED status
3. Host clicks "Export to Arena" → Data posted to arena API
4. Friends open arena.app/room/9TM8LF
5. Each requests a team → Host approves
6. All select Playing XI (11 players, ordered, drag-drop)
7. All lock → Host clicks "Start Match"
8. Round 1: Pos 1 locks for all → 3s countdown → reveal → AI ranks → Points
9. Round 2: Pos 2 locks for all → 3s countdown → reveal → AI ranks → Points
...
10. Round 10: Pos 10 locks → Pos 11 auto-locks → Final reveal → Winner
11. Final Leaderboard → Winner announced → "Play Again" / "Share"
```

## Non-Functional Requirements

- **Dark theme** matching auction game aesthetic (neutral-950 background, amber accents)
- **Real-time** via Socket.io (Node.js server)
- **Mobile-first responsive** - works on phone browsers
- **No auth** - room code + display name only
- **Free tier AI** - Grok `llama-3.1-8b-instant` (1000+ req/day free)
- **Tampermonkey userscript** for data extraction (Manifest V3 equivalent, free distribution)
- **Chrome/Edge/Firefox/Safari** compatible via Tampermonkey

## Success Metrics

- Zero manual score tracking needed
- Game completes in < 15 minutes for 10 rounds
- Works for 2-10 players
- Userscript installs in < 30 seconds via Tampermonkey
- Host approval prevents wrong team claims