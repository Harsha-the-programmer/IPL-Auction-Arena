"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
  updateLineup: (lineupSlots: { position: number; playerId: string | null }[]) => void;
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
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // Load persisted displayName on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("ipl-auction-display-name");
      if (savedName) {
        setDisplayName(savedName);
      }
    }
  }, []);

  // Persist displayName when it changes
  useEffect(() => {
    if (displayName && typeof window !== "undefined") {
      localStorage.setItem("ipl-auction-display-name", displayName);
    }
  }, [displayName]);

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
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("[SocketContext] ✅ CONNECTED:", newSocket.id, "roomId:", currentRoomId);
      const savedName = displayName || (typeof window !== "undefined" ? localStorage.getItem("ipl-auction-display-name") : null);
      const clientId = typeof window !== "undefined" ? localStorage.getItem("ipl-auction-client-id") : null;
      if (currentRoomId && savedName) {
        console.log("[SocketContext] 📤 Auto-joining room:", currentRoomId, "displayName:", savedName);
        newSocket.emit("room:join", { roomId: currentRoomId, displayName: savedName, clientId });
      } else if (currentRoomId && !savedName) {
        console.log("[SocketContext] ⏳ Connected but no displayName yet");
      }
    });

    // Catch-all to debug what events are received
    newSocket.onAny((eventName, ...args) => {
      if (!eventName.startsWith("room:") && !eventName.startsWith("user:") && !eventName.startsWith("team:")) {
        console.log("[SocketContext] 📥 ANY event:", eventName, args);
      }
    });

    newSocket.on("connect_error", (err) => {
      console.error("[SocketContext] ❌ Connection error:", err.message);
      setError("Connection failed: " + err.message);
      setIsLoading(false);
    });

    newSocket.on("room:state", (state: RoomState) => {
      console.log(
        "[SocketContext] 📥 room:state received for room:",
        state.auctionRoomId,
        "teams:",
        state.teams.map(t => ({ teamId: t.teamId, claimStatus: t.claimStatus, requestedByUserId: t.requestedByUserId }))
      );
      setRoom(state);
      setMySocketId(newSocket.id ?? "");
      setIsLoading(false);
      setIsHost(state.hostSocketId === newSocket.id);
      const team = state.teams.find((t) => t.ownerSocketId === newSocket.id);
      if (team) setMyTeam(team);
    });

    newSocket.on("team:requested", (data: { teamId: string; userId: string; displayName: string }) => {
      console.log("[SocketContext] 📥 team:requested received:", data);
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
    });

    newSocket.on("team:rejected", (data: { teamId: string; userId: string }) => {
      console.log("[SocketContext] 📥 team:rejected received:", data);
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
    });

    newSocket.on("team:claimed", (data: { teamId: string; userId: string; displayName: string }) => {
      console.log("[SocketContext] 📥 team:claimed received:", data);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              teams: prev.teams.map((t) =>
                t.teamId === data.teamId
                  ? {
                      ...t,
                      claimStatus: "APPROVED",
                      ownerSocketId: data.userId,
                      ownerName: data.displayName,
                    }
                  : t,
              ),
              participants: prev.participants.map((p) =>
                p.socketId === data.userId ? { ...p, teamId: data.teamId } : p,
              ),
            }
          : null,
      );
    });

    newSocket.on("user:left", (socketId: string) => {
      console.log("[SocketContext] 📥 user:left received:", socketId);
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
      (data: { teamId: string; userId: string; displayName: string }) => {
        console.log("[SocketContext] team:claimed received:", data);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.teamId === data.teamId
                    ? {
                        ...t,
                        claimStatus: "APPROVED",
                        ownerSocketId: data.userId,
                        ownerName: data.displayName,
                      }
                    : t,
                ),
                participants: prev.participants.map((p) =>
                  p.socketId === data.userId ? { ...p, teamId: data.teamId } : p,
                ),
              }
            : null,
        );
      },
    );

    newSocket.on(
      "team:requested",
      (data: { teamId: string; userId: string; displayName: string }) => {
        console.log("[SocketContext] team:requested received:", data);
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
        console.log("[SocketContext] team:rejected received:", data);
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
          localStorage.removeItem("ipl-auction-client-id");
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
      console.log("[SocketContext] kickPlayer called for:", targetSocketId, "socket:", socket?.id, "connected:", socket?.connected);
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
      setDisplayName(displayName ?? "");
      setCurrentRoomId(roomId);
      // Emit room:join - socket.io client queues if not connected yet
      socket?.emit("room:join", { roomId, displayName, clientId });
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
