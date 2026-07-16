import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Input schema from userscript
const ImportPayloadSchema = z.object({
  auctionRoomId: z.string().length(6),
  teams: z.array(z.object({
    teamId: z.string(),
    name: z.string(),
    shortName: z.string(),
    color: z.string(),
    purse: z.number(),
    players: z.array(z.object({
      playerId: z.string(),
      name: z.string(),
      role: z.enum(['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']),
      isOverseas: z.boolean(),
      price: z.number(),
      auctionData: z.any(),
    })),
  })).length(10),
  auctionSettings: z.object({
    mode: z.enum(['MINI_2026', 'MEGA']),
    purseAmount: z.number(),
    bidTimer: z.number(),
  }),
  exportedAt: z.string().datetime(),
  exportedBy: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = ImportPayloadSchema.parse(body)

    // Check if room already exists (idempotent)
    const existingRoom = await prisma.room.findUnique({
      where: { auctionRoomId: payload.auctionRoomId },
    })

    if (existingRoom) {
      return NextResponse.json({
        success: true,
        data: { 
          roomId: existingRoom.id,
          shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/room/${payload.auctionRoomId}`,
          alreadyExists: true,
        },
      })
    }

    // Create room and all related data in transaction
    const room = await prisma.$transaction(async (tx) => {
      // 1. Create Room
      const newRoom = await tx.room.create({
        data: {
          auctionRoomId: payload.auctionRoomId,
          status: 'LOBBY',
          currentRound: 0,
        },
      })

      // 2. Create Teams
      const teamCreates = payload.teams.map(team => 
        tx.team.create({
          data: {
            roomId: newRoom.id,
            teamId: team.teamId,
            name: team.name,
            shortName: team.shortName,
            color: team.color,
            claimStatus: 'UNCLAIMED',
            purse: team.purse,
          },
        })
      )
      const createdTeams = await Promise.all(teamCreates)
      const teamIdMap = new Map(createdTeams.map(t => [t.teamId, t.id]))

      // 3. Create Players
      const playerCreates: any[] = []
      for (const team of payload.teams) {
        const dbTeamId = teamIdMap.get(team.teamId)!
        for (const player of team.players) {
          playerCreates.push(
            tx.player.create({
              data: {
                roomId: newRoom.id,
                teamId: dbTeamId,
                playerId: player.playerId,
                name: player.name,
                role: player.role,
                isOverseas: player.isOverseas,
                price: player.price,
                auctionData: player.auctionData,
              },
            })
          )
        }
      }
      await Promise.all(playerCreates)

      // 4. Create empty Lineups (one per team)
      const lineupCreates = createdTeams.map(t => 
        tx.lineup.create({
          data: {
            roomId: newRoom.id,
            teamId: t.id,
            isLocked: false,
            slots: {
              create: Array.from({ length: 11 }, (_, i) => ({
                position: i + 1,
                playerId: '', // Will be filled when user selects
                isLocked: false,
              })),
            },
          },
        })
      )
      await Promise.all(lineupCreates)

      return newRoom
    })

    return NextResponse.json({
      success: true,
      data: {
        roomId: room.id,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/room/${payload.auctionRoomId}`,
        alreadyExists: false,
      },
    })
  } catch (error) {
    console.error('Import room error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to import room data' },
    }, { status: 500 })
  }
}