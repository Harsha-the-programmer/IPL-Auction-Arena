"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Trophy, Users, Zap, Shield, Code } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [roomCode, setRoomCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length === 6) {
      window.location.href = `/room/${roomCode.trim().toUpperCase()}`;
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32 px-4">
        <div className="max-w-6xl mx-auto text-center">
          {/* Animated background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse-slow" />
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse-slow"
              style={{ animationDelay: "1s" }}
            />
          </div>

          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              Live Multiplayer • No Auth Required
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white">
              IPL Auction{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                Arena
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              Turn your auction squads into playing XI battles. Import teams,
              build lineups, and compete in AI-ranked faceoffs.
            </p>

            {/* Room Code Entry */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="text"
                value={roomCode}
                onChange={(e) =>
                  setRoomCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="Enter Room Code (e.g., 9TM8LF)"
                className="flex-1 input text-center text-lg tracking-widest font-mono"
                maxLength={6}
                autoFocus
              />
              <button
                type="submit"
                disabled={roomCode.length !== 6}
                className="btn-primary whitespace-nowrap"
              >
                Join Arena <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-sm text-neutral-500">
              Don't have a room code?{" "}
              <Link
                href="/install"
                className="text-amber-400 hover:underline font-medium"
              >
                Install the userscript & create one
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "1. Play Auction",
                desc: "Play IPL Auction on playauctiongame.com with friends. Build your squads.",
              },
              {
                icon: Code,
                title: "2. Host Installs Script",
                desc: 'Only the host installs the Tampermonkey userscript. Click "Export to Arena" when auction ends.',
              },
              {
                icon: Trophy,
                title: "3. Battle Your XI",
                desc: "Friends join via room code. Pick playing XI, lock positions. AI ranks each round. Winner takes all!",
              },
            ].map((step, i) => (
              <div key={i} className="card p-6 text-center group">
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <step.icon className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-neutral-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 px-4 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Why Arena?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: "Real-time Multiplayer",
                desc: "Socket.io powered. Everyone sees reveals simultaneously.",
              },
              {
                icon: Shield,
                title: "Host Approval",
                desc: "Host approves team claims. No wrong team selections.",
              },
              {
                icon: Trophy,
                title: "Progressive Locking",
                desc: "Lock position 1, then 2... AI ranks, points auto-calculated.",
              },
              {
                icon: Code,
                title: "Free & Open",
                desc: "Tampermonkey userscript. No Chrome Store fee. Works everywhere.",
              },
            ].map((feature, i) => (
              <div key={i} className="card p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-neutral-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-neutral-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Battle?</h2>
          <p className="text-neutral-400 mb-8">
            Host installs userscript → Plays auction on playauctiongame.com →
            Clicks "Export to Arena" → Shares room code with friends
          </p>
          <Link
            href="/install"
            className="btn-primary text-lg px-8 py-3 inline-flex items-center gap-2"
          >
            Get the Userscript <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-neutral-500 text-sm">
            Not affiliated with playauctiongame.com or IPL. Fan project for
            friends.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-amber-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <span className="text-neutral-500 text-sm">
              Built by Harsha Kamishetty
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
