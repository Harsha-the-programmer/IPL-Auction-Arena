'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, Crown, Timer, Bot, Zap, Pause, Play, 
  SkipForward, X, CheckCircle, Loader2, AlertCircle,
  ChevronLeft, Share2
} from 'lucide-react'
import { cn, formatPrice, getTeamInfo, IPL_TEAMS } from '@/lib/utils'
import type { RoomState, TeamState, PickState, AIRanking, ScoreState, TeamScore } from '@/lib/types'
import { useSocket } from '@/lib/socket-context'

const POSITION_NAMES = ['', 'OPENER 1', 'OPENER 2', '#3', '#4', '#5', '#6', '#6', '#7', '#8', '#9', '#10', '#11']
const POSITION_BADGES = ['', 'OPENER', 'OPENER', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11']
const POSITION_ENUM_TO_INDEX: Record<string, number> = {
  'OPENER_1': 1,
  'OPENER_2': 2,
  'THREE': 3,
  'FOUR': 4,
  'FIVE': 5,
  'SIX': 6,
  'SEVEN': 7,
  'EIGHT': 8,
  'NINE': 9,
  'TEN': 10,
  'ELEVEN': 11,
}

// Extended types with joined data from room
interface EnrichedRanking extends AIRanking {
  teamColor: string
  playerName: string
  points: number
}

interface EnrichedScore extends ScoreState {
  teamShortName: string
  teamOwnerName: string
  teamColor: string
}

interface EnrichedTeamScore extends TeamScore {
  rank: number
}

export default function MatchPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const { 
    socket, 
    room, 
    myTeam, 
    isHost, 
    error: socketError,
  } = useSocket()

  const [phase, setPhase] = useState<'PENDING' | 'COUNTDOWN' | 'REVEALED' | 'RANKING' | 'COMPLETED'>('PENDING')
  const [countdown, setCountdown] = useState(3)
  const [picks, setPicks] = useState<PickState[]>([])
  const [ranking, setRanking] = useState<EnrichedRanking[]>([])
  const [points, setPoints] = useState<EnrichedScore[]>([])
  const [leaderboard, setLeaderboard] = useState<EnrichedTeamScore[]>([])
  const [finalStandings, setFinalStandings] = useState<EnrichedTeamScore[]>([])
  const [winner, setWinner] = useState<EnrichedTeamScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waitingFor, setWaitingFor] = useState<string[]>([])
  const [showShare, setShowShare] = useState(false)

  const countdownRef = useRef(countdown)
  countdownRef.current = countdown

  // Helper to enrich ranking data
  const enrichRanking = (rawRanking: AIRanking[], picksData: PickState[], pointsData: ScoreState[]): EnrichedRanking[] => {
    return rawRanking.map(r => {
      const pick = picksData.find(p => p.playerId === r.playerId)
      const point = pointsData.find(p => p.teamId === r.teamId)
      const team = room?.teams.find(t => t.teamId === r.teamId)
      return {
        ...r,
        teamColor: team?.color || '#64748b',
        playerName: pick?.playerName || 'Unknown',
        points: point?.points || 0,
      }
    })
  }

  // Helper to enrich score data
  const enrichPoints = (rawPoints: ScoreState[]): EnrichedScore[] => {
    return rawPoints.map(p => {
      const team = room?.teams.find(t => t.teamId === p.teamId)
      return {
        ...p,
        teamShortName: team?.shortName || '??',
        teamOwnerName: team?.ownerName || 'Unknown',
        teamColor: team?.color || '#64748b',
      }
    })
  }

  // Helper to enrich leaderboard
  const enrichLeaderboard = (rawLeaderboard: TeamScore[]): EnrichedTeamScore[] => {
    return rawLeaderboard.map((team, index) => ({
      ...team,
      rank: index + 1,
    }))
  }

  // Initialize socket listeners
  useEffect(() => {
    if (!socket) return

    socket.on('round:start', (data: { roundNumber: number; position: number; countdown: number }) => {
      setPhase('COUNTDOWN')
      setCountdown(data.countdown)
      let current = data.countdown
      const interval = setInterval(() => {
        current--
        setCountdown(current)
        if (current <= 0) clearInterval(interval)
      }, 1000)
    })

    socket.on('round:reveal', (data: { picks: PickState[] }) => {
      setPhase('REVEALED')
      setPicks(data.picks)
    })

    socket.on('round:ranking', (data: { ranking: AIRanking[]; points: ScoreState[] }) => {
      setPhase('RANKING')
      setRanking(enrichRanking(data.ranking, picks, data.points))
      setPoints(enrichPoints(data.points))
    })

    socket.on('round:complete', (data: { leaderboard: TeamScore[] }) => {
      setPhase('COMPLETED')
      setLeaderboard(enrichLeaderboard(data.leaderboard))
      setTimeout(() => setPhase('PENDING'), 2000)
    })

    socket.on('match:complete', (data: { finalStandings: TeamScore[]; winner: TeamScore }) => {
      setFinalStandings(enrichLeaderboard(data.finalStandings))
      setWinner({ ...data.winner, rank: 1 })
      router.push(`/room/${roomId}/results`)
    })

    socket.on('pending:update', (data: { waitingFor: string[] }) => {
      setWaitingFor(data.waitingFor)
    })

    socket.on('host:changed', (newHostSocketId: string) => {
      // isHost will be updated via room state
    })

    socket.on('error', (message: string) => {
      setError(message)
    })

    socket.on('disconnect', () => {
      setError('Disconnected from server. Reconnecting...')
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err)
      setError('Connection failed. Retrying...')
    })

    return () => {
      socket.off('round:start')
      socket.off('round:reveal')
      socket.off('round:ranking')
      socket.off('round:complete')
      socket.off('match:complete')
      socket.off('pending:update')
      socket.off('host:changed')
      socket.off('error')
      socket.off('disconnect')
      socket.off('connect_error')
    }
  }, [socket, roomId, router, room, picks])

  const handlePause = () => socket?.emit('match:pause')
  const handleResume = () => socket?.emit('match:resume')
  const handleEnd = () => {
    if (confirm('End match early?')) socket?.emit('match:end')
  }
  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShowShare(true)
      setTimeout(() => setShowShare(false), 2000)
    } catch {
      setError('Failed to copy link')
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
  const totalRounds = 10

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
                <span className="font-bold text-amber-400 font-mono">{room.currentRound || 1}/{totalRounds}</span>
                <span className="text-neutral-600">•</span>
                <span className="badge bg-neutral-800 text-neutral-300">{POSITION_BADGES[POSITION_ENUM_TO_INDEX[room.currentPosition || 'OPENER_1'] || 1]}</span>
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
        <aside className="w-64 flex-shrink-0 hidden lg:block border-r border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto">
          <div className="sticky top-4">
            <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              LIVE SCORES
            </h3>
            <div className="space-y-2">
              {leaderboard.length > 0 ? (
                leaderboard.map((score) => {
                  const team = room?.teams.find(t => t.teamId === score.teamId)
                  if (!team) return null
                  return (
                    <div key={team.id} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${score.rank === 1 ? 'bg-amber-500/10 border border-amber-500/30' : score.rank === 2 ? 'bg-neutral-400/10 border border-neutral-400/30' : score.rank === 3 ? 'bg-amber-700/10 border border-amber-700/30' : 'bg-neutral-800/30'}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: team.color }}>
                        {team.shortName}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{team.ownerName}</p>
                        <p className="text-xs text-neutral-500">{team.shortName}</p>
                      </div>
                      <span className={`text-lg font-bold ${score.rank === 1 ? 'text-amber-400' : score.rank === 2 ? 'text-neutral-300' : score.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                        {score.total}
                      </span>
                      {score.rank === 1 && <Crown className="w-5 h-5 text-amber-400" />}
                      {score.rank === 2 && <span className="w-5 h-5 text-neutral-400">🥈</span>}
                      {score.rank === 3 && <span className="w-5 h-5 text-amber-600">🥉</span>}
                    </div>
                  )
                })
              ) : (
                room?.teams.filter(t => t.claimStatus === 'APPROVED').map(team => {
                  const score = leaderboard.find(s => s.teamId === team.id)
                  return (
                    <div key={team.id} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${score?.rank === 1 ? 'bg-amber-500/10 border border-amber-500/30' : score?.rank === 2 ? 'bg-neutral-400/10 border border-neutral-400/30' : score?.rank === 3 ? 'bg-amber-700/10 border border-amber-700/30' : 'bg-neutral-800/30'}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: team.color }}>
                        {team.shortName}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{team.ownerName}</p>
                        <p className="text-xs text-neutral-500">{team.shortName}</p>
                      </div>
                      <span className={`text-lg font-bold ${score?.rank === 1 ? 'text-amber-400' : score?.rank === 2 ? 'text-neutral-300' : score?.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                        {score?.total || 0}
                      </span>
                      {score?.rank === 1 && <Crown className="w-5 h-5 text-amber-400" />}
                      {score?.rank === 2 && <span className="w-5 h-5 text-neutral-400">🥈</span>}
                      {score?.rank === 3 && <span className="w-5 h-5 text-amber-600">🥉</span>}
                    </div>
                  )
                })
              )}
            </div>

            {waitingFor.length > 0 && (
              <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 font-medium mb-1">Waiting for:</p>
                <p className="text-sm">{waitingFor.join(', ')}</p>
              </div>
            )}

            {myTeam && !myTeam.isLocked && phase === 'PENDING' && (
              <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400 font-medium mb-1">Your turn to lock Position {room?.currentPosition}</p>
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
                className="fixed inset-0 flex items-center justify-center z-50 bg-neutral-950/90 backdrop-blur"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="text-9xl lg:text-[12rem] font-bold font-mono text-amber-400"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                  transition={{ duration: 1, repeat: countdown, repeatType: 'loop' }}
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
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.4 }}
              >
                {picks.map((pick, index) => (
                  <motion.div
                    key={pick.teamId}
                    className="relative card p-4 overflow-hidden"
                    style={{ borderColor: pick.teamColor }}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-4 mx-auto" style={{ backgroundColor: pick.teamColor }}>
                      {pick.teamShortName}
                    </div>
                    <h4 className="text-center font-semibold text-lg">{pick.playerName}</h4>
                    <p className="text-center text-xs text-neutral-500 capitalize">{pick.role}</p>
                    <p className="text-center text-sm font-bold text-amber-400">{formatPrice(pick.price)}</p>
                    <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded">
                      {pick.position}°
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
                className="w-full max-w-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-card border border-warning/30 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-amber-400 mb-4">
                    <Bot className="w-6 h-6" />
                    <h3 className="font-semibold text-lg">Grok Analysis - {POSITION_NAMES[POSITION_ENUM_TO_INDEX[room.currentPosition || 'OPENER_1'] || 1]}</h3>
                  </div>
                  <ol className="space-y-3">
                    {ranking.map((r, i) => (
                      <motion.li
                        key={r.playerId}
                        className={`flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg ${i === 0 ? 'bg-amber-500/10 border border-amber-500/30' : i === 1 ? 'bg-neutral-400/10 border border-neutral-400/30' : i === 2 ? 'bg-amber-700/10 border border-amber-700/30' : ''}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                      >
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${i === 0 ? 'bg-amber-500/30 text-amber-400' : i === 1 ? 'bg-neutral-400/30 text-neutral-300' : i === 2 ? 'bg-amber-700/30 text-amber-600' : 'bg-transparent'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0" style={{ borderLeftColor: r.teamColor }}>
                          <p className="font-medium">{r.playerName}</p>
                          <p className="text-xs text-neutral-500 capitalize">{r.reasoning}</p>
                        </div>
                        <span className="text-sm font-bold text-amber-400">+{r.points} pts</span>
                      </motion.li>
                    ))}
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Points Awarded */}
          <AnimatePresence mode="wait">
            {phase === 'COMPLETED' && points.length > 0 && (
              <motion.div
                key="points"
                className="w-full max-w-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-card border border-warning/30 rounded-xl p-4">
                  <h4 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Points Awarded - {POSITION_NAMES[POSITION_ENUM_TO_INDEX[room.currentPosition || 'OPENER_1'] || 1]}
                  </h4>
                  <div className="space-y-2">
                    {points.sort((a, b) => b.points - a.points).map((p, i) => (
                      <motion.li
                        key={p.teamId}
                        className="flex items_center justify-between p-2 bg-neutral-800/50 rounded-lg"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: p.teamColor }}>
                            {p.teamShortName}
                          </div>
                          <span className="font-medium">{p.teamOwnerName}</span>
                        </div>
                        <span className={cn('font-bold text-lg', p.rank === 1 ? 'text-amber-400' : 'text-white')}>
                          +{p.points}
                        </span>
                      </motion.li>
                    ))}
                  </div>
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
                  ? `Waiting for ${waitingFor.join(', ')} to lock Position ${room?.currentPosition}`
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
        <aside className="w-64 flex-shrink-0 hidden lg:block border-l border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto">
          <h4 className="font-semibold text-amber-400 mb-3">RECENT ACTIVITY</h4>
          <div className="space-y-2 text-sm">
            {phase === 'RANKING' && ranking.slice(0, 3).map((r, i) => (
              <div key={r.playerId} className="p-2 bg-neutral-800/50 rounded-lg">
                <p className="font-medium">#{r.rank}: {r.playerName}</p>
                <p className="text-xs text-neutral-500">{r.reasoning}</p>
              </div>
            ))}
            {phase === 'COMPLETED' && points.map((p, i) => {
              const team = room?.teams.find(t => t.teamId === p.teamId)
              return (
                <div key={p.teamId} className="p-2 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team?.ownerName}</span>
                    <span className="text-amber-400 font-bold">+{p.points}</span>
                  </div>
                </div>
              )
            })}
            {phase === 'PENDING' && waitingFor.length > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 font-medium mb-1">Waiting for:</p>
                <p className="text-sm">{waitingFor.join(', ')}</p>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-red-500/90 border border-red-500 text-white px-4 py-3 rounded-lg shadow-xl max-w-md shadow-xl">
            <AlertCircle className="w-5 h-5 inline-block mr-2" />
            {error}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <motion.div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full animate-in zoom-in-95"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="text-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-400 mb-2">Link Copied!</h3>
              <p className="text-neutral-400">Share this link with friends to join the arena.</p>
            </div>
            <button onClick={() => setShowShare(false)} className="btn-primary w-full py-3">
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}