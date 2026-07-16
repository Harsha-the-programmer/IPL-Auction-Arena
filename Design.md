# Design Document - UI/UX

## Visual Theme (Matching playauctiongame.com)

### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#0a0a0a` (neutral-950) | Page background |
| `bg-card` | `#1f2937` (neutral-800) | Cards, panels, modals |
| `bg-elevated` | `#374151` (neutral-700) | Hover states, borders |
| `accent-primary` | `#f59e0b` (amber-500) | CTAs, highlights, host badge |
| `accent-hover` | `#d97706` (amber-600) | Button hover |
| `text-primary` | `#ffffff` | Headings, primary text |
| `text-secondary` | `#d1d5db` (neutral-300) | Body text |
| `text-muted` | `#6b7280` (neutral-500) | Labels, placeholders |
| `border-default` | `#374151` (neutral-700) | Borders, dividers |
| `success` | `#22c55e` (green-500) | Approved, locked, online |
| `warning` | `#f59e0b` (amber-500) | Pending, host actions |
| `danger` | `#ef4444` (red-500) | Rejected, errors, kicked |

### Team Colors (Official IPL)
```css
/* CSS Variables for dynamic team colors */
--team-mi: #004BA0;      /* Mumbai Indians */
--team-csk: #FFCB05;     /* Chennai Super Kings */
--team-rcb: #EC1C24;     /* Royal Challengers Bengaluru */
--team-kkr: #3A225D;     /* Kolkata Knight Riders */
--team-dc: #0078BC;      /* Delhi Capitals */
--team-pbks: #ED1B24;    /* Punjab Kings */
--team-rr: #EA1A85;      /* Rajasthan Royals */
--team-srh: #FF822A;     /* Sunrisers Hyderabad */
--team-gt: #1A3A5C;      /* Gujarat Titans */
--team-lsg: #A72056;     /* Lucknow Super Giants */
```

### Typography
- **Font Family**: `Geist` (sans) + `Geist Mono` (mono) - same as auction game
- **Scale**: 
  - `text-xs` (12px) - labels, metadata
  - `text-sm` (14px) - body
  - `text-base` (16px) - primary UI
  - `text-lg` (18px) - emphasis
  - `text-xl` (20px) - section headers
  - `text-2xl` (24px) - page titles
  - `text-4xl` (36px) - hero numbers (scores)

### Spacing & Radius
- **Spacing**: 4px base unit (Tailwind default)
- **Radius**: `rounded-lg` (8px) cards, `rounded-xl` (12px) modals, `rounded-full` pills
- **Shadows**: `shadow-lg` for modals, `shadow-xl` for match reveal cards

## Key Components

### 1. Team Card (Lobby)
```tsx
// States: UNCLAIMED | PENDING | APPROVED (You) | APPROVED (Other)
<div className="relative bg-card border border-default rounded-xl p-4 group">
  {/* Team color ring */}
  <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center 
                  text-white font-bold text-2xl ring-4 ring-offset-2 ring-offset-card"
       style={{ backgroundColor: team.color }}>
    {team.shortName}
  </div>
  
  <h3 className="text-center font-semibold">{team.name}</h3>
  <p className="text-center text-xs text-muted">{team.ownerName || 'Unclaimed'}</p>
  
  {/* Status badge */}
  <div className="mt-3 flex gap-2">
    {status === 'UNCLAIMED' && (
      <button className="flex-1 py-2 bg-elevated hover:bg-primary text-primary 
                         rounded-lg text-sm font-medium transition-colors">
        Request
      </button>
    )}
    {status === 'PENDING' && (
      <span className="flex-1 py-2 text-center text-xs bg-warning/20 text-warning 
                       rounded-lg font-medium">Pending Approval</span>
    )}
    {status === 'APPROVED' && isMe && (
      <a href={`/room/${roomId}/lineup`} className="flex-1 py-2 bg-accent-primary 
          hover:bg-accent-hover text-black rounded-lg text-sm font-bold text-center">
        Select Lineup →
      </a>
    )}
    {status === 'APPROVED' && !isMe && (
      <span className="flex-1 py-2 text-center text-xs bg-success/20 text-success 
                       rounded-lg font-medium">🔒 {ownerName}</span>
    )}
  </div>
</div>
```

### 2. Lineup Builder (Drag-Drop with dnd-kit)
```tsx
// Two-zone layout
<div className="flex flex-col h-full gap-4">
  {/* Batting Order - Fixed positions 1-11 */}
  <section className="space-y-2">
    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider px-2">
      BATTING ORDER <span className="text-accent-primary">({selectedCount}/11)</span>
    </h4>
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(11, minmax(0, 1fr))' }}>
      {Array.from({length: 11}, (_, i) => (
        <LineupSlot 
          key={i+1} 
          position={i+1} 
          player={lineup[i]} 
          isLocked={lockedPositions.includes(i+1)}
          onRemove={handleRemove}
        />
      ))}
    </div>
  </section>

  {/* Available Squad - Filterable grid */}
  <section className="flex-1 overflow-y-auto">
    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
      {['All', 'BAT', 'BOWL', 'AR', 'WK'].map(filter => (
        <button className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap
            ${activeFilter === filter ? 'bg-accent-primary text-black' : 'bg-elevated text-secondary'}`}
        >{filter}</button>
      ))}
    </div>
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
      {filteredPlayers.map(p => (
        <PlayerCard key={p.id} player={p} onAdd={handleAdd} disabled={selectedCount >= 11} />
      ))}
    </div>
  </section>
</div>
```

### 3. Match Arena - Reveal Animation (Framer Motion)
```tsx
// Countdown → Reveal → AI Ranking
<AnimatePresence mode="wait">
  {phase === 'COUNTDOWN' && (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.2, opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 bg-primary/80 backdrop-blur"
    >
      <motion.span 
        className="text-8xl font-bold text-accent-primary font-mono"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1, repeat: 2 }}
      >
        {countdown}
      </motion.span>
    </motion.div>
  )}

  {phase === 'REVEAL' && (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
    >
      {picks.map((pick, index) => (
        <motion.div 
          key={pick.teamId}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className="relative bg-card border-2 rounded-xl p-4 overflow-hidden"
          style={{ borderColor: pick.teamColor }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center 
                          text-white font-bold text-xl mb-3 mx-auto"
               style={{ backgroundColor: pick.teamColor }}>
            {pick.teamShortName}
          </div>
          <h4 className="text-center font-semibold">{pick.playerName}</h4>
          <p className="text-center text-xs text-muted capitalize">{pick.role}</p>
          <p className="text-center text-sm font-bold text-accent-primary">₹{pick.price}Cr</p>
          <div className="absolute top-2 right-2 bg-success text-xs px-1.5 py-0.5 rounded">
            🔒 LOCKED
          </div>
        </motion.div>
      ))}
    </motion.div>
  )}

  {phase === 'RANKING' && (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-card border border-warning/30 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 text-warning mb-3">
        <Bot className="w-5 h-5" />
        <h3 className="font-semibold">Grok Analysis - Position {position}</h3>
      </div>
      <ol className="space-y-2">
        {ranking.map((r, i) => (
          <li key={r.playerId} className="flex items-center gap-3 p-2 bg-elevated/50 rounded-lg">
            <span className="w-8 h-8 rounded-full flex items-center justify-center 
                            font-bold text-sm"
                style={{ 
                  backgroundColor: i === 0 ? 'rgba(251,191,36,0.3)' : 
                                   i === 1 ? 'rgba(156,163,175,0.3)' : 
                                   i === 2 ? 'rgba(180,83,9,0.3)' : 'transparent',
                  color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'inherit'
                }}>
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-medium">{r.playerName} <span className="text-xs text-muted">({r.teamShortName})</span></p>
              <p className="text-xs text-muted">{r.reasoning}</p>
            </div>
            <span className="text-sm font-bold text-accent-primary">+{points} pts</span>
          </li>
        ))}
      </ol>
    </motion.div>
  )}
</AnimatePresence>
```

### 4. Leaderboard Sidebar
```tsx
<aside className="w-64 flex-shrink-0 hidden lg:block">
  <div className="sticky top-4 bg-card border border-default rounded-xl p-3">
    <h3 className="font-semibold text-accent-primary mb-3 flex items-center gap-2">
      <Trophy className="w-5 h-5" /> LIVE SCORES
    </h3>
    <ul className="space-y-2">
      {standings.map((team, i) => (
        <li key={team.teamId} className={`flex items-center gap-3 p-2 rounded-lg transition-all
            ${i === 0 ? 'bg-warning/10 border border-warning/30' : 'bg-elevated/30'}`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center 
                          text-white font-bold text-xs flex-shrink-0"
               style={{ backgroundColor: team.color }}>
            {team.shortName}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{team.ownerName}</p>
            <p className="text-xs text-muted">Round {team.lastRoundPoints > 0 ? '+' : ''}{team.lastRoundPoints} pts</p>
          </div>
          <span className={`text-lg font-bold ${i === 0 ? 'text-warning' : 'text-primary'}`}>
            {team.total}
          </span>
          {i === 0 && <Crown className="w-5 h-5 text-warning" />}
        </li>
      ))}
    </ul>
  </div>
</aside>
```

## Responsive Breakpoints
- **Mobile**: < 640px - Stacked layout, collapsible leaderboard, touch-optimized drag
- **Tablet**: 640-1024px - Two-column lobby, lineup builder full width
- **Desktop**: > 1024px - Three-column match arena (leaderboard + reveal + AI)

## Accessibility
- Semantic HTML (`<main>`, `<section>`, `<article>`)
- ARIA labels on drag handles, buttons
- Focus visible outlines: `focus-visible:ring-2 focus-visible:ring-accent-primary`
- Color contrast: WCAG AA on all text
- Reduced motion: `prefers-reduced-motion` disables Framer Motion animations

## Dark Mode Only
- No light mode - matches auction game aesthetic
- CSS variables for easy theming if needed later