// Shared TypeScript types for Socket.io events

export interface RoomState {
  id: string
  auctionRoomId: string
  status: 'LOBBY' | 'MATCH' | 'COMPLETED'
  currentRound: number
  currentPosition: number | null
  hostSocketId: string | null
  teams: TeamState[]
  participants: ParticipantState[]
  createdAt: string
}

export interface TeamState {
  id: string
  teamId: string
  name: string
  shortName: string
  color: string
  claimStatus: 'UNCLAIMED' | 'PENDING' | 'APPROVED'
  ownerSocketId: string | null
  ownerName: string | null
  purse: number
  players: PlayerState[]
  lineup: LineupSlotState[] | null
  isLocked: boolean
}

export interface PlayerState {
  id: string
  playerId: string
  name: string
  role: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER'
  isOverseas: boolean
  price: number
  auctionData: any
}

export interface LineupSlotState {
  id: string
  position: number
  playerId: string | null
  player: PlayerState | null
  isLocked: boolean
  lockedAtRound: number | null
}

export interface ParticipantState {
  id: string
  socketId: string
  displayName: string
  teamId: string | null
  isHost: boolean
  isOnline: boolean
}

export interface ScoreState {
  id: string
  roundId: string
  teamId: string
  points: number
  rank: number
  total: number
}

// Client -> Server Events
export interface ClientToServerEvents {
  'room:join': (data: { roomId: string; displayName: string }) => void
  'team:request': (data: { teamId: string }) => void
  'team:approve': (data: { teamId: string; socketId: string }) => void
  'team:reject': (data: { teamId: string; socketId: string }) => void
  'lineup:update': (data: { lineupSlots: LineupSlotInput[] }) => void
  'lineup:lock': (data: { position: number }) => void
  'match:start': () => void
  'round:ready': () => void
  'match:pause': () => void
  'match:resume': () => void
  'match:end': () => void
}

export interface LineupSlotInput {
  position: number
  playerId: string | null
}

// Server -> Client Events
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void
  'user:joined': (user: ParticipantState) => void
  'user:left': (socketId: string) => void
  'team:claimed': (data: { teamId: string; userId: string; displayName: string }) => void
  'team:requested': (data: { teamId: string; userId: string; displayName: string }) => void
  'team:approved': (data: { teamId: string; userId: string; displayName: string }) => void
  'team:rejected': (data: { teamId: string; userId: string }) => void
  'lineup:synced': (data: { teamId: string; lineupSlots: LineupSlotState[]; lockedPositions: number[] }) => void
  'pending:update': (data: { waitingFor: string[] }) => void
  'round:start': (data: { roundNumber: number; position: number; countdown: number }) => void
  'round:reveal': (data: { picks: PickState[] }) => void
  'round:ranking': (data: { ranking: AIRanking[]; points: ScoreState[] }) => void
  'round:complete': (data: { leaderboard: TeamScore[] }) => void
  'match:complete': (data: { finalStandings: TeamScore[]; winner: TeamScore }) => void
  'host:changed': (newHostSocketId: string) => void
  'error': (message: string) => void
}

export interface PickState {
  teamId: string
  teamShortName: string
  teamColor: string
  playerId: string
  playerName: string
  role: string
  price: number
  position: number
}

export interface AIRanking {
  playerId: string
  teamId: string
  rank: number
  reasoning: string
}

export interface TeamScore {
  teamId: string
  teamShortName: string
  teamColor: string
  ownerName: string
  total: number
  lastRoundPoints: number
  roundScores: number[]
}

// Socket Data
export interface SocketData {
  roomId: string | null
  userId: string | null
  displayName: string | null
  teamId: string | null
  isHost: boolean
}