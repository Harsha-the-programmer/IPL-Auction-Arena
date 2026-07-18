'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import type { RoomState, TeamState, ParticipantState, LineupSlotState, PickState, AIRanking, ScoreState, TeamScore } from '@/lib/types'

const SOCKET_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SocketContextType {
  socket: Socket | null
  room: RoomState | null
  myTeam: TeamState | null
  mySocketId: string
  isHost: boolean
  displayName: string
  setDisplayName: (name: string) => void
  joinRoom: (roomId: string, displayName: string) => void
  leaveRoom: () => void
  isLoading: boolean
  error: string | null
  requestTeam: (teamId: string) => void
  approveTeam: (teamId: string, userId: string) => void
  rejectTeam: (teamId: string, userId: string) => void
  startMatch: () => void
  updateLineup: (lineupSlots: { position: number; playerId: string | null }[]) => void
  lockPosition: (position: number) => void
}

const SocketContext = createContext<SocketContextType | null>(null)

export function SocketProvider({ children, roomId: initialRoomId }: { children: ReactNode; roomId?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [myTeam, setMyTeam] = useState<TeamState | null>(null)
  const [mySocketId, setMySocketId] = useState<string>('')
  const [isHost, setIsHost] = useState(false)
  const [displayName, setDisplayName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)

  const joinRoom = useCallback((roomId: string, displayName: string) => {
    setDisplayName(displayName)
    setCurrentRoomId(roomId)
    setIsLoading(true)
  }, [])

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.close()
      setSocket(null)
      setRoom(null)
      setMyTeam(null)
      setCurrentRoomId(null)
      setMySocketId('')
      setIsHost(false)
      setDisplayName('')
      setError(null)
    }
  }, [socket])

  const requestTeam = useCallback((teamId: string) => {
    socket?.emit('team:request', { teamId })
  }, [socket])

  const approveTeam = useCallback((teamId: string, userId: string) => {
    socket?.emit('team:approve', { teamId, socketId: userId })
  }, [socket])

  const rejectTeam = useCallback((teamId: string, userId: string) => {
    socket?.emit('team:reject', { teamId, socketId: userId })
  }, [socket])

  const startMatch = useCallback(() => {
    socket?.emit('match:start', {})
  }, [socket])

  const updateLineup = useCallback((lineupSlots: { position: number; playerId: string | null }[]) => {
    socket?.emit('lineup:update', { lineupSlots })
  }, [socket])

  const lockPosition = useCallback((position: number) => {
    socket?.emit('lineup:lock', { position })
  }, [socket])

  const sendChat = useCallback((message: string, gifId?: string) => {
    socket?.emit('chat:message', { message, gifId })
  }, [socket])

  const setBidTimer = useCallback((seconds: number) => {
    socket?.emit('setBidTimer', { seconds })
  }, [socket])

  const kickPlayer = useCallback((targetVisitorId: string) => {
    socket?.emit('kickPlayer', { targetVisitorId })
  }, [socket])

  const sendRoundReady = useCallback(() => {
    socket?.emit('round:ready', {})
  }, [socket])

  const value = {
    socket,
    room,
    myTeam,
    mySocketId,
    isHost,
    displayName,
    setDisplayName,
    joinRoom: (roomId: string, displayName: string) => {
      // The useEffect will handle the connection when currentRoomId changes
      // We just need to set the room ID
    },
    leaveRoom,
    isLoading,
    error,
    requestTeam,
    approveTeam,
    rejectTeam,
    startMatch,
    updateLineup,
    lockPosition,
    sendChat,
    setBidTimer,
    kickPlayer,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}