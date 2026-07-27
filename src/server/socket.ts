import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  RoomState,
  TeamState,
  ParticipantState,
  LineupSlotState,
  PickState,
  AIRanking,
  ScoreState,
  TeamScore,
  RoundState,
} from "@/lib/types";

const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>({
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Convert position number (1-11) to LineupPosition enum
function positionToEnum(
  position: number,
):
  | "OPENER_1"
  | "OPENER_2"
  | "THREE"
  | "FOUR"
  | "FIVE"
  | "SIX"
  | "SEVEN"
  | "EIGHT"
  | "NINE"
  | "TEN"
  | "ELEVEN" {
  const positions = [
    "OPENER_1",
    "OPENER_2",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
  ] as const;
  return positions[position - 1] || "OPENER_1";
}

// Convert LineupPosition enum back to number
function enumToPositionNumber(enumValue: string | null): number {
  if (!enumValue) return 1;
  const positions = [
    "OPENER_1",
    "OPENER_2",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
  ] as const;
  return positions.indexOf(enumValue as any) + 1 || 1;
}

// Convert LineupPosition enum to number (1-11)
function enumToPosition(
  enumValue:
    | "OPENER_1"
    | "OPENER_2"
    | "THREE"
    | "FOUR"
    | "FIVE"
    | "SIX"
    | "SEVEN"
    | "EIGHT"
    | "NINE"
    | "TEN"
    | "ELEVEN"
    | null,
): number {
  if (!enumValue) return 1;
  const positions = [
    "OPENER_1",
    "OPENER_2",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
  ] as const;
  return positions.indexOf(enumValue) + 1;
}

// In-memory room state cache (synced with DB)
const roomCache = new Map<string, RoomState>();

function getRoomCache(roomId: string): RoomState | null {
  // Try direct lookup first, then try with auctionRoomId prefix if it looks like an auctionRoomId
  return roomCache.get(roomId) ?? roomCache.get(`auction:${roomId}`) ?? null;
}

function setRoomCache(roomId: string, state: RoomState) {
  // Store by both UUID and auctionRoomId for flexible lookup
  roomCache.set(roomId, state);
  if (state.auctionRoomId) {
    roomCache.set(`auction:${state.auctionRoomId}`, state);
  }
}

async function loadRoomFromDB(roomId: string): Promise<RoomState | null> {
  // First try to find by UUID id
  let room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      teams: {
        include: {
          players: true,
          lineup: {
            include: { slots: { include: { player: true } } },
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
        orderBy: { roundNumber: "asc" },
      },
    },
  });

  // If not found by UUID, try by auctionRoomId
  if (!room) {
    room = await prisma.room.findUnique({
      where: { auctionRoomId: roomId },
      include: {
        teams: {
          include: {
            players: true,
            lineup: {
              include: { slots: { include: { player: true } } },
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
          orderBy: { roundNumber: "asc" },
        },
      },
    });
  }

  if (!room) return null;

  return mapRoomToState(room);
}

function mapRoomToState(room: any): RoomState {
  return {
    id: room.id,
    auctionRoomId: room.auctionRoomId,
    status: room.status,
    currentRound: room.currentRound,
    currentPosition: room.currentPosition,
    hostSocketId: room.hostSocketId,
    teams: room.teams.map(mapTeamToState),
    participants: room.participants.map(mapParticipantToState),
    rounds: room.rounds?.map(mapRoundToState) || [],
    createdAt: room.createdAt.toISOString(),
    completedAt: room.completedAt?.toISOString() || null,
  };
}

function mapTeamToState(team: any): TeamState {
  return {
    id: team.id,
    teamId: team.teamId,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    claimStatus: team.claimStatus,
    ownerSocketId: team.ownerSocketId,
    ownerName: team.ownerName,
    requestedBySocketId: team.requestedBySocketId,
    requestedByUserId: team.requestedByUserId,
    requestedByName: team.requestedByName,
    purse: team.purse,
    players: team.players.map(mapPlayerToState),
    lineup: team.lineup
      ? team.lineup.slots
          .sort((a: any, b: any) => a.position - b.position)
          .map(mapLineupSlotToState)
      : null,
    isLocked: team.lineup?.isLocked || false,
  };
}

function mapPlayerToState(player: any) {
  return {
    id: player.id,
    playerId: player.playerId,
    name: player.name,
    role: player.role,
    isOverseas: player.isOverseas,
    price: player.price,
    auctionData: player.auctionData,
  };
}

function mapLineupSlotToState(slot: any): LineupSlotState {
  return {
    id: slot.id,
    position: slot.position,
    playerId: slot.playerId,
    player: slot.player ? mapPlayerToState(slot.player) : null,
    isLocked: slot.isLocked,
    lockedAtRound: slot.lockedAtRound,
  };
}

function mapParticipantToState(p: any): ParticipantState {
  return {
    id: p.id,
    socketId: p.socketId,
    displayName: p.displayName,
    teamId: p.teamId,
    isHost: p.isHost,
    isOnline: p.isOnline,
    joinedAt:
      typeof p.joinedAt === "string"
        ? p.joinedAt
        : p.joinedAt?.toISOString() || new Date().toISOString(),
    lastSeenAt:
      typeof p.lastSeenAt === "string"
        ? p.lastSeenAt
        : p.lastSeenAt?.toISOString() || new Date().toISOString(),
    clientId: p.clientId ?? null,
  };
}

function mapRoundToState(round: any): RoundState {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    position: round.position,
    phase: round.phase,
    aiResponse: round.aiResponse,
    startedAt: round.startedAt?.toISOString() || null,
    completedAt: round.completedAt?.toISOString() || null,
    picks: round.picks?.map(mapPickToState) || [],
    scores: round.scores?.map(mapScoreToState) || [],
  };
}

function mapPickToState(pick: any): PickState {
  return {
    teamId: pick.teamId,
    teamShortName: pick.team?.shortName || "",
    teamColor: pick.team?.color || "",
    playerId: pick.playerId,
    playerName: pick.player?.name || "",
    role: pick.player?.role || "",
    price: pick.player?.price || 0,
    position: pick.position,
  };
}

function mapScoreToState(score: any): ScoreState {
  return {
    id: score.id,
    roundId: score.roundId,
    teamId: score.teamId,
    points: score.points,
    rank: score.rank,
    total: score.total,
  };
}

async function broadcastRoomState(roomId: string) {
  const room = getRoomCache(roomId);
  if (room) {
    io.to(`room:${roomId}`).emit("room:state", room);
  }
}

async function updatePendingTeams(roomId: string) {
  const room = getRoomCache(roomId);
  if (!room) return;

  const approvedTeams = room.teams.filter((t) => t.claimStatus === "APPROVED");
  const waitingFor = approvedTeams
    .filter((t) => !t.isLocked)
    .map((t) => t.shortName);

  io.to(`room:${roomId}`).emit("pending:update", { waitingFor });
}

async function checkAllLineupsLocked(roomId: string): Promise<boolean> {
  const room = getRoomCache(roomId);
  if (!room) return false;

  const approvedTeams = room.teams.filter((t) => t.claimStatus === "APPROVED");
  if (approvedTeams.length === 0) return false;

  return approvedTeams.every((t) => t.isLocked);
}

// Socket connection handler
io.on(
  "connection",
  (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  ) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("room:join", async ({ roomId, displayName, clientId }) => {
      try {
        // Load room from DB if not cached
        let room: RoomState | null = getRoomCache(roomId);
        if (!room) {
          room = await loadRoomFromDB(roomId);
          if (!room) {
            socket.emit("error", "Room not found");
            return;
          }
          setRoomCache(roomId, room);
        }

        // Use the actual room UUID for database operations
        const actualRoomId = room.id;

        // Check if user already in room by clientId FIRST (most reliable for reconnection)
        // Don't check isOnline here - we want to reconnect even if they were marked offline
        let participant = null;
        if (clientId) {
          participant = room.participants.find(
            (p) => p.clientId === clientId,
          );
        }

        // Check if user already in room by socketId (exact reconnection)
        if (!participant) {
          participant = room.participants.find(
            (p) => p.socketId === socket.id,
          );
        }

        // If not found by socketId, check by displayName (reconnection from new tab/browser)
        if (!participant) {
          participant = room.participants.find(
            (p) => p.displayName === displayName && p.isOnline,
          );
        }

        const isNewParticipant = !participant;

        if (isNewParticipant) {
          // Check if first participant -> host
          const isHost = room.participants.length === 0;

          // Create participant in DB
          const newParticipant = await prisma.participant.create({
            data: {
              roomId: actualRoomId,
              socketId: socket.id,
              displayName,
              isHost,
              isOnline: true,
              clientId: clientId || null,
            },
          });
          participant = {
            ...newParticipant,
            joinedAt: typeof newParticipant.joinedAt === "string" ? newParticipant.joinedAt : newParticipant.joinedAt.toISOString(),
            lastSeenAt: typeof newParticipant.lastSeenAt === "string" ? newParticipant.lastSeenAt : newParticipant.lastSeenAt.toISOString(),
          };

          // If first participant, set as host
          if (isHost) {
            await prisma.room.update({
              where: { id: actualRoomId },
              data: { hostSocketId: socket.id },
            });
            room.hostSocketId = socket.id;
          }

          room.participants.push(mapParticipantToState(participant));
          setRoomCache(roomId, room);
        } else {
          // Reconnection or returning user - update socketId and online status
          if (!participant) {
            socket.emit("error", "Participant not found");
            return;
          }
          // Update clientId if provided and not already set
          const existingParticipant = participant;
          const existingParticipantId = existingParticipant.id;
          await prisma.participant.update({
            where: { id: existingParticipant.id },
            data: {
              socketId: socket.id,
              isOnline: true,
              lastSeenAt: new Date(),
              ...(clientId && !existingParticipant.clientId ? { clientId } : {}),
            },
          });
          existingParticipant.socketId = socket.id;
          existingParticipant.isOnline = true;
          if (clientId && !existingParticipant.clientId) {
            existingParticipant.clientId = clientId;
          }
          // If this participant is the host, update room's hostSocketId
          if (existingParticipant.isHost) {
            await prisma.room.update({
              where: { id: actualRoomId },
              data: { hostSocketId: socket.id },
            });
            room.hostSocketId = socket.id;
          }
          setRoomCache(roomId, room);
          participant = existingParticipant;
        }

        // Join socket room
        socket.join(`room:${actualRoomId}`);
        socket.data.roomId = actualRoomId;
        socket.data.userId = participant!.id;
        socket.data.displayName = displayName;
        socket.data.isHost = participant!.isHost;

        // Send full room state
        socket.emit("room:state", room);

        // Notify others
        if (isNewParticipant) {
          socket
            .to(`room:${actualRoomId}`)
            .emit("user:joined", mapParticipantToState(participant!));
        }

        console.log(
          `[Socket] ${displayName} joined room ${actualRoomId} (host: ${participant!.isHost})`,
        );
      } catch (error) {
        console.error("[Socket] Join error:", error);
        socket.emit("error", "Failed to join room");
      }
    });

    socket.on("team:request", async ({ teamId }) => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      const displayName = socket.data.displayName;
      if (!roomId || !userId) return;

      try {
        const room = getRoomCache(roomId);
        if (!room) return;

        const team = room.teams.find((t) => t.teamId === teamId);
        if (!team || team.claimStatus !== "UNCLAIMED") return;

        // Update team to PENDING - use team.id (UUID) not team.teamId (short name)
        await prisma.team.update({
          where: { id: team.id },
          data: {
            claimStatus: "PENDING",
            requestedBySocketId: socket.id,
            requestedByUserId: userId,
            requestedByName: displayName,
          },
        });

        team.claimStatus = "PENDING";
        team.requestedBySocketId = socket.id;
        team.requestedByUserId = userId;
        team.requestedByName = displayName || null;
        setRoomCache(roomId, room);

        // Notify host
        io.to(`room:${roomId}`).emit("team:requested", {
          teamId,
          userId,
          displayName: displayName || "Unknown",
        });

        // Notify requester
        socket.emit("room:state", room);
      } catch (error) {
        console.error("[Socket] Team request error:", error);
      }
    });

    socket.on("team:approve", async ({ teamId, socketId: targetSocketId }) => {
      const roomId = socket.data.roomId;
      const isHost = socket.data.isHost;
      if (!roomId || !isHost) return;

      try {
        const room = getRoomCache(roomId);
        if (!room) return;

        const team = room.teams.find((t) => t.teamId === teamId);
        if (!team || team.claimStatus !== "PENDING") return;
        if (team.requestedBySocketId !== targetSocketId) return;

        const participantId = team.requestedByUserId;

        // Update in DB - use team.id (UUID) not team.teamId
        await prisma.team.update({
          where: { id: team.id },
          data: {
            claimStatus: "APPROVED",
            ownerSocketId: targetSocketId,
            ownerName: team.requestedByName,
            requestedBySocketId: null,
            requestedByUserId: null,
            requestedByName: null,
          },
        });

        // Update participant's team using participant ID
        if (participantId) {
          await prisma.participant.update({
            where: { id: participantId },
            data: { teamId: team.id },
          });
        }

        team.claimStatus = "APPROVED";
        team.ownerSocketId = targetSocketId;
        team.ownerName = team.requestedByName;
        team.requestedBySocketId = null;
        team.requestedByUserId = null;
        team.requestedByName = null;

        // Create empty lineup for team
        if (!team.lineup) {
          const lineup = await prisma.lineup.create({
            data: {
              roomId,
              teamId: team.id,
              slots: {
                create: Array.from({ length: 11 }, (_, i) => ({
                  position: positionToEnum(i + 1),
                  playerId: null,
                })),
              },
            },
            include: { slots: true },
          });
          team.lineup = lineup.slots.map(mapLineupSlotToState);
        }

        setRoomCache(roomId, room);

        // Notify all
        io.to(`room:${roomId}`).emit("team:claimed", {
          teamId,
          userId: targetSocketId,
          displayName: team.ownerName || "Unknown",
        });

        // Notify the approved user
        io.to(targetSocketId).emit("room:state", room);

        await updatePendingTeams(roomId);
      } catch (error) {
        console.error("[Socket] Team approve error:", error);
      }
    });

    socket.on("team:reject", async ({ teamId, socketId: targetSocketId }) => {
      const roomId = socket.data.roomId;
      const isHost = socket.data.isHost;
      if (!roomId || !isHost) return;

      try {
        const room = getRoomCache(roomId);
        if (!room) return;

        const team = room.teams.find((t) => t.teamId === teamId);
        if (!team || team.claimStatus !== "PENDING") return;
        if (team.requestedBySocketId !== targetSocketId) return;

        const participantId = team.requestedByUserId;

        await prisma.team.update({
          where: { id: team.id },
          data: {
            claimStatus: "UNCLAIMED",
            requestedBySocketId: null,
            requestedByUserId: null,
            requestedByName: null,
          },
        });

        team.claimStatus = "UNCLAIMED";
        team.requestedBySocketId = null;
        team.requestedByUserId = null;
        team.requestedByName = null;
        setRoomCache(roomId, room);

        io.to(`room:${roomId}`).emit("team:rejected", {
          teamId,
          userId: targetSocketId,
        });
        io.to(targetSocketId).emit("room:state", room);
      } catch (error) {
        console.error("[Socket] Team reject error:", error);
      }
    });

    socket.on("lineup:update", async ({ lineupSlots }) => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      const teamId = socket.data.teamId;
      if (!roomId || !userId || !teamId) return;

      try {
        const room = getRoomCache(roomId);
        if (!room) return;

        const team = room.teams.find((t) => t.id === teamId);
        if (!team) return;

        // Update in DB
        await prisma.$transaction(
          lineupSlots.map((slot) =>
            prisma.lineupSlot.upsert({
              where: {
                lineupId_position: {
                  lineupId: team.lineup![0].id,
                  position: positionToEnum(slot.position),
                },
              },
              update: { playerId: slot.playerId, isLocked: false },
              create: {
                lineupId: team.lineup![0].id,
                position: positionToEnum(slot.position),
                playerId: slot.playerId,
                isLocked: false,
              },
            }),
          ),
        );

        // Update cache
        if (team.lineup) {
          team.lineup = lineupSlots.map((s) => ({
            ...team.lineup!.find((l) => l.position === s.position)!,
            playerId: s.playerId,
            player: s.playerId
              ? team.players.find((p) => p.id === s.playerId) || null
              : null,
            isLocked: false,
          }));
        }
        setRoomCache(roomId, room);

        // Broadcast to room
        io.to(`room:${roomId}`).emit("lineup:synced", {
          teamId: team.teamId,
          lineupSlots: team.lineup ?? [],
          lockedPositions:
            team.lineup?.filter((l) => l.isLocked).map((l) => l.position) ?? [],
        });

        await updatePendingTeams(roomId);
      } catch (error) {
        console.error("[Socket] Lineup update error:", error);
      }
    });

    socket.on("lineup:lock", async ({ position }) => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      const teamId = socket.data.teamId;
      if (!roomId || !userId || !teamId) return;

      try {
        const room = getRoomCache(roomId);
        if (!room) return;

        const team = room.teams.find((t) => t.id === teamId);
        if (!team || !team.lineup) return;

        const slot = team.lineup.find((l) => l.position === position);
        if (!slot || !slot.playerId) return; // Can't lock empty slot

        // Update in DB
        await prisma.lineupSlot.update({
          where: { id: slot.id },
          data: { isLocked: true, lockedAtRound: room.currentRound + 1 },
        });

        slot.isLocked = true;
        slot.lockedAtRound = room.currentRound + 1;
        setRoomCache(roomId, room);

        io.to(`room:${roomId}`).emit("lineup:synced", {
          teamId: team.teamId,
          lineupSlots: team.lineup,
          lockedPositions: team.lineup
            .filter((l) => l.isLocked)
            .map((l) => l.position),
        });

        await updatePendingTeams(roomId);

        // Check if all approved teams have locked this position
        const approvedTeams = room.teams.filter(
          (t) => t.claimStatus === "APPROVED",
        );
        const positionEnum = positionToEnum(position);
        const positionNum = position;
        const allLockedAtPosition = approvedTeams.every(
          (t) => t.lineup?.find((l) => l.position === positionNum)?.isLocked,
        );

        if (
          allLockedAtPosition &&
          room.status === "MATCH" &&
          room.currentPosition === positionEnum
        ) {
          // All teams locked this position - trigger next phase
          await startRoundCountdown(roomId);
        }
      } catch (error) {
        console.error("[Socket] Lineup lock error:", error);
      }
    });

    socket.on("match:start", async () => {
      const roomId = socket.data.roomId;
      const isHost = socket.data.isHost;
      if (!roomId || !isHost) return;

      try {
        const room = getRoomCache(roomId);
        if (!room || room.status !== "LOBBY") return;

        // Verify all approved teams have locked lineups
        const approvedTeams = room.teams.filter(
          (t) => t.claimStatus === "APPROVED",
        );
        const allLocked = approvedTeams.every(
          (t) => t.isLocked && t.lineup?.length === 11,
        );
        if (!allLocked) return;

        // Update room status
        await prisma.room.update({
          where: { id: roomId },
          data: {
            status: "MATCH",
            currentRound: 1,
            currentPosition: positionToEnum(1),
          },
        });

        room.status = "MATCH";
        room.currentRound = 1;
        room.currentPosition = positionToEnum(1);
        setRoomCache(roomId, room);

        // Start Round 1 (Openers - positions 1 & 2)
        await startRoundCountdown(roomId);
      } catch (error) {
        console.error("[Socket] Match start error:", error);
      }
    });

    async function startRoundCountdown(roomId: string) {
      const room = getRoomCache(roomId);
      if (!room) return;

      // Round 1 = positions 1 & 2 (openers), subsequent rounds = single position
      const positionsThisRound =
        room.currentRound === 1
          ? [1, 2]
          : [enumToPositionNumber(room.currentPosition)];

      // Create round in DB
      const round = await prisma.round.create({
        data: {
          roomId,
          roundNumber: room.currentRound,
          position: positionToEnum(enumToPositionNumber(room.currentPosition)),
          phase: "COUNTDOWN",
          startedAt: new Date(),
        },
      });

      room.rounds.push({
        id: round.id,
        roundNumber: round.roundNumber,
        position: round.position,
        phase: "COUNTDOWN",
        aiResponse: null,
        startedAt: round.startedAt?.toISOString() || new Date().toISOString(),
        completedAt: null,
      } as any);

      setRoomCache(roomId, room);

      // Emit countdown
      io.to(`room:${roomId}`).emit("round:start", {
        roundNumber: room.currentRound,
        position: enumToPosition(room.currentPosition),
        countdown: 3,
      });

      // Wait 3 seconds then reveal
      setTimeout(async () => {
        await revealPicks(roomId, positionsThisRound);
      }, 3000);
    }

    async function revealPicks(roomId: string, positions: number[]) {
      const room = getRoomCache(roomId);
      if (!room) return;

      const approvedTeams = room.teams.filter(
        (t) => t.claimStatus === "APPROVED",
      );
      const picks: PickState[] = [];

      for (const team of approvedTeams) {
        if (!team.lineup) continue;
        for (const pos of positions) {
          const slot = team.lineup.find((l) => l.position === pos);
          if (slot?.player) {
            picks.push({
              teamId: team.teamId,
              teamShortName: team.shortName,
              teamColor: team.color,
              playerId: slot.player.id,
              playerName: slot.player.name,
              role: slot.player.role,
              price: slot.player.price,
              position: pos,
            });
          }
        }
      }

      // Update round phase
      await prisma.round.update({
        where: { id: room.rounds[room.currentRound - 1].id },
        data: { phase: "REVEALED" },
      });

      room.rounds[room.currentRound - 1].phase = "REVEALED";
      setRoomCache(roomId, room);

      io.to(`room:${roomId}`).emit("round:reveal", { picks });

      // Get AI ranking
      setTimeout(async () => {
        await getAIRanking(roomId, picks, positions);
      }, 1500);
    }

    async function getAIRanking(
      roomId: string,
      picks: PickState[],
      positions: number[],
    ) {
      // TODO: Call Grok API
      // For now, deterministic fallback by price
      const room = getRoomCache(roomId);
      if (!room) return;

      const ranked = picks
        .sort((a, b) => b.price - a.price)
        .map((pick, index) => ({
          playerId: pick.playerId,
          teamId: pick.teamId,
          rank: index + 1,
          reasoning: `Ranked by price (₹${(pick.price / 100).toFixed(2)} Cr) - deterministic fallback`,
        }));

      // Calculate points
      const activeTeams = picks
        .map((p) => p.teamId)
        .filter((v, i, a) => a.indexOf(v) === i).length;
      const points: ScoreState[] = ranked.map((r, i) => ({
        id: crypto.randomUUID(),
        roundId: room.rounds[room.currentRound - 1].id,
        teamId: r.teamId,
        points: activeTeams - r.rank + 1,
        rank: r.rank,
        total: 0, // Will compute cumulative
      }));

      // Update scores in DB
      await prisma.$transaction(
        points.map((p) =>
          prisma.score.upsert({
            where: { roundId_teamId: { roundId: p.roundId, teamId: p.teamId } },
            update: { points: p.points, rank: p.rank },
            create: {
              roomId,
              roundId: p.roundId,
              teamId: p.teamId,
              points: p.points,
              rank: p.rank,
              total: p.points,
            },
          }),
        ),
      );

      // Update round with AI response
      await prisma.round.update({
        where: { id: room.rounds[room.currentRound - 1].id },
        data: { phase: "RANKED", aiResponse: ranked, completedAt: new Date() },
      });

      room.rounds[room.currentRound - 1].phase = "RANKED";
      room.rounds[room.currentRound - 1].aiResponse = ranked;
      room.rounds[room.currentRound - 1].completedAt = new Date().toISOString();
      setRoomCache(roomId, room);

      // Emit ranking
      io.to(`room:${roomId}`).emit("round:ranking", {
        ranking: ranked,
        points,
      });

      // Auto-advance after delay then complete round
      setTimeout(async () => {
        await completeRound(roomId);
      }, 2000);
    }

    async function completeRound(roomId: string) {
      const room = getRoomCache(roomId);
      if (!room) return;

      const round = room.rounds[room.currentRound - 1];
      round.phase = "COMPLETED";

      // Compute leaderboard
      const teamScores: TeamScore[] = room.teams
        .filter((t) => t.claimStatus === "APPROVED")
        .map((team) => {
          const roundScores = room.rounds
            .filter((r) => r.phase === "COMPLETED")
            .flatMap((r) => r.scores || [])
            .filter((s) => s.teamId === team.teamId);
          const total = roundScores.reduce((sum, s) => sum + s.points, 0);
          const lastRoundScore = roundScores.find(
            (s) => s.roundId === round.id,
          );
          return {
            teamId: team.teamId,
            teamShortName: team.shortName,
            teamColor: team.color,
            ownerName: team.ownerName || "Unknown",
            total,
            lastRoundPoints: lastRoundScore?.points || 0,
            roundScores: roundScores.map((s) => s.points),
          };
        })
        .sort((a, b) => b.total - a.total);

      io.to(`room:${roomId}`).emit("round:complete", {
        leaderboard: teamScores,
      });

      // Check if match complete (10 rounds)
      if (room.currentRound >= 10) {
        await endMatch(roomId, teamScores);
        return;
      }

      // Advance to next round
      room.currentRound++;
      room.currentPosition = positionToEnum(
        room.currentRound === 1 ? 2 : room.currentRound + 1,
      );

      await prisma.room.update({
        where: { id: roomId },
        data: {
          currentRound: room.currentRound,
          currentPosition: room.currentPosition,
        },
      });

      setRoomCache(roomId, room);

      // Auto-start next round after delay
      setTimeout(async () => {
        await startRoundCountdown(roomId);
      }, 2000);
    }

    async function endMatch(roomId: string, finalStandings: TeamScore[]) {
      const room = getRoomCache(roomId);
      if (!room) return;

      await prisma.room.update({
        where: { id: roomId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      room.status = "COMPLETED";
      room.completedAt = new Date().toISOString();
      setRoomCache(roomId, room);

      const winner = finalStandings[0];
      io.to(`room:${roomId}`).emit("match:complete", {
        finalStandings,
        winner,
      });
    }

    // Handle kick player (host only)
    socket.on("kickPlayer", async ({ targetSocketId }) => {
      const roomId = socket.data.roomId;
      const isHost = socket.data.isHost;
      if (!roomId || !isHost) return;

      try {
        const room = getRoomCache(roomId);
        if (!room) return;

        // Find participant by socketId
        const participant = room.participants.find((p) => p.socketId === targetSocketId);
        if (!participant) return;

        // Cannot kick host
        if (participant.isHost) return;

        // Delete participant from DB (so they can't reconnect with same clientId)
        await prisma.participant.delete({
          where: { id: participant.id },
        });

        // Notify the kicked user
        io.to(targetSocketId).emit("error", "You have been kicked from the room by the host");
        io.to(targetSocketId).emit("user:left", targetSocketId);

        // Force disconnect the kicked socket
        io.to(targetSocketId).disconnectSockets(true);

        // Remove from room cache
        room.participants = room.participants.filter((p) => p.id !== participant.id);
        setRoomCache(roomId, room);

        // Notify room
        io.to(`room:${roomId}`).emit("user:left", targetSocketId);

        await updatePendingTeams(roomId);
      } catch (error) {
        console.error("[Socket] Kick player error:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (roomId && userId) {
        // Update participant offline
        await prisma.participant.update({
          where: { id: userId },
          data: { isOnline: false, lastSeenAt: new Date() },
        });

        const room = getRoomCache(roomId);
        if (room) {
          const participant = room.participants.find((p) => p.id === userId);
          if (participant) {
            participant.isOnline = false;
          }

          // If host left, transfer host to next senior participant
          if (room.hostSocketId === socket.id) {
            const onlineParticipants = room.participants
              .filter((p) => p.isOnline && p.id !== userId)
              .sort(
                (a, b) =>
                  new Date(a.joinedAt).getTime() -
                  new Date(b.joinedAt).getTime(),
              );

            if (onlineParticipants.length > 0) {
              const newHost = onlineParticipants[0];
              room.hostSocketId = newHost.socketId;
              newHost.isHost = true;

              await prisma.room.update({
                where: { id: roomId },
                data: { hostSocketId: newHost.socketId },
              });
              await prisma.participant.update({
                where: { id: newHost.id },
                data: { isHost: true },
              });

              // Update socket.data.isHost for the new host's socket
              const newHostSocket = io.sockets.sockets.get(newHost.socketId);
              if (newHostSocket) {
                newHostSocket.data.isHost = true;
              }

              io.to(`room:${roomId}`).emit("host:changed", newHost.socketId);
            }
          }

          setRoomCache(roomId, room);
          socket.to(`room:${roomId}`).emit("user:left", socket.id);
        }
      }
    });
  },
);

export function initSocketServer(httpServer: HTTPServer) {
  io.attach(httpServer);
  return io;
}

export { io };
