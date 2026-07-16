'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { cn } from '@/lib/utils'
import { 
  Users, Crown, Loader2, CheckCircle, XCircle, 
  AlertCircle, Copy, Share2, Lock, Unlock, 
  ChevronLeft, Plus, Minus, GripVertical,
  Timer, Bot, Trophy
} from 'lucide-react'
import { IPL_TEAMS, getTeamInfo, formatPrice } from '@/lib/utils'
import type { RoomState, TeamState, ParticipantState, LineupSlotState } from '@/lib/types'

const SOCKET_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = params.roomId

  const [socket, setSocket] = useState<Socket | null>(null)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [mySocketId, setMySocketId] = useState<string>('')
  const [displayName, setDisplayName] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize socket
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id)
      setMySocketId(newSocket.id)
      newSocket.emit('room:join', { roomId, displayName: displayName || 'Player' })
    })

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err)
      setError('Connection failed. Retrying...')
    })

    // Room state
    newSocket.on('room:state', (state: RoomState) => {
      console.log('[Socket] Room state received')
      setRoom(state)
      const me = state.participants.find(p => p.socketId === newSocket.id)
      if (me) {
        setDisplayName(me.displayName)
        setIsHost(me.isHost)
        if (me.teamId) {
          router.replace(`/room/${roomId}/lineup`)
        }
      }
      setShowNameModal(!me || !me.displayName)
    })

    newSocket.on('user:joined', (user: ParticipantState) => {
      setRoom(prev => prev ? {
        ...prev,
        participants: [...prev.participants.filter(p => p.socketId !== user.socketId), user]
      } : null)
    })

    newSocket.on('user:left', (socketId: string) => {
      setRoom(prev => prev ? {
        ...prev,
        participants: prev.participants.filter(p => p.socketId !== socketId)
      } : null)
    })

    newSocket.on('team:claimed', (data) => {
      setRoom(prev => prev ? {
        ...prev,
        teams: prev.teams.map(t => 
          t.teamId === data.teamId 
            ? { ...t, claimStatus: 'APPROVED', ownerSocketId: data.userId, ownerName: data.displayName }
            : t
        )
      } : null)
    })

    newSocket.on('team:requested', (data) => {
      if (isHost) {
        setRoom(prev => prev ? {
          ...prev,
          teams: prev.teams.map(t => 
            t.teamId === data.teamId 
              ? { ...t, claimStatus: 'PENDING', requestedBySocketId: data.userId, requestedByName: data.displayName }
              : t
          )
        } : null)
      }
    })

    newSocket.on('team:approved', (data) => {
      setRoom(prev => prev ? {
        ...prev,
        teams: prev.teams.map(t => 
          t.teamId === data.teamId 
            ? { ...t, claimStatus: 'APPROVED', ownerSocketId: data.userId, ownerName: data.displayName, requestedBySocketId: null, requestedByName: null }
            : t
        )
      } : null)
      // If it's me, redirect to lineup
      if (data.userId === mySocketId) {
        router.push(`/room/${roomId}/lineup`)
      }
    })

    newSocket.on('team:rejected', (data) => {
      setRoom(prev => prev ? {
        ...prev,
        teams: prev.teams.map(t => 
          t.teamId === data.teamId 
            ? { ...t, claimStatus: 'UNCLAIMED', requestedBySocketId: null, requestedByName: null }
            : t
        )
      } : null)
      if (data.userId === mySocketId) {
        setError('Your team request was rejected. Please choose another team.')
      }
    })

    newSocket.on('host:changed', (newHostSocketId: string) => {
      setIsHost(newHostSocketId === mySocketId)
    })

    newSocket.on('error', (message: string) => {
      setError(message)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [roomId, router, isHost, mySocketId])

  // Copy room link
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Share via WhatsApp
  const shareWhatsApp = () => {
    const text = `🏏 Join my IPL Auction Arena!\nRoom: ${roomId}\n\n${window.location.href}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Request team
  const requestTeam = (teamId: string) => {
    if (!displayName) {
      setShowNameModal(true)
      return
    }
    setPendingTeamId(teamId)
    socket?.emit('team:request', { teamId })
  }

  // Approve/Reject team (host only)
  const approveTeam = (teamId: string, userId: string) => {
    socket?.emit('team:approve', { teamId, socketId: userId })
  }

  const rejectTeam = (teamId: string, userId: string) => {
    socket?.emit('team:reject', { teamId, socketId: userId })
  }

  // Start match (host only)
  const startMatch = () => {
    socket?.emit('match:start', {})
  }

  // Submit name
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (displayName.trim()) {
      socket?.emit('room:join', { roomId, displayName: displayName.trim() })
      setShowNameModal(false)
      if (pendingTeamId) {
        socket?.emit('team:request', { teamId: pendingTeamId })
        setPendingTeamId(null)
      }
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    )
  }

  const myTeam = room.teams.find(t => t.ownerSocketId === mySocketId)
  const pendingTeams = room.teams.filter(t => t.claimStatus === 'PENDING')
  const approvedTeams = room.teams.filter(t => t.claimStatus === 'APPROVED')
  const allLocked = approvedTeams.length > 0 && approvedTeams.every(t => t.isLocked)

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="btn-ghost p-2">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex-1 text-center">
            <h1 className="font-bold text-lg">Room: <span className="font-mono text-amber-400 tracking-widest">{roomId}</span></h1>
            <p className="text-xs text-neutral-500">{room.participants.length} / 10 players</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={copyLink} className="btn-secondary px-3 py-1.5 text-sm gap-1.5">
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={shareWhatsApp} className="btn-secondary px-3 py-1.5 text-sm gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 bg-red-500/90 border border-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
          <AlertCircle className="w-5 h-5 inline-block mr-2" />
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Pending Requests (Host Only) */}
        {isHost && pendingTeams.length > 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Pending Team Requests
            </h3>
            <div className="flex flex-wrap gap-3">
              {pendingTeams.map(team => (
                <div key={team.teamId} className="flex items-center gap-3 px-4 py-2 bg-neutral-800/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: team.color }}>
                    {team.shortName}
                  </div>
                  <span className="font-medium">{team.requestedByName} wants {team.name}</span>
                  <button onClick={() => approveTeam(team.teamId, team.requestedBySocketId!)} className="btn-primary text-xs px-3 py-1">
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                  <button onClick={() => rejectTeam(team.teamId, team.requestedBySocketId!)} className="btn-danger text-xs px-3 py-1">
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Choose Your Team
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {IPL_TEAMS.map(teamConfig => {
              const team = room.teams.find(t => t.teamId === teamConfig.id)
              if (!team) return null

              const isMe = team.ownerSocketId === mySocketId
              const isClaimed = team.claimStatus === 'APPROVED'
              const isPending = team.claimStatus === 'PENDING'
              const canRequest = team.claimStatus === 'UNCLAIMED'

              return (
                <div 
                  key={teamConfig.id} 
                  className={cn(
                    'relative p-4 rounded-xl transition-all',
                    'team-ring',
                    isMe ? 'ring-2 ring-amber-400 bg-amber-500/10' : 
                    isClaimed ? 'ring-2 ring-green-500/50 bg-green-500/10' :
                    isPending ? 'ring-2 ring-amber-500/50 bg-amber-500/10' :
                    'bg-neutral-900/50 hover:bg-neutral-800/50'
                  )}
                  style={{ borderColor: isMe ? '#f59e0b' : isClaimed ? '#22c55e' : isPending ? '#f59e0b' : '#374151' }}
                >
                  {/* Team Badge */}
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: team.color }}>
                    {team.shortName}
                  </div>

                  <h3 className="text-center font-semibold mb-1">{team.name}</h3>
                  <p className="text-center text-xs text-neutral-500 mb-3">{team.ownerName || 'Unclaimed'}</p>

                  {/* Status */}
                  <div className="flex flex-col gap-2">
                    {isMe && (
                      <Link href={`/room/${roomId}/lineup`} className="btn-primary text-sm">
                        {team.isLocked ? (
                          <>
                            <Lock className="w-3 h-3" /> Lineup Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" /> Select Lineup
                          </>
                        )}
                      </Link>
                    )}
                    
                    {isClaimed && !isMe && (
                      <div className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg text-center">
                        🔒 {team.ownerName}
                      </div>
                    )}

                    {isPending && (
                      <div className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg text-center flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Pending Approval
                      </div>
                    )}

                    {canRequest && (
                      <button 
                        onClick={() => requestTeam(team.teamId)}
                        disabled={!displayName}
                        className="btn-secondary text-sm w-full"
                      >
                        Request Team
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Players List */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Players in Room
          </h2>
          <div className="grid gap-2">
            {room.participants.map(p => (
              <div key={p.socketId} className="flex items-center gap-3 p-3 bg-neutral-900/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-white font-bold text-sm">
                  {p.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    {p.displayName}
                    {p.isHost && <span className="badge-warning text-xs">Host</span>}
                    {p.socketId === mySocketId && <span className="badge text-xs bg-amber-500/20 text-amber-400">You</span>}
                  </p>
                  {p.teamId && (
                    <p className="text-xs text-neutral-500">
                      Team: <span className="font-medium text-white">{p.teamId}</span>
                    </p>
                  )}
                </div>
                <div className={cn('w-2 h-2 rounded-full', p.isOnline ? 'bg-green-500' : 'bg-neutral-600')} />
              </div>
            ))}
          </div>
        </div>

        {/* Start Match Button (Host) */}
        {isHost && approvedTeams.length > 0 && (
          <div className="border-t border-neutral-800 pt-6">
            <button 
              onClick={startMatch}
              disabled={!allLocked}
              className={cn('btn-primary w-full text-lg py-4', !allLocked && 'opacity-50 cursor-not-allowed')}
            >
              {allLocked ? '🚀 Start Match' : `Waiting for ${approvedTeams.filter(t => !t.isLocked).length} team(s) to lock lineup`}
            </button>
            {!allLocked && (
              <p className="text-center text-sm text-neutral-500 mt-2">
                All teams must lock their lineups before starting
              </p>
            )}
          </div>
        )}

        {/* My Team Info */}
        {myTeam && !isHost && (
          <div className="border-t border-neutral-800 pt-6">
            <Link href={`/room/${roomId}/lineup`} className="btn-primary w-full text-lg py-4">
              {myTeam.isLocked ? '🔒 Lineup Locked' : '✏️ Edit My Lineup'}
            </Link>
          </div>
        )}
      </main>

      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full animate-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold">Enter Your Name</h2>
              <p className="text-neutral-400 mt-1">This is how other players will see you</p>
            </div>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoFocus
                maxLength={20}
                className="input mb-4 text-center text-lg"
              />
              <button type="submit" disabled={!displayName.trim()} className="btn-primary w-full py-3">
                Continue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}