import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const RankPlayersSchema = z.object({
  position: z.number().int().min(1).max(11),
  players: z.array(z.object({
    playerId: z.string(),
    teamId: z.string(),
    name: z.string(),
    role: z.string(),
    team: z.string(),
    price: z.number(),
    isOverseas: z.boolean(),
  })).min(2).max(10),
})

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'
const GROK_MODEL = 'llama-3.1-8b-instant'

function buildPrompt(position: number, players: any[]) {
  const positionNames = ['', 'OPENER', 'OPENER', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11']
  const posName = positionNames[position] || `Position ${position}`

  return `You are a cricket analyst ranking players for T20 batting position ${posName}.

Rank these ${players.length} players from BEST (1) to WORST (${players.length}) for this specific batting position in a T20 match.

Players:
${players.map((p, i) => 
  `${i + 1}. ${p.name} (${p.role}, ${p.team}, ₹${(p.price/100).toFixed(2)}Cr, ${p.isOverseas ? 'Overseas' : 'Local'})`
).join('\n')}

Consider:
- Role suitability for ${posName} in T20
- Batting style and strike rate potential
- Experience at this position
- Overseas vs local player balance
- Price/value ratio

Return ONLY valid JSON array sorted by rank (best first):
[
  {"playerId": "uuid", "teamId": "MI", "rank": 1, "reasoning": "Brief reason why this player is best for ${posName}"},
  {"playerId": "uuid", "teamId": "CSK", "rank": 2, "reasoning": "Reason..."}
]`
}

async function callGrok(prompt: string): Promise<any[]> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) {
    throw new Error('GROK_API_KEY not configured')
  }

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [
        { role: 'system', content: 'You are a cricket expert. Return only valid JSON arrays. No markdown, no extra text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Grok API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  try {
    // Grok might return JSON wrapped in an object or directly as array
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : parsed.ranking || parsed.players || []
  } catch (e) {
    console.error('Failed to parse Grok response:', content)
    throw new Error('Invalid AI response format')
  }
}

function fallbackRanking(players: any[]) {
  // Deterministic fallback: sort by price descending, then by role priority
  const rolePriority = { BATTER: 4, WICKET_KEEPER: 3, ALL_ROUNDER: 2, BOWLER: 1 }
  return players
    .sort((a, b) => {
      const roleDiff = (rolePriority[b.role as keyof typeof rolePriority] || 0) - (rolePriority[a.role as keyof typeof rolePriority] || 0)
      if (roleDiff !== 0) return roleDiff
      return b.price - a.price
    })
    .map((p, i) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      rank: i + 1,
      reasoning: `Fallback ranking: ${p.role} at ₹${(p.price/100).toFixed(2)}Cr`
    }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { position, players } = RankPlayersSchema.parse(body)

    const prompt = buildPrompt(position, players)

    let ranking: any[]
    try {
      ranking = await callGrok(prompt)
    } catch (aiError) {
      console.warn('AI ranking failed, using fallback:', aiError)
      ranking = fallbackRanking(players)
    }

    // Validate ranking has all players
    const rankedIds = new Set(ranking.map(r => r.playerId))
    const missing = players.filter(p => !rankedIds.has(p.playerId))
    if (missing.length > 0) {
      console.warn('AI missed some players, appending fallback:', missing)
      const fallback = fallbackRanking(missing)
      ranking.push(...fallback.map((f, i) => ({ ...f, rank: ranking.length + i + 1 })))
    }

    // Ensure ranks are sequential 1..N
    ranking.sort((a, b) => a.rank - b.rank)
    ranking.forEach((r, i) => { r.rank = i + 1 })

    return NextResponse.json({ success: true, data: ranking })
  } catch (error) {
    console.error('Rank players error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to rank players' },
    }, { status: 500 })
  }
}