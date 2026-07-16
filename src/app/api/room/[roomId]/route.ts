import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params

    // Try to find by auctionRoomId first (the 6-char code)
    let room = await prisma.room.findUnique({
      where: { auctionRoomId: roomId },
      include: {
        teams: {
          include: {
            players: true,
            lineup: {
              include: { 
                slots: { 
                  include: { player: true },
                  orderBy: { position: 'asc' }
                } 
              }
            },
            scores: true,
          },
        },
        participants: true,
        rounds: {
          include: {
            picks: { include: { player: true, team: true } },
            scores: true,
          },
          orderBy: { roundNumber: 'asc' },
        },
      },
    })

    // If not found, try by internal ID
    if (!room) {
      room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          teams: {
            include: {
              players: true,
              lineup: {
                include: { 
                  slots: { 
                    include: { player: true },
                    orderBy: { position: 'asc' }
                  } 
                }
              },
              scores: true,
            },
          },
          participants: true,
          rounds: {
            include: {
              picks: { include: { player: true, team: true } },
              scores: true,
            },
            orderBy: { roundNumber: 'asc' },
          },
        },
      })
    }

    if (!room) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Room not found' },
      }, { status: 404 })
    }

    // Transform to client-friendly format
    const data = {
      id: room.id,
      auctionRoomId: room.auctionRoomId,
      status: room.status,
      currentRound: room.currentRound,
      currentPosition: room.currentPosition,
      hostSocketId: room.hostSocketId,
      createdAt: room.createdAt.toISOString(),
      teams: room.teams.map(t => ({
        id: t.id,
        teamId: t.teamId,
        name: t.name,
        shortName: t.shortName,
        color: t.color,
        claimStatus: t.claimStatus,
        ownerSocketId: t.ownerSocketId,
        ownerName: t.ownerName,
        requestedBySocketId: t.requestedBySocketId,
        requestedByName: t.requestedByName,
        purse: t.purse,
        players: t.players.map(p => ({
          id: p.id,
          playerId: p.playerId,
          name: p.name,
          role: p.role,
          isOverseas: p.isOverseas,
          price: p.price,
          auctionData: p.auctionData,
        })),
        lineup: t.lineup ? {
          id: t.lineup.id,
          isLocked: t.lineup.isLocked,
          lockedAt: t.lineup.lockedAt?.toISOString(),
          slots: t.lineup.slots.map(s => ({
            id: s.id,
            position: s.position,
            playerId: s.playerId,
            player: s.player ? {
              id: s.player.id,
              playerId: s.player.playerId,
              name: s.player.name,
              role: s.player.role,
              isOverseas: s.player.isOverseas,
              price: s.player.price,
              auctionData: s.player.auctionData,
            } : null,
            isLocked: s.isLocked,
            lockedAtRound: s.lockedAtRound,
          })),
        } : null,
        isLocked: t.lineup?.isLocked || false,
      })),
      participants: room.participants.map(p => ({
        id: p.id,
        socketId: p.socketId,
        displayName: p.displayName,
        teamId: p.teamId,
        isHost: p.isHost,
        isOnline: p.isOnline,
        joinedAt: p.joinedAt.toISOString(),
      })),
      rounds: room.rounds.map(r => ({
        id: r.id,
        roundNumber: r.roundNumber,
        position: r.position,
        phase: r.phase,
        aiResponse: r.aiResponse,
        startedAt: r.startedAt?.toISOString(),
        completedAt: r.completedAt?.toISOString(),
        picks: r.picks.map(p => ({
          id: p.id,
          teamId: p.teamId,
          playerId: p.playerId,
          position: p.position,
          player: p.player ? {
            id: p.player.id,
            playerId: p.player.playerId,
            name: p.player.name,
            role: p.player.role,
            isOverseas: p.player.isOverseas,
            price: p.player.price,
          } : null,
          team: p.team ? {
            id: p.team.id,
            teamId: p.team.teamId,
            shortName: p.team.shortName,
            color: p.team.color,
          } : null,
        })),
        scores: r.scores.map(s => ({
          id: s.id,
          teamId: s.teamId,
          points: s.points,
          rank: s.rank,
          total: s.total,
        })),
      })),
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get room error:', error)
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room' },
    }, { status: 500 })
  }
}