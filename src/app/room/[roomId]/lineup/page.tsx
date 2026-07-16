'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { 
  GripVertical, X, Lock, Unlock, ChevronLeft, 
  CheckCircle, Loader2, AlertCircle, Filter, 
  User, Crown, Zap
} from 'lucide-react'
import { 
  DndContext, closestCenter, KeyboardSensor, 
  PointerSensor, useSensor, useSensors, 
  DragEndEvent, DragOverlay 
} from '@dnd-kit/core'
import { 
  SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, formatPrice, getTeamInfo, IPL_TEAMS } from '@/lib/utils'
import type { RoomState, TeamState, PlayerState, LineupSlotState } from '@/lib/types'

const POSITION_LABELS = ['OPENER 1', 'OPENER 2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11']
const ROLE_COLORS = {
  BATTER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  BOWLER: 'bg-red-500/20 text-red-400 border-red-500/30',
  ALL_ROUNDER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  WICKET_KEEPER: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export default function LineupPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [socket, setSocket] = useState<Socket | null>(null)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [myTeam, setMyTeam] = useState<TeamState | null>(null)
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER'>('ALL')
  const [lockedPositions, setLockedPositions] = useState<number[]>([])
  const [currentPosition, setCurrentPosition] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Initialize socket
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_APP_URL || '', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      newSocket.emit('room:join', { roomId, displayName: '' }) // Name will be set via prompt
    })

    newSocket.on('room:state', (state: RoomState) => {
      setRoom(state)
      setIsLoading(false)
      
      // Find my team
      const participant = state.participants.find(p => p.socketId === newSocket.id)
      if (participant?.teamId) {
        const team = state.teams.find(t => t.id === participant.teamId)
        if (team) {
          setMyTeam(team)
          setLockedPositions(team.lineup?.filter(l => l.isLocked).map(l => l.position) || [])
        }
      }
    })

    newSocket.on('lineup:synced', (data: { teamId: string; lineupSlots: LineupSlotState[]; lockedPositions: number[] }) => {
      if (myTeam && data.teamId === myTeam.id) {
        setMyTeam(prev => prev ? { ...prev, lineup: data.lineupSlots } : null)
        setLockedPositions(data.lockedPositions)
      }
      setRoom(prev => prev ? {
        ...prev,
        teams: prev.teams.map(t => t.id === data.teamId ? { ...t, lineup: data.lineupSlots } : t)
      } : null)
    })

    newSocket.on('pending:update', (data: { waitingFor: string[] }) => {
      // Could show waiting indicator
    })

    newSocket.on('round:start', (data: { roundNumber: number; position: number; countdown: number }) => {
      setCurrentPosition(data.position)
      // Position locks will be handled by lineup:synced
    })

    newSocket.on('error', (message: string) => {
      setError(message)
    })

    newSocket.on('disconnect', () => {
      setError('Disconnected from server. Reconnecting...')
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [roomId])

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    if (!myTeam || !myTeam.lineup) return

    const activeIndex = myTeam.lineup.findIndex(s => s.id === active.id)
    const overIndex = myTeam.lineup.findIndex(s => s.id === over.id)
    if (activeIndex === -1 || overIndex === -1) return

    // Don't allow moving locked positions
    if (lockedPositions.includes(activeIndex + 1) || lockedPositions.includes(overIndex + 1)) return

    const newLineup = [...myTeam.lineup]
    const [removed] = newLineup.splice(activeIndex, 1)
    newLineup.splice(overIndex, 0, removed)

    // Re-index positions
    newLineup.forEach((slot, i) => {
      slot.position = i + 1
    })

    // Optimistic update
    setMyTeam(prev => prev ? { ...prev, lineup: newLineup } : null)

    // Emit to server
    socket?.emit('lineup:update', { 
      lineupSlots: newLineup.map(s => ({ position: s.position, playerId: s.playerId }))
    })
  }, [myTeam, lockedPositions, socket])

  // Filter players
  const availablePlayers = myTeam?.players.filter(p => 
    !myTeam.lineup?.some(s => s.playerId === p.id) &&
    (activeFilter === 'ALL' || p.role === activeFilter)
  ) || []

  const selectedCount = myTeam?.lineup?.filter(s => s.playerId).length || 0

  // Handle add player to lineup
  const handleAddPlayer = (player: PlayerState) => {
    if (!myTeam || !myTeam.lineup || selectedCount >= 11) return

    const emptySlotIndex = myTeam.lineup.findIndex(s => !s.playerId)
    if (emptySlotIndex === -1) return

    const newLineup = [...myTeam.lineup]
    newLineup[emptySlotIndex] = {
      ...newLineup[emptySlotIndex],
      playerId: player.id,
      player,
    }

    setMyTeam(prev => prev ? { ...prev, lineup: newLineup } : null)

    socket?.emit('lineup:update', {
      lineupSlots: newLineup.map(s => ({ position: s.position, playerId: s.playerId }))
    })
  }

  // Handle remove player from lineup
  const handleRemovePlayer = (slotId: string) => {
    if (!myTeam || !myTeam.lineup) return

    const slot = myTeam.lineup.find(s => s.id === slotId)
    if (!slot || !slot.playerId) return
    if (lockedPositions.includes(slot.position)) return

    const newLineup = myTeam.lineup.map(s => 
      s.id === slotId ? { ...s, playerId: null, player: null } : s
    )

    setMyTeam(prev => prev ? { ...prev, lineup: newLineup } : null)

    socket?.emit('lineup:update', {
      lineupSlots: newLineup.map(s => ({ position: s.position, playerId: s.playerId }))
    })
  }

  // Handle lock position
  const handleLockPosition = () => {
    if (!myTeam || !myTeam.lineup) return
    if (selectedCount < 11) return

    const positionToLock = currentPosition
    const slot = myTeam.lineup.find(s => s.position === positionToLock)
    if (!slot || !slot.playerId) return

    socket?.emit('lineup:lock', { position: positionToLock })
  }

  // Check if can lock
  const canLock = myTeam && myTeam.lineup && 
    selectedCount === 11 && 
    !lockedPositions.includes(currentPosition) &&
    myTeam.lineup.find(s => s.position === currentPosition)?.playerId

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="text-center card p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Team Selected</h2>
          <p className="text-neutral-400 mb-6">
            Go back to lobby and request a team, or wait for host approval.
          </p>
          <button 
            onClick={() => router.push(`/room/${roomId}`)}
            className="btn-primary"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  const teamInfo = getTeamInfo(myTeam.teamId as any)

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => router.push(`/room/${roomId}`)}
            className="btn-ghost p-2 lg:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ring-4 ring-offset-2 ring-offset-neutral-950',
              'team-ring'
            )} style={{ backgroundColor: teamInfo.color }}>
              {teamInfo.shortName}
            </div>
            <div>
              <h1 className="font-bold text-lg">{teamInfo.name}</h1>
              <p className="text-sm text-neutral-400">
                {lockedPositions.length > 0 
                  ? `Position ${currentPosition} • ${lockedPositions.length}/11 locked`
                  : 'Building lineup...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {room?.status === 'MATCH' && (
              <span className="badge bg-amber-500/20 text-amber-400 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                MATCH LIVE
              </span>
            )}
            {myTeam.isLocked && (
              <span className="badge badge-success flex items-center gap-1">
                <Lock className="w-3 h-3" />
                LINEUP LOCKED
              </span>
            )}
          </div>
        </div>

        {/* Position progress */}
        <div className="px-4 py-2 border-t border-neutral-800 hidden md:block">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span>BATTING ORDER PROGRESS</span>
              <span>{selectedCount}/11 Players</span>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {Array.from({ length: 11 }, (_, i) => {
                const pos = i + 1
                const isLocked = lockedPositions.includes(pos)
                const isCurrent = pos === currentPosition && room?.status === 'MATCH'
                const hasPlayer = myTeam.lineup?.find(s => s.position === pos)?.playerId
                
                return (
                  <div 
                    key={pos} 
                    className={cn(
                      'flex-shrink-0 w-16 md:w-20 flex flex-col items-center',
                      isLocked && 'opacity-60'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all',
                      isLocked ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      hasPlayer ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-neutral-800 text-neutral-500 border border-neutral-700',
                      isCurrent && 'ring-2 ring-amber-500 animate-pulse'
                    )}>
                      {isLocked ? <Lock className="w-4 h-4" /> : pos}
                    </div>
                    <span className="text-[10px] text-center whitespace-nowrap">{POSITION_LABELS[i]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        {/* Left: Batting Order */}
        <aside className="w-full lg:w-96 lg:flex-shrink-0 border-r border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <GripVertical className="w-5 h-5 text-amber-500" />
              BATTING ORDER
              <span className="badge bg-amber-500/20 text-amber-400">{selectedCount}/11</span>
            </h2>
            {selectedCount === 11 && !myTeam.isLocked && (
              <button 
                onClick={handleLockPosition}
                disabled={!canLock}
                className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1"
              >
                <Lock className="w-4 h-4" />
                Lock Position {currentPosition}
              </button>
            )}
          </div>

          <SortableContext items={myTeam.lineup?.map(s => s.id) || []} strategy={verticalListSortingStrategy}>
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-2" role="list" aria-label="Batting order">
                {myTeam.lineup?.map((slot, index) => (
                  <LineupSlotItem
                    key={slot.id}
                    slot={slot}
                    index={index}
                    isLocked={lockedPositions.includes(slot.position)}
                    onRemove={handleRemovePlayer}
                    teamColor={teamInfo.color}
                  />
                ))}
              </div>
            </DndContext>
          </SortableContext>

          {selectedCount < 11 && (
            <div className="mt-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-center text-neutral-400 text-sm">
              Add {11 - selectedCount} more player{11 - selectedCount !== 1 ? 's' : ''} to enable locking
            </div>
          )}
        </aside>

        {/* Right: Available Squad */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {(['ALL', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  activeFilter === filter 
                    ? 'bg-amber-500 text-black' 
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                )}
              >
                {filter === 'ALL_ROUNDER' ? 'ALL-ROUNDER' : filter}
              </button>
            ))}
          </div>

          {/* Players Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {availablePlayers.map(player => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onClick={() => handleAddPlayer(player)}
                disabled={selectedCount >= 11}
                teamColor={teamInfo.color}
              />
            ))}

            {availablePlayers.length === 0 && (
              <div className="col-span-full text-center py-12 text-neutral-500">
                <Filter className="w-12 h-12 mx-auto mb-3 text-neutral-700" />
                <p>No players available for this filter</p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-8 pt-6 border-t border-neutral-800">
            <h4 className="font-medium mb-3">Role Legend</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(ROLE_COLORS).map(([role, classes]) => (
                <span key={role} className={cn('badge', classes, 'flex items-center gap-1')}>
                  {role === 'ALL_ROUNDER' ? 'AR' : role[0]}
                  <span className="text-neutral-400">{role.replace('_', ' ')}</span>
                </span>
              ))}
              <span className="badge bg-amber-500/20 text-amber-400 flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Overseas
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Drag Overlay */}
      <DragOverlay>
        {({ active }) => {
          if (!active) return null
          const slot = myTeam?.lineup?.find(s => s.id === active.id)
          if (!slot?.player) return null
          return (
            <div className="rotate-3 shadow-2xl opacity-90">
              <PlayerCard player={slot.player} teamColor={teamInfo.color} isDragging />
            </div>
          )
        }}
      </DragOverlay>

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

// Lineup Slot Item Component
function LineupSlotItem({ 
  slot, 
  index, 
  isLocked, 
  onRemove, 
  teamColor 
}: { 
  slot: LineupSlotState
  index: number
  isLocked: boolean
  onRemove: (id: string) => void
  teamColor: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: slot.id,
    disabled: isLocked || !slot.playerId
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all',
        'bg-neutral-800/50 border',
        isLocked ? 'border-green-500/30 bg-green-500/10' : 'border-neutral-700 hover:border-amber-500/30',
        !slot.playerId && 'bg-neutral-800/50'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center',
          isLocked ? 'bg-green-500/20 text-green-400 cursor-default' : 
          'bg-neutral-700 text-neutral-400 hover:bg-amber-500/20 hover:text-amber-400'
        )}
        disabled={isLocked}
        aria-label={isLocked ? `Position ${slot.position} locked` : `Drag position ${slot.position}`}
      >
        {isLocked ? (
          <Lock className="w-4 h-4" />
        ) : (
          <GripVertical className="w-4 h-4" />
        )}
      </button>

      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
        !slot.playerId && 'bg-neutral-700 text-neutral-500'
      )} style={{ backgroundColor: slot.player ? teamColor : undefined }}>
        {slot.player ? teamColor.split('').slice(0,2).join('') : '+' }
      </div>

      <div className="flex-1 min-w-0">
        {slot.player ? (
          <>
            <p className="font-medium truncate">{slot.player.name}</p>
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <span className={cn('badge px-1.5 py-0.5 text-[10px]', ROLE_COLORS[slot.player.role])}>
                {slot.player.role === 'ALL_ROUNDER' ? 'AR' : slot.player.role[0]}
              </span>
              <span className="text-amber-400">{formatPrice(slot.player.price)}</span>
              {slot.player.isOverseas && <span className="text-amber-400">✦</span>}
            </p>
          </>
        ) : (
          <p className="text-neutral-500 text-sm">Empty slot - tap player to add</p>
        )}
      </div>

      {!isLocked && slot.playerId && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(slot.id) }}
          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          aria-label="Remove player"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isLocked && (
        <div className="flex items-center gap-1 text-green-400 text-xs font-medium px-2 py-0.5 bg-green-500/10 rounded">
          <Lock className="w-3 h-3" />
          LOCKED
        </div>
      )}
    </div>
  )
}

// Player Card Component
function PlayerCard({ 
  player, 
  onClick, 
  disabled, 
  teamColor,
  isDragging 
}: { 
  player: PlayerState
  onClick?: () => void
  disabled?: boolean
  teamColor: string
  isDragging?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-3 rounded-xl border transition-all text-left group',
        'bg-neutral-800/50 border-neutral-700 hover:border-amber-500/30',
        disabled && 'opacity-50 cursor-not-allowed',
        isDragging && 'rotate-3 shadow-2xl z-50'
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
          player.isOverseas && 'ring-2 ring-amber-500'
        )} style={{ backgroundColor: teamColor }}>
          {player.name.split(' ').map(n => n[0]).join('').slice(0,2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate group-hover:text-amber-400 transition-colors">{player.name}</p>
          <p className="text-xs text-neutral-500">{player.role.replace('_', ' ')}</p>
        </div>
        {player.isOverseas && (
          <span className="badge bg-amber-500/20 text-amber-400">OS</span>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-neutral-700">
        <span className="text-sm font-bold text-amber-400">{formatPrice(player.price)}</span>
        <span className={cn('badge px-2 py-0.5 text-[10px]', ROLE_COLORS[player.role])}>
          {player.role === 'ALL_ROUNDER' ? 'AR' : player.role[0]}
        </span>
      </div>
    </button>
  )
}