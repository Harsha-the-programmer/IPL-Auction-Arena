'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { motion } from 'framer-motion'
import { 
  Trophy, Crown, Medal, Share2, Copy, 
  Download, Camera, RotateCcw, ChevronLeft,
  CheckCircle, Sparkles, Zap
} from 'lucide-react'
import { cn, formatPrice, getTeamInfo, IPL_TEAMS } from '@/lib/utils'
import type { TeamScore, TeamState } from '@/lib/types'

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [socket, setSocket] = useState<Socket | null>(null)
  const [finalStandings, setFinalStandings] = useState<TeamScore[]>([])
  const [winner, setWinner] = useState<TeamScore | null>(null)
  const [roomData, setRoomData] = useState<{ teams: TeamState[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_APP_URL || '', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      newSocket.emit('room:join', { roomId, displayName: '' })
    })

    newSocket.on('room:state', (state: any) => {
      setRoomData({ teams: state.teams })
    })

    newSocket.on('match:complete', (data: { finalStandings: TeamScore[]; winner: TeamScore }) => {
      setFinalStandings(data.finalStandings)
      setWinner(data.winner)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 5000)
    })

    setSocket(newSocket)
    return () => newSocket.close()
  }, [roomId])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const text = `🏏 IPL Auction Arena Results!\n\n🥇 Winner: ${winner?.ownerName} (${winner?.teamShortName}) - ${winner?.total} pts\n\nRoom: ${roomId}\n${window.location.href}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const playAgain = () => {
    router.push('/')
  }

  if (!winner) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div className="text-amber-500 animate-spin" style={{ width: 48, height: 48 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </motion.div>
      </div>
    )
  }

  const podium = finalStandings.slice(0, 3)
  const others = finalStandings.slice(3)

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col relative overflow-hidden">
      {/* Confetti Canvas */}
      {showConfetti && (
        <canvas 
          id="confetti-canvas"
          className="fixed inset-0 pointer-events-none z-40"
          style={{ width: '100%', height: '100%' }}
        />
      )}

      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h1 className="font-bold text-lg">Match Complete</h1>
            <span className="badge bg-amber-500/20 text-amber-400 font-mono">Room: {roomId}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyLink} className="btn-secondary btn-sm">
              <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={shareWhatsApp} className="btn-secondary btn-sm bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Winner Podium */}
        <section className="mb-12">
          <motion.div
            className="flex justify-center gap-4 md:gap-8 items-end"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {/* 2nd Place */}
            {podium[1] && (
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <Medal className="w-16 h-16 text-neutral-400 mb-2" />
                <div className="w-40 h-32 bg-neutral-800/50 border border-neutral-700 rounded-t-2xl flex flex-col items-center justify-end p-4 relative">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-2 mx-auto" style={{ backgroundColor: getTeamInfo(podium[1].teamId).color }}>
                    {podium[1].teamShortName}
                  </div>
                  <p className="font-semibold text-center">{podium[1].ownerName}</p>
                  <p className="text-xs text-neutral-500 text-center">{podium[1].total} pts</p>
                </div>
                <p className="text-center text-neutral-500 text-sm mt-2">2nd Place</p>
              </motion.div>
            )}

            {/* 1st Place */}
            <motion.div
              className="flex flex-col items-center relative z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, type: 'spring', stiffness: 100 }}
            >
              <div className="relative mb-4">
                <Crown className="w-20 h-20 text-amber-400 animate-bounce" />
                {showConfetti && <Sparkles className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 text-amber-300 animate-spin" />}
              </div>
              <div className="w-48 h-48 bg-gradient-to-b from-amber-500/20 to-orange-500/10 border-2 border-amber-500/50 rounded-t-3xl flex flex-col items-center justify-end p-6 relative">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-3 mx-auto shadow-2xl shadow-amber-500/30" style={{ backgroundColor: getTeamInfo(winner.teamId).color }}>
                  {winner.teamShortName}
                </div>
                <p className="text-center font-bold text-xl">{winner.ownerName}</p>
                <p className="text-center text-amber-400 font-bold text-2xl">{winner.total} pts</p>
                <div className="absolute top-4 right-4">
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
              </div>
              <p className="text-center text-amber-400 font-bold text-lg mt-3">🏆 CHAMPION 🏆</p>
            </motion.div>

            {/* 3rd Place */}
            {podium[2] && (
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <Medal className="w-16 h-16 text-amber-700 mb-2" />
                <div className="w-40 h-32 bg-neutral-800/50 border border-neutral-700 rounded-t-2xl flex flex-col items-center justify-end p-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-2 mx-auto" style={{ backgroundColor: getTeamInfo(podium[2].teamId).color }}>
                    {podium[2].teamShortName}
                  </div>
                  <p className="font-semibold text-center">{podium[2].ownerName}</p>
                  <p className="text-xs text-neutral-500 text-center">{podium[2].total} pts</p>
                </div>
                <p className="text-center text-neutral-500 text-sm mt-2">3rd Place</p>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Full Scoreboard */}
        <section className="mb-12">
          <motion.div
            className="card overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                Final Standings
              </h2>
              <span className="badge bg-amber-500/20 text-amber-400">{finalStandings.length} Teams</span>
            </div>
            <div className="divide-y divide-neutral-800">
              {finalStandings.map((standing, index) => {
                const teamInfo = getTeamInfo(standing.teamId)
                const isTop3 = index < 3
                return (
                  <motion.div
                    key={standing.teamId}
                    className={cn(
                      'p-4 flex items-center gap-4 transition-colors',
                      isTop3 && 'bg-amber-500/5',
                      index % 2 === 0 && 'bg-neutral-900/30'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
                  >
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0',
                      index === 0 ? 'text-2xl' : index === 1 ? 'text-xl' : 'text-lg'
                    )} style={{ backgroundColor: teamInfo.color }}>
                      {standing.teamShortName}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-semibold', 
                          index === 0 && 'text-amber-400 text-xl',
                          index === 1 && 'text-neutral-300 text-lg',
                          index === 2 && 'text-amber-700 text-lg',
                          index >= 3 && 'text-white'
                        )}>
                          #{index + 1}
                        </span>
                        <span className="font-medium truncate">{standing.ownerName}</span>
                        {index === 0 && <Crown className="w-5 h-5 text-amber-400" />}
                        {index === 1 && <Medal className="w-5 h-5 text-neutral-400" />}
                        {index === 2 && <Medal className="w-5 h-5 text-amber-700" />}
                      </div>
                      <p className="text-xs text-neutral-500">{teamInfo.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('font-bold text-2xl', index === 0 ? 'text-amber-400' : 'text-white')}>
                        {standing.total}
                      </p>
                      <p className="text-xs text-neutral-500">Total Points</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </section>

        {/* Round Breakdown (if we had the data) */}
        {roomData && (
          <section className="mb-12">
            <motion.div
              className="card overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              <div className="p-4 border-b border-neutral-800">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Round-by-Round Breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-neutral-500 text-left border-b border-neutral-800">
                      <th className="p-3 font-medium w-24">Team</th>
                      {Array.from({ length: 10 }, (_, i) => (
                        <th key={i} className="p-3 font-medium text-center w-16">
                          R{i + 1}
                        </th>
                      ))}
                      <th className="p-3 font-medium text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalStandings.map((standing, rowIndex) => {
                      const teamInfo = getTeamInfo(standing.teamId)
                      return (
                        <tr key={standing.teamId} className={cn('border-b border-neutral-800/50', rowIndex === 0 && 'bg-amber-500/5')}>
                          <td className="p-3 flex items-center gap-2 font-medium">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: teamInfo.color }}>
                              {standing.teamShortName}
                            </div>
                            {standing.ownerName}
                          </td>
                          {/* Round scores would need to be stored - placeholder */}
                          {Array.from({ length: 10 }, (_, i) => (
                            <td key={i} className="p-3 text-center text-neutral-500">—</td>
                          ))}
                          <td className="p-3 text-right font-bold text-lg">{standing.total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={playAgain} className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Play Again
          </button>
          <button onClick={copyLink} className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-2">
            <Copy className="w-5 h-5" />
            {copied ? 'Link Copied!' : 'Copy Room Link'}
          </button>
          <button onClick={shareWhatsApp} className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30">
            <Share2 className="w-5 h-5" />
            Share Results
          </button>
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-neutral-800">
        <div className="max-w-5xl mx-auto text-center text-neutral-500 text-sm">
          <p>Great game! Ready for the next auction? <a href="/" className="text-amber-400 hover:underline">Start a new arena</a></p>
        </div>
      </footer>

      {/* Confetti Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const canvas = document.getElementById('confetti-canvas');
              if (!canvas) return;
              const ctx = canvas.getContext('2d');
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
              
              const confetti = [];
              const colors = ['#f59e0b', '#fbbf24', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#3b82f6', '#22c55e'];
              
              for (let i = 0; i < 150; i++) {
                confetti.push({
                  x: Math.random() * canvas.width,
                  y: Math.random() * canvas.height - canvas.height,
                  w: 8 + Math.random() * 8,
                  h: 8 + Math.random() * 8,
                  color: colors[Math.floor(Math.random() * colors.length)],
                  speed: 2 + Math.random() * 4,
                  angle: Math.random() * 360,
                  rotation: Math.random() * 10 - 5
                });
              }
              
              function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                confetti.forEach(c => {
                  c.y += c.speed;
                  c.angle += c.rotation;
                  if (c.y > canvas.height) {
                    c.y = -20;
                    c.x = Math.random() * canvas.width;
                  }
                  ctx.save();
                  ctx.translate(c.x + c.w/2, c.y + c.h/2);
                  ctx.rotate(c.angle * Math.PI / 180);
                  ctx.fillStyle = c.color;
                  ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h);
                  ctx.restore();
                });
                requestAnimationFrame(animate);
              }
              animate();
              
              // Auto-remove after 5 seconds
              setTimeout(() => {
                canvas.remove();
              }, 5000);
            })();
          `
        }}
      />
    </div>
  )
}