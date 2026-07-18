import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
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

// Create a separate PG pool for imports
const importPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

export async function POST(request: NextRequest) {
  const client = await importPool.connect()
  try {
    const body = await request.json()
    const payload = ImportPayloadSchema.parse(body)

    // Check if room already exists (idempotent)
    const existingRoom = await client.query(
      'SELECT id FROM room WHERE "auctionRoomId" = $1',
      [payload.auctionRoomId]
    )

    if (existingRoom.rows.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          roomId: existingRoom.rows[0].id,
          shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/room/${payload.auctionRoomId}`,
          alreadyExists: true,
        },
      })
    }

    await client.query('BEGIN')

    // 1. Create Room
    const roomResult = await client.query(
      `INSERT INTO room ("auctionRoomId", "status", "currentRound", "createdAt", "updatedAt")
       VALUES ($1, 'LOBBY', 0, now(), now())
       RETURNING id`,
      [payload.auctionRoomId]
    )
    const roomId = roomResult.rows[0].id

    // 2. Create Teams
    const teamIds: Record<string, string> = {}
    for (const team of payload.teams) {
      const teamResult = await client.query(
        `INSERT INTO team ("roomId", "teamId", "name", "shortName", "color", "claimStatus", "purse", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'UNCLAIMED', $6, now(), now())
         RETURNING id`,
      [roomId, team.teamId, team.name, team.shortName, team.color, team.purse]
      )
      teamIds[team.teamId] = teamResult.rows[0].id
    }

    // 3. Create Players
    for (const team of payload.teams) {
      const dbTeamId = teamIds[team.teamId]
      for (const player of team.players) {
        await client.query(
          `INSERT INTO player ("roomId", "teamId", "playerId", "name", "role", "isOverseas", "price", "auctionData", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
        [roomId, teamIds[team.teamId], player.playerId, player.name, player.role, player.isOverseas, player.price, JSON.stringify(player.auctionData)]
        )
      }
    }

    // 4. Create Lineups and Slots
    const positionMap = [
      'OPENER_1', 'OPENER_2', 'THREE', 'FOUR', 'FIVE', 'SIX',
      'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'
    ]

    // Create lineups
    const lineupValues = Object.entries(payload.teams).map(([teamId]) => {
      const dbTeamId = teamIds[teamId]
      return `('${roomId}', '${dbTeamId}', false, now(), now())`
    }).join(',')

    await client.query(`
      INSERT INTO lineup ("roomId", "teamId", "isLocked", "createdAt", "updatedAt")
      VALUES ${lineupValues}
    `)

    // Get created lineups
    const lineupsResult = await client.query(
      `SELECT id, "teamId" FROM lineup WHERE "roomId" = $1`,
      [roomId]
    )

    // Insert slots
    const slotValues = lineupsResult.rows.flatMap(lineup =>
      positionMap.map(pos =>
        `('${lineup.id}', '${pos}', false, now(), now())`
      )
    ).join(',')

    await client.query(`
      INSERT INTO lineup_slot ("lineupId", "position", "isLocked", "createdAt", "updatedAt")
      VALUES ${slotValues}
    `)

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      data: {
        roomId,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/room/${payload.auctionRoomId}`,
        alreadyExists: false,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    
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
  } finally {
    client.release()
  }
}