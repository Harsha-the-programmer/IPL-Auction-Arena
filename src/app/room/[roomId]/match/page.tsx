'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, Crown, Timer, Bot, Zap, Pause, Play, 
  SkipForward, X, CheckCircle, Loader2, AlertCircle,
  ChevronLeft, Share2, Download, Camera
} from 'lucide-react'
import { cn, formatPrice, getTeamInfo, IPL_TEAMS } from '@/lib/utils'
import type { RoomState, TeamState, PickState, AIRanking, ScoreState, TeamScore } from '@/lib/types'

const POSITION_NAMES = ['', 'OPENER 1', 'OPENER 2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11']
const POSITION_BADGES = ['', 'OPENER', 'OPENER', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11']

export default function MatchPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [socket, setSocket] = useState<Socket | null>(null)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [myTeam, setMyTeam] = useState<TeamState | null>(null)
  const [phase, setPhase] = useState<'PENDING' | 'COUNTDOWN' | 'REVEALED' | 'RANKING' | 'COMPLETED'>('PENDING')
  const [countdown, setCountdown] = useState(3)
  const [picks, setPicks] = useState<PickState[]>([])
  const [ranking, setRanking] = useState<AIRanking[]>([])
  const [points, setPoints] = useState<ScoreState[]>([])
  const [leaderboard, setLeaderboard] = useState<TeamScore[]>([])
  const [finalStandings, setFinalStandings] = useState<TeamScore[]>([])
  const [winner, setWinner] = useState<TeamScore | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitingFor, setWaitingFor] = useState<string[]>([])
  const [showShare, setShowShare] = useState(false)

  const countdownRef = useRef(countdown)
  countdownRef.current = countdown

  // Initialize socket
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_APP_URL || '', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      newSocket.emit('room:join', { roomId, displayName: '' })
    })

    newSocket.on('room:state', (state: RoomState) => {
      setRoom(state)
      const participant = state.participants.find(p => p.socketId === newSocket.id)
      if (participant?.teamId) {
        const team = state.teams.find(t => t.id === participant.teamId)
        if (team) setMyTeam(team)
      }
      setIsHost(state.hostSocketId === newSocket.id)
    })

    newSocket.on('round:start', (data: { roundNumber: number; position: number; countdown: number }) => {
      setPhase('COUNTDOWN')
      setCountdown(data.countdown)
      // Start countdown animation
      let current = data.countdown
      const interval = setInterval(() => {
        current--
        setCountdown(current)
        if (current <= 0) clearInterval(interval)
      }, 1000)
    })

    newSocket.on('round:reveal', (data: { picks: PickState[] }) => {
      setPhase('REVEALED')
      setPicks(data.picks)
    })

    newSocket.on('round:ranking', (data: { ranking: AIRanking[]; points: ScoreState[] }) => {
      setPhase('RANKING')
      setRanking(data.ranking)
      setPoints(data.points)
    })

    newSocket.on('round:complete', (data: { leaderboard: TeamScore[] }) => {
      setPhase('COMPLETED')
      setLeaderboard(data.leaderboard)
      setTimeout(() => setPhase('PENDING'), 2000)
    })

    newSocket.on('match:complete', (data: { finalStandings: TeamScore[]; winner: TeamScore }) => {
      setFinalStandings(data.finalStandings)
      setWinner(data.winner)
      router.push(`/room/${roomId}/results`)
    })

    newSocket.on('pending:update', (data: { waitingFor: string[] }) => {
      setWaitingFor(data.waitingFor)
    })

    newSocket.on('host:changed', (newHostId: string) => {
      setIsHost(newHostId === newSocket.id)
    })

    newSocket.on('error', (message: string) => {
      setError(message)
      setTimeout(() => setError(null), 5000)
    })

    newSocket.on('disconnect', () => {
      setError('Disconnected. Reconnecting...')
    })

    setSocket(newSocket)

    return () => newSocket.close()
  }, [roomId, router])

  const handlePause = () => socket?.emit('match:pause')
  const handleResume = () => socket?.emit('match:resume')
  const handleEnd = () => {
    if (confirm('End match early?')) socket?.emit('match:end')
  }
  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      alert('Room link copied!')
    } catch {
      prompt('Copy this link:', url)
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    )
  }

  const currentRound = room.currentRound || 1
  const currentPosition = room.currentPosition || 1
  const totalRounds = 10
  const progress = (currentRound / totalRounds) * 100

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="badge bg-amber-500/20 text-amber-400 font-mono">
                Room: {room.auctionRoomId}
              </span>
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <span>Round</span>
                <span className="font-bold text-amber-400 font-mono">{currentRound}/{totalRounds}</span>
                <span className="text-neutral-600">•</span>
                <span className="badge bg-neutral-800 text-neutral-300">{POSITION_BADGES[currentPosition]}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-48 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isHost && phase !== 'COMPLETED' && (
                <>
                  {phase === 'COUNTDOWN' || phase === 'REVEALED' || phase === 'RANKING' ? (
                    <button onClick={handlePause} className="btn-secondary btn-sm">
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={handleResume} className="btn-primary btn-sm">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={handleEnd} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
              <button onClick={handleShare} className="btn-ghost btn-sm">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Arena */}
      <main className="flex-1 overflow-hidden flex">
        {/* Left: Leaderboard Sidebar */}
        <aside className="w-full lg:w-64 lg:flex-shrink-0 border-r border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto hidden lg:block">
          <div className="sticky top-4">
            <h3 className="font-semibold text-amber-400 flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5" />
              LIVE SCORES
            </h3>
            <div className="space-y-2">
              {leaderboard.length > 0 ? leaderboard : room.teams
                .filter(t => t.claimStatus === 'APPROVED')
                .map(team => {
                  const score = leaderboard.find(s => s.teamId === team.id)
                  return (
                    <TeamScoreCard 
                      key={team.id} 
                      team={team} 
                      score={score}
                      isWinner={winner?.teamId === team.id}
                    />
                  )
                })}
            </div>

            {waitingFor.length > 0 && (
              <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 font-medium mb-1">Waiting for:</p>
                <p className="text-sm">{waitingFor.join(', ')}</p>
              </div>
            )}

            {myTeam && !myTeam.isLocked && phase === 'PENDING' && (
              <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400 font-medium">Your turn to lock Position {currentPosition}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Center: Match Arena */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
          {/* Phase Indicator */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <motion.span
              className="badge px-4 py-2 text-lg font-mono"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {phase === 'COUNTDOWN' && 'GET READY'}
              {phase === 'REVEALED' && 'REVEALING...'}
              {phase === 'RANKING' && 'AI ANALYZING'}
              {phase === 'COMPLETED' && 'ROUND COMPLETE'}
              {phase === 'PENDING' && 'WAITING FOR PLAYERS'}
            </motion.span>
          </div>

          {/* Countdown */}
          <AnimatePresence mode="wait">
            {phase === 'COUNTDOWN' && (
              <motion.div
                key="countdown"
                className="fixed inset-0 flex items-center justify-center z-50 bg-neutral-950/90 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="text-9xl lg:text-[12rem] font-bold font-mono text-amber-400"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                  transition={{ duration: 1, repeat: countdown }}
                >
                  {countdown}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reveal Grid */}
          <AnimatePresence mode="wait">
            {phase === 'REVEALED' && (
              <motion.div
                key="reveal"
                className="w-full max-w-5xl grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.4 }}
              >
                {picks.map((pick, i) => (
                  <motion.div
                    key={pick.teamId}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    className="relative card p-4 overflow-hidden"
                    style={{ borderColor: pick.teamColor }}
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-4 mx-auto" style={{ backgroundColor: pick.teamColor }}>
                      {pick.teamShortName}
                    </div>
                    <h4 className="text-center font-semibold text-lg">{pick.playerName}</h4>
                    <p className="text-center text-xs text-neutral-500 capitalize">{pick.role}</p>
                    <p className="text-center text-sm font-bold text-amber-400">{formatPrice(pick.price)}</p>
                    <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-xs px-1.5 py-0.5 rounded">
                      LOCKED
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Ranking */}
          <AnimatePresence mode="wait">
            {phase === 'RANKING' && ranking.length > 0 && (
              <motion.div
                key="ranking"
                className="w-full max-w-2xl card p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="flex items-center gap-2 text-amber-400 mb-4">
                  <Bot className="w-6 h-6" />
                  <h3 className="font-semibold text-lg">Grok Analysis - {POSITION_NAMES[currentPosition]}</h3>
                </div>
                <ol className="space-y-3">
                  {ranking.map((r, i) => {
                    const team = room.teams.find(t => t.id === r.teamId)
                    const point = points.find(p => p.teamId === r.teamId)
                    const teamColor = team?.color || '#64748b'
                    const teamShort = team?.shortName || '??'
                    
                    return (
                      <motion.li
                        key={r.playerId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg"
                      >
                        <span className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
                          i === 0 ? 'bg-amber-500/30 text-amber-400' :
                          i === 1 ? 'bg-neutral-400/30 text-neutral-300' :
                          i === 2 ? 'bg-amber-700/30 text-amber-600' :
                          'bg-transparent'
                        )}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0" style={{ borderLeftColor: teamColor }}>
                          <p className="font-medium">{ranking.find(rk => rk.playerId === r.playerId)?.playerId} <span className="text-xs text-neutral-500">({teamShort})</span></p>
                          <p className="text-xs text-neutral-500">{r.reasoning}</p>
                        </div>
                        {point && (
                          <span className="text-sm font-bold text-amber-400">+{point.points} pts</span>
                        )}
                      </motion.li>
                    )
                  })}
                </ol>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Points Awarded */}
          <AnimatePresence mode="wait">
            {phase === 'COMPLETED' && points.length > 0 && (
              <motion.div
                key="points"
                className="w-full max-w-2xl card p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h4 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Points Awarded
                </h4>
                <div className="space-y-2">
                  {points.sort((a, b) => b.points - a.points).map(p => {
                    const team = room.teams.find(t => t.id === p.teamId)
                    return (
                      <div key={p.teamId} className="flex items-center justify-between p-2 bg-neutral-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: team?.color }}>
                            {team?.shortName}
                          </div>
                          <span className="font-medium">{team?.ownerName}</span>
                        </div>
                        <span className={cn('font-bold text-lg', p.rank === 1 ? 'text-amber-400' : 'text-white')}>
                          +{p.points}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending State */}
          {phase === 'PENDING' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
              <p className="text-neutral-400">
                {waitingFor.length > 0 
                  ? `Waiting for ${waitingFor.join(', ')} to lock Position ${currentPosition}`
                  : 'All players locked. Starting next round...'}
              </p>
            </div>
          )}

          {/* Match Not Started */}
          {room.status === 'LOBBY' && (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Match Not Started</h3>
              <p className="text-neutral-400 mb-6">
                Host will start the match when all teams have locked their lineups.
              </p>
              {isHost && (
                <button onClick={() => socket?.emit('match:start')} className="btn-primary text-lg px-8 py-3">
                  Start Match
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Recent Activity (Mobile hidden) */}
        <aside className="w-full lg:w-64 lg:flex-shrink-0 border-l border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto hidden lg:block">
          <h4 className="font-semibold text-amber-400 mb-3">RECENT ACTIVITY</h4>
          <div className="space-y-2 text-sm">
            {phase === 'RANKING' && ranking.slice(0, 3).map((r, i) => (
              <div key={r.playerId} className="p-2 bg-neutral-800/50 rounded-lg">
                <p className="font-medium">#{i + 1}: {ranking.find(rk => rk.playerId === r.playerId)?.playerId}</p>
                <p className="text-xs text-neutral-500">{r.reasoning}</p>
              </div>
            ))}
            {phase === 'COMPLETED' && points.map(p => {
              const team = room.teams.find(t => t.id === p.teamId)
              return (
                <div key={p.teamId} className="p-2 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team?.ownerName}</span>
                    <span className="text-amber-400 font-bold">+{p.points}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </main>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="card p-4 flex items-center gap-3 max-w-md shadow-xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamScoreCard({ team, score, isWinner }: { team: TeamState; score: ScoreState | undefined; isWinner: boolean }) {
  return (
    <div className={cn(
      'p-3 rounded-xl flex items-center gap-3 transition-all',
      isWinner ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-neutral-800/50 border border-neutral-700'
    )}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: team.color }}>
        {team.shortName}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{team.ownerName}</p>
        <p className="text-xs text-neutral-500">
          {score ? `Last: +${score.points} (Rank ${score.rank})` : 'Not started'}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('text-lg font-bold', isWinner ? 'text-amber-400' : 'text-white')}>
          {score?.total || 0}
        </p>
        {isWinner && <Crown className="w-5 h-5 text-amber-400 mx-auto" />}
      </div>
    </div>
  )
}