# Project Tracker

## Progress Overview

| Phase | Task | Status | Started | Completed | Notes |
|-------|------|--------|---------|-----------|-------|
| **0.1** | Git repo init + Next.js setup | ⬜ Pending | | | |
| **0.1** | Prisma + Neon + Migration | ⬜ Pending | | | |
| **0.1** | Vercel + Railway deploy | ⬜ Pending | | | |
| **0.2** | Socket.io server + Types | ⬜ Pending | | | |
| **0.2** | Import API + Room API | ⬜ Pending | | | |
| **0.3** | Design system + shadcn/ui | ⬜ Pending | | | |
| **1.1** | Userscript Vite setup | ⬜ Pending | | | |
| **1.1** | Content script + Data extraction | ⬜ Pending | | | |
| **1.1** | Export button injection | ⬜ Pending | | | |
| **1.2** | Import API implementation | ⬜ Pending | | | |
| **1.3** | Userscript build + GitHub hosting | ⬜ Pending | | | |
| **1.3** | Install page + Testing | ⬜ Pending | | | |
| **2.1** | Lobby page + Socket join | ⬜ Pending | | | |
| **2.1** | Team grid + Claim flow | ⬜ Pending | | | |
| **2.1** | Host approval panel | ⬜ Pending | | | |
| **2.1** | Real-time sync (join/claim) | ⬜ Pending | | | |
| **2.2** | Lineup builder + dnd-kit | ⬜ Pending | | | |
| **2.2** | Squad filters + Validation | ⬜ Pending | | | |
| **2.2** | Lock position + Progressive | ⬜ Pending | | | |
| **2.3** | Lock logic server-side | ⬜ Pending | | | |
| **2.3** | Real-time lock status | ⬜ Pending | | | |
| **3.1** | Match state machine (10 rounds) | ⬜ Pending | | | |
| **3.2** | Countdown + Reveal UI | ⬜ Pending | | | |
| **3.3** | Grok AI integration | ⬜ Pending | | | |
| **3.3** | Prompt engineering + Fallback | ⬜ Pending | | | |
| **3.4** | Points calc + Leaderboard | ⬜ Pending | | | |
| **3.5** | Match Arena page | ⬜ Pending | | | |
| **4.1** | Results page + Podium | ⬜ Pending | | | |
| **4.1** | Share (WhatsApp, Copy, Screenshot) | ⬜ Pending | | | |
| **4.2** | Reconnection + Edge cases | ⬜ Pending | | | |
| **4.3** | Mobile optimization | ⬜ Pending | | | |
| **4.4** | Landing + Userscript page | ⬜ Pending | | | |
| **4.5** | Deploy config + Monitoring | ⬜ Pending | | | |
| **4.6** | Documentation | ⬜ Pending | | | |

**Legend**: ⬜ Pending | 🟨 In Progress | ✅ Done

---

## Milestones

| Milestone | Target | Criteria | Status |
|-----------|--------|----------|--------|
| **M1** | Day 1 | Userscript extracts data from live auction game | ⬜ |
| **M2** | Day 1-2 | 4 friends join lobby, claim teams, lock lineups | ⬜ |
| **M3** | Day 2-3 | Full 10-round match completes with AI ranking | ⬜ |
| **M4** | Day 3 | Production deployed, userscript installable by friends | ⬜ |

---

## Current Sprint (Day 1)

### Goals
- [ ] Repo initialized with all configs
- [ ] Database schema deployed
- [ ] Socket.io server running
- [ ] Userscript extracts auction data

### Blockers
- None yet

### Decisions Needed
- [ ] Confirm Neon project creation
- [ ] Confirm Railway project creation
- [ ] Grok API key obtained

---

## Daily Standup Template

```
Date: YYYY-MM-DD
Completed: [Task IDs]
In Progress: [Task ID]
Blockers: [Description]
Next: [Task ID]
```

### Standup History

#### 2026-07-16
- Completed: Project planning, all 8 docs created
- In Progress: Phase 0 - Foundation
- Blockers: None
- Next: Git repo init + Next.js setup

---

## Velocity Tracking

| Day | Planned Tasks | Completed Tasks | Velocity |
|-----|---------------|-----------------|----------|
| 1   | 12            |                 |          |
| 2   | 10            |                 |          |
| 3   | 10            |                 |          |

---

## Retrospective Notes

### Day 1
- What went well:
- What didn't:
- Action items:

### Day 2
- What went well:
- What didn't:
- Action items:

### Day 3
- What went well:
- What didn't:
- Action items:

---

## Known Issues / Tech Debt

| Issue | Priority | Phase | Notes |
|-------|----------|-------|-------|
| PartyKit data extraction may break on auction game updates | High | 1 | Multiple fallback sources implemented |
| Mobile drag-drop needs testing | Medium | 2 | dnd-kit touch sensors + tap-to-add fallback |
| AI response parsing edge cases | Medium | 3 | Zod validation + deterministic fallback |
| Host disconnect during match | Low | 3 | Next senior participant becomes host |