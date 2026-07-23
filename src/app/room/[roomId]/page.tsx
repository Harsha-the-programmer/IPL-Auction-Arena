"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Crown,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Share2,
  Lock,
  Unlock,
  ChevronLeft,
  Plus,
  Minus,
  GripVertical,
  Timer,
  Bot,
  Trophy,
  Zap,
  Github,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IPL_TEAMS, getTeamInfo, formatPrice } from "@/lib/utils";
import type {
  RoomState,
  TeamState,
  ParticipantState,
  LineupSlotState,
} from "@/lib/types";
import { useSocket } from "@/lib/socket-context";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.roomId;

  const {
    socket,
    room,
    mySocketId,
    displayName,
    setDisplayName,
    isHost,
    error,
    joinRoom,
    isLoading,
    leaveRoom,
  } = useSocket();

  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasSubmittedName, setHasSubmittedName] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Generate or retrieve persistent client ID for this browser
  const [clientId] = useState(() => {
    if (typeof window !== "undefined") {
      let clientId = localStorage.getItem("ipl-auction-client-id");
      if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem("ipl-auction-client-id", clientId);
      }
      return clientId;
    }
    return "";
  });

  // Handle name submission
  const handleNameSubmit = () => {
    if (displayName.trim().length >= 2) {
      // Join the room with the entered name and clientId
      joinRoom(roomId, displayName, clientId);
      setHasSubmittedName(true);
      if (pendingTeamId) {
        socket?.emit("team:request", { teamId: pendingTeamId });
        setPendingTeamId(null);
      }
    }
  };

  // Copy room link
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share via WhatsApp
  const shareWhatsApp = () => {
    const text = `🏏 Join my IPL Auction Arena!\nRoom: ${roomId}\n\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Request team
  const requestTeam = (teamId: string) => {
    if (!hasSubmittedName) {
      // The name form will be shown instead of this logic now
      return;
    }
    setPendingTeamId(teamId);
  };

  // Show name entry form if user hasn't submitted name yet
  if (!hasSubmittedName) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col">
        <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="btn-ghost p-2">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 text-center">
              <h1 className="font-bold text-lg">Room:{" "}
                <span className="font-mono text-amber-400 tracking-widest">
                  {roomId}
                </span></h1>
              <p className="text-xs text-neutral-500">
                {room?.participants.length || 0} / 10 players
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyLink}
                className="btn-secondary px-3 py-1.5 text-sm gap-1.5"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={shareWhatsApp}
                className="btn-secondary px-3 py-1.5 text-sm gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full animate-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold">Enter Your Name</h2>
              <p className="text-neutral-400 mt-1">This is how other players will see you</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              autoComplete="off"
            >
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoFocus
                maxLength={20}
                autoComplete="off"
                className="input mb-4 text-center text-lg"
              />
              <button
                type="button"
                onClick={handleNameSubmit}
                disabled={!displayName.trim() || displayName.trim().length < 2}
                className="btn-primary w-full py-3"
              >
                Continue
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const myTeam = room?.teams.find((t) => t.ownerSocketId === mySocketId);
  const pendingTeams = room?.teams.filter((t) => t.claimStatus === "PENDING") || [];
  const approvedTeams = room?.teams.filter((t) => t.claimStatus === "APPROVED") || [];
  const allLocked =
    approvedTeams.length > 0 && approvedTeams.every((t) => t.isLocked);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="btn-ghost p-2">
            <ChevronLeft className="w-5 h-5" />
          </Link>

          <div className="flex-1 text-center">
            <h1 className="font-bold text-lg">Room: <span className="font-mono text-amber-400 tracking-widest">{roomId}</span></h1>
            <p className="text-xs text-neutral-500">{room?.participants.length || 0} / 10 players</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={copyLink} className="btn-secondary px-3 py-1.5 text-sm gap-1.5">
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button onClick={shareWhatsApp} className="btn-secondary px-3 py-1.5 text-sm gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </header>

      {/* Error Toast */}
      {(error || localError) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 bg-red-500/90 border border-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
          <AlertCircle className="w-5 h-5 inline-block mr-2" />
          {error || localError}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Pending Requests (Host Only) */}
        {isHost && pendingTeams.length > 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Pending Team Requests
            </h3>
            <div className="flex flex-wrap gap-3">
              {pendingTeams.map((team) => (
                <div key={team.teamId} className="flex items-center gap-3 px-4 py-2 bg-neutral-800/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: team.color }}>
                    {team.shortName}
                  </div>
                  <span className="font-medium">{team.requestedByName} wants {team.name}</span>
                  <button onClick={() => socket?.emit("team:approve", { teamId: team.teamId, socketId: team.requestedBySocketId! })} className="btn-primary text-xs px-3 py-1">
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                  <button onClick={() => socket?.emit("team:reject", { teamId: team.teamId, socketId: team.requestedBySocketId! })} className="btn-danger text-xs px-3 py-1">
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Choose Your Team
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {IPL_TEAMS.map((teamConfig) => {
              const team = room?.teams.find((t) => t.teamId === teamConfig.id);
              if (!team) return null;

              const isMe = team.ownerSocketId === mySocketId;
              const isClaimed = team.claimStatus === "APPROVED";
              const isPending = team.claimStatus === "PENDING";
              const canRequest = team.claimStatus === "UNCLAIMED";

              return (
                <div
                  key={teamConfig.id}
                  className={cn(
                    "relative p-4 rounded-xl transition-all",
                    "team-ring",
                    isMe ? "ring-2 ring-amber-400 bg-amber-500/10" :
                    isClaimed ? "ring-2 ring-green-500/50 bg-green-500/10" :
                    isPending ? "ring-2 ring-amber-500/50 bg-amber-500/10" :
                    "bg-neutral-900/50 hover:bg-neutral-800/50"
                  )}
                  style={{ borderColor: isMe ? "#f59e0b" : isClaimed ? "#22c55e" : isPending ? "#f59e0b" : "#374151" }}
                >
                  {/* Team Badge */}
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: team.color }}>
                    {team.shortName}
                  </div>

                  <h3 className="text-center font-semibold mb-1">{team.name}</h3>
                  <p className="text-center text-xs text-neutral-500 mb-3">{team.ownerName || "Unclaimed"}</p>

                  {/* Status */}
                  <div className="flex flex-col gap-2">
                    {isMe && (
                      <Link href={`/room/${roomId}/lineup`} className="btn-primary text-sm">
                        {team.isLocked ? (
                          <>
                            <Lock className="w-3 h-3" /> Lineup Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" /> Select Lineup
                          </>
                        )}
                      </Link>
                    )}
                    {isClaimed && !isMe && (
                      <div className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg text-center">
                        🔒 {team.ownerName}
                      </div>
                    )}

                    {isPending && (
                      <div className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg text-center flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Pending Approval
                      </div>
                    )}

                    {canRequest && (
                      <button
                        onClick={() => requestTeam(team.teamId)}
                        disabled={!displayName}
                        className="btn-secondary text-sm w-full"
                      >
                        Request Team
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Players List */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Players in Room
          </h2>
          <div className="grid gap-2">
            {room?.participants.map((p) => (
              <div key={p.socketId} className="flex items-center gap-3 p-3 bg-neutral-900/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-white font-bold text-sm">
                  {p.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    {p.displayName}
                    {p.isHost && <span className="badge-warning text-xs">Host</span>}
                    {p.socketId === mySocketId && <span className="badge text-xs bg-amber-500/20 text-amber-400">You</span>}
                  </p>
                  {p.teamId && (
                    <p className="text-xs text-neutral-500">
                      Team: <span className="font-medium text-white">{p.teamId}</span>
                    </p>
                  )}
                </div>
                <div className={cn("w-2 h-2 rounded-full", p.isOnline ? "bg-green-500" : "bg-neutral-600")} />
              </div>
            ))}
          </div>
        </div>

        {/* Start Match Button (Host) */}
        {isHost && approvedTeams.length > 0 && (
          <div className="border-t border-neutral-800 pt-6">
            <button
              onClick={() => socket?.emit("match:start")}
              disabled={!allLocked}
              className={cn("btn-primary w-full text-lg py-4", !allLocked && "opacity-50 cursor-not-allowed")}
            >
              {allLocked ? "🚀 Start Match" : `Waiting for ${approvedTeams.filter(t => !t.isLocked).length} team(s) to lock lineup`}
            </button>
            {!allLocked && (
              <p className="text-center text-sm text-neutral-500 mt-2">
                All teams must lock their lineups before starting
              </p>
            )}
          </div>
        )}

        {/* My Team Info */}
        {myTeam && !isHost && (
          <div className="border-t border-neutral-800 pt-6">
            <Link href={`/room/${roomId}/lineup`} className="btn-primary w-full text-lg py-4">
              {myTeam.isLocked ? "🔒 Lineup Locked" : "✏️ Edit My Lineup"}
            </Link>
          </div>
        )}
      </main>

      {/* Error Toast */}
      {(error || localError) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 bg-red-500/90 border border-red-500 text-white px-4 py-3 rounded-lg shadow-xl max-w-md shadow-xl">
          <AlertCircle className="w-5 h-5 inline-block mr-2" />
          {error || localError}
        </div>
      )}

      {/* Name Modal */}
      {false && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full animate-in zoom-in-95">
            <div className="text-center mb-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-400 mb-2">Ready to Play!</h3>
              <p className="text-neutral-400">The userscript is installed. Now go play your auction!</p>
            </div>

            <Link href="/" className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
              <Zap className="w-6 h-6" />
              <span>Go to Home & Enter Room Code</span>
            </Link>

            <div className="pt-6 border-t border-neutral-800">
              <h4 className="font-semibold mb-3">How it works:</h4>
              <ol className="list-decimal list-inside space-y-2 text-neutral-400 text-sm">
                <li>Play IPL Auction on <a href="https://playauctiongame.com" target="_blank" rel="noopener" className="text-amber-400 hover:underline">playauctiongame.com</a></li>
                <li>When auction ends, click <span className="font-medium text-white">"Export to Arena"</span> button in header</li>
                <li>Share the room link ({window.location.href}) with friends</li>
                <li>Friends just click the link - <span className="font-medium text-green-400">no install needed!</span></li>
                <li>Pick teams, build XI, battle with AI rankings!</li>
              </ol>
            </div>

            <div className="pt-6 border-t border-neutral-800">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-500 hover:text-amber-400 transition-colors"
              >
                <Github className="w-5 h-5" />
                <span>View Source on GitHub</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}