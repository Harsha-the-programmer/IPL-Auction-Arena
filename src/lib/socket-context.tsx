"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import type {
  RoomState,
  TeamState,
  ParticipantState,
  LineupSlotState,
  PickState,
  AIRanking,
  ScoreState,
  TeamScore,
} from "@/lib/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CLIENT_ID_STORAGE_KEY = "ipl-auction-client-id";
const DISPLAY_NAME_STORAGE_KEY = "ipl-auction-display-name";

function getRoomDisplayNameKey(roomId: string) {
  return `${DISPLAY_NAME_STORAGE_KEY}:${roomId}`;
}

function getOrCreateClientId() {
  if (typeof window === "undefined") return null;

  let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }

  return clientId;
}

function getSavedDisplayName(roomId?: string | null) {
  if (typeof window === "undefined") return null;

  if (roomId) {
    const roomName = localStorage.getItem(getRoomDisplayNameKey(roomId));
    if (roomName) return roomName;
  }

  return localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
}

function saveDisplayName(displayName: string, roomId?: string | null) {
  if (typeof window === "undefined" || !displayName) return;

  localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);
  if (roomId) {
    localStorage.setItem(getRoomDisplayNameKey(roomId), displayName);
  }
}

interface SocketContextType {
  socket: Socket | null;
  room: RoomState | null;
  myTeam: TeamState | null;
  mySocketId: string;
  isHost: boolean;
  displayName: string;
  setDisplayName: (name: string) => void;
  joinRoom: (roomId: string, displayName: string, clientId?: string) => void;
  leaveRoom: () => void;
  isLoading: boolean;
  error: string | null;
  requestTeam: (teamId: string) => void;
  approveTeam: (teamId: string, userId: string) => void;
  rejectTeam: (teamId: string, userId: string) => void;
  startMatch: () => void;
  updateLineup: (
    lineupSlots: { position: number; playerId: string | null }[],
  ) => void;
  lockPosition: (position: number) => void;
  kickPlayer: (targetSocketId: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({
  children,
  roomId: initialRoomId,
}: {
  children: ReactNode;
  roomId?: string;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myTeam, setMyTeam] = useState<TeamState | null>(null);
  const [mySocketId, setMySocketId] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(
    initialRoomId ?? null,
  );
  const pendingJoinRef = useRef<{
    roomId: string;
    displayName: string;
    clientId?: string;
  } | null>(null);

  // Load persisted displayName on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = getSavedDisplayName(initialRoomId);
      if (savedName) {
        setDisplayName(savedName);
      }
    }
  }, [initialRoomId]);

  // Persist displayName when it changes
  useEffect(() => {
    if (displayName && typeof window !== "undefined") {
      saveDisplayName(displayName);
    }
  }, [displayName]);

  useEffect(() => {
    if (initialRoomId && initialRoomId !== currentRoomId) {
      setCurrentRoomId(initialRoomId);
    }
  }, [initialRoomId, currentRoomId]);

  // Connect socket when currentRoomId changes
  useEffect(() => {
    if (!currentRoomId) {
      console.log("[Socket] Skipping connection - currentRoomId is null");
      return;
    }

    console.log(
      "[Socket] Attempting to connect to:",
      SOCKET_URL,
      "roomId:",
      currentRoomId,
    );
    setIsLoading(true);
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("[Socket] Connected:", newSocket.id);
      const clientId = getOrCreateClientId();
      const pendingJoin = pendingJoinRef.current;

      if (pendingJoin && pendingJoin.roomId === currentRoomId) {
        console.log(
          "[Socket] Joining room from pending user input:",
          currentRoomId,
        );
        newSocket.emit("room:join", pendingJoin);
        pendingJoinRef.current = null;
        return;
      }

      if (currentRoomId && clientId) {
        const savedName = getSavedDisplayName(currentRoomId) ?? "";
        console.log("[Socket] Attempting room resume:", currentRoomId);
        newSocket.emit("room:join", {
          roomId: currentRoomId,
          displayName: savedName,
          clientId,
          resumeOnly: true,
        });
      } else {
        setIsLoading(false);
      }
    });

    newSocket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      setError("Connection failed: " + err.message);
      setIsLoading(false);
    });

    newSocket.on("room:state", (state: RoomState) => {
      console.log(
        "[Socket] Room state received for room:",
        state.auctionRoomId,
      );
      setRoom(state);
      setMySocketId(newSocket.id ?? "");
      setIsLoading(false);
      setIsHost(state.hostSocketId === newSocket.id);

      // Find my team by participant's teamId (stable across refreshes) or ownerSocketId
      const myParticipant = state.participants.find(
        (p) => p.socketId === newSocket.id,
      );
      if (myParticipant) {
        setDisplayName(myParticipant.displayName);
        saveDisplayName(myParticipant.displayName, currentRoomId);
        saveDisplayName(myParticipant.displayName, state.auctionRoomId);
      }
      let team = null;
      if (myParticipant?.teamId) {
        team = state.teams.find((t) => t.id === myParticipant.teamId);
      }
      if (!team) {
        team = state.teams.find((t) => t.ownerSocketId === newSocket.id);
      }
      if (team) setMyTeam(team);
    });

    newSocket.on("room:resume:failed", () => {
      console.log("[Socket] No existing participant found for this browser");
      setRoom(null);
      setMyTeam(null);
      setMySocketId(newSocket.id ?? "");
      setIsHost(false);
      setIsLoading(false);
    });

    newSocket.on("user:joined", (user: ParticipantState) => {
      setRoom((prev) =>
        prev ? { ...prev, participants: [...prev.participants, user] } : null,
      );
    });

    newSocket.on("user:left", (socketId: string) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.filter(
                (p) => p.socketId !== socketId,
              ),
            }
          : null,
      );
    });

    newSocket.on(
      "user:offline",
      (data: { participantId: string; socketId: string }) => {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) =>
                  p.id === data.participantId
                    ? { ...p, isOnline: false, socketId: data.socketId }
                    : p,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on("user:online", (user: ParticipantState) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === user.id ? { ...p, ...user, isOnline: true } : p,
              ),
            }
          : null,
      );
    });

    newSocket.on("host:changed", (newHostSocketId: string) => {
      console.log("[Socket] Host changed to:", newHostSocketId);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              hostSocketId: newHostSocketId,
              participants: prev.participants.map((p) => ({
                ...p,
                isHost: p.socketId === newHostSocketId,
              })),
            }
          : null,
      );
      // Update local isHost state
      setIsHost(newHostSocketId === newSocket.id);
    });

    newSocket.on(
      "team:claimed",
      (data: {
        teamId: string;
        userId: string;
        displayName: string;
        lineup: LineupSlotState[] | null;
      }) => {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.id === data.teamId
                    ? {
                        ...t,
                        claimStatus: "APPROVED",
                        ownerSocketId: data.userId,
                        ownerName: data.displayName,
                        lineup: data.lineup,
                        isLocked: false,
                      }
                    : t,
                ),
                participants: prev.participants.map((p) =>
                  p.id === data.userId ? { ...p, teamId: data.teamId } : p,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on(
      "team:requested",
      (data: { teamId: string; userId: string; displayName: string }) => {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.teamId === data.teamId
                    ? {
                        ...t,
                        claimStatus: "PENDING",
                        requestedByUserId: data.userId,
                        requestedByName: data.displayName,
                      }
                    : t,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on(
      "team:rejected",
      (data: { teamId: string; userId: string }) => {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.teamId === data.teamId
                    ? {
                        ...t,
                        claimStatus: "UNCLAIMED",
                        requestedBySocketId: null,
                        requestedByUserId: null,
                        requestedByName: null,
                      }
                    : t,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on(
      "team:released",
      (data: { teamId: string; teamShortName: string }) => {
        console.log("[Client] team:released received:", data);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.id === data.teamId
                    ? {
                        ...t,
                        claimStatus: "UNCLAIMED",
                        ownerSocketId: null,
                        ownerName: null,
                        requestedBySocketId: null,
                        requestedByUserId: null,
                        requestedByName: null,
                        lineup: null,
                        isLocked: false,
                      }
                    : t,
                ),
                participants: prev.participants.map((p) =>
                  p.teamId === data.teamId ? { ...p, teamId: null } : p,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on(
      "lineup:synced",
      (data: {
        teamId: string;
        lineupSlots: LineupSlotState[];
        lockedPositions: number[];
      }) => {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.teamId === data.teamId
                    ? {
                        ...t,
                        lineup: data.lineupSlots,
                        lockedPositions: data.lockedPositions,
                      }
                    : t,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on("pending:update", (data: { waitingFor: string[] }) => {
      setRoom((prev) =>
        prev ? { ...prev, waitingFor: data.waitingFor } : null,
      );
    });

    newSocket.on("error", (message: string) => {
      setError(message);
      setIsLoading(false);
      // If kicked, clear clientId and redirect to home
      if (message.includes("kicked")) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
          if (currentRoomId) {
            localStorage.removeItem(getRoomDisplayNameKey(currentRoomId));
          }
          window.location.href = "/";
        }
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err);
      setError("Connection failed. Retrying...");
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [currentRoomId]);

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
      setRoom(null);
      setMyTeam(null);
      setCurrentRoomId(null);
      setMySocketId("");
      setIsHost(false);
      setDisplayName("");
      setError(null);
    }
  }, [socket]);

  const requestTeam = useCallback(
    (teamId: string) => {
      socket?.emit("team:request", { teamId });
    },
    [socket],
  );

  const approveTeam = useCallback(
    (teamId: string, participantId: string) => {
      socket?.emit("team:approve", { teamId, participantId });
    },
    [socket],
  );

  const rejectTeam = useCallback(
    (teamId: string, participantId: string) => {
      socket?.emit("team:reject", { teamId, participantId });
    },
    [socket],
  );

  const startMatch = useCallback(() => {
    socket?.emit("match:start", {});
  }, [socket]);

  const updateLineup = useCallback(
    (lineupSlots: { position: number; playerId: string | null }[]) => {
      socket?.emit("lineup:update", { lineupSlots });
    },
    [socket],
  );

  const lockPosition = useCallback(
    (position: number) => {
      socket?.emit("lineup:lock", { position });
    },
    [socket],
  );

  const sendChat = useCallback(
    (message: string, gifId?: string) => {
      socket?.emit("chat:message", { message, gifId });
    },
    [socket],
  );

  const setBidTimer = useCallback(
    (seconds: number) => {
      socket?.emit("setBidTimer", { seconds });
    },
    [socket],
  );

  const kickPlayer = useCallback(
    (targetSocketId: string) => {
      socket?.emit("kickPlayer", { targetSocketId });
    },
    [socket],
  );

  const sendRoundReady = useCallback(() => {
    socket?.emit("round:ready", {});
  }, [socket]);

  const value = {
    socket,
    room,
    myTeam,
    mySocketId,
    isHost,
    displayName,
    setDisplayName,
    joinRoom: (roomId: string, displayName: string, clientId?: string) => {
      const resolvedClientId = clientId || getOrCreateClientId() || undefined;
      const resolvedDisplayName = displayName ?? "";

      setDisplayName(resolvedDisplayName);
      saveDisplayName(resolvedDisplayName, roomId);
      pendingJoinRef.current = {
        roomId,
        displayName: resolvedDisplayName,
        clientId: resolvedClientId,
      };
      setCurrentRoomId(roomId);
      // Emit room:join with clientId for reconnection support
      if (socket?.connected) {
        socket.emit("room:join", pendingJoinRef.current);
        pendingJoinRef.current = null;
      }
      // If not connected yet, the connect handler will emit it
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
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
