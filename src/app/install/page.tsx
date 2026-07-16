"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  Chrome,
  Firefox,
  Edge,
  Safari,
  CheckCircle,
  AlertCircle,
  Github,
  ExternalLink,
  ArrowRight,
  Terminal,
  Code,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function InstallPage() {
  const [step, setStep] = useState(1);
  const [installed, setInstalled] = useState(false);

  const userscriptUrl =
    process.env.NODE_ENV === "production"
      ? "https://raw.githubusercontent.com/Harsha-the-programmer/IPL-Auction-Arena/main/public/userscript/ipl-auction-arena.user.js"
      : "/userscript/ipl-auction-arena.user.js";

  const steps = [
    {
      title: "Install Tampermonkey",
      desc: "Tampermonkey is a free userscript manager. Install it for your browser:",
      browsers: [
        {
          name: "Chrome / Edge / Brave",
          icon: Chrome,
          url: "https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo",
        },
        {
          name: "Firefox",
          icon: Firefox,
          url: "https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/",
        },
        {
          name: "Safari",
          icon: Safari,
          url: "https://apps.apple.com/app/tampermonkey/id1482490089",
        },
      ],
    },
    {
      title: "Install the Userscript",
      desc: "Click the button below to install the IPL Auction Arena Exporter:",
      action: true,
    },
    {
      title: "Play Auction & Export",
      desc: '1. Play auction on playauctiongame.com\n2. When auction ends, click "Export to Arena" in header\n3. Share room link with friends!',
      complete: true,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="btn-ghost p-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="font-bold text-lg">Install Userscript</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            {steps.map((_, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                    i + 1 < step
                      ? "bg-amber-500 text-black"
                      : i + 1 === step
                        ? "bg-amber-500 text-black ring-4 ring-amber-500/30"
                        : "bg-neutral-800 text-neutral-500",
                  )}
                >
                  {i + 1 < step ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-16 h-1 mx-2",
                      i + 1 < step ? "bg-amber-500" : "bg-neutral-800",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Step */}
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="card p-8">
            <h2 className="text-2xl font-bold mb-2">{steps[step - 1].title}</h2>
            <p className="text-neutral-400 mb-6 whitespace-pre-line">
              {steps[step - 1].desc}
            </p>

            {step === 1 && (
              <div className="grid gap-3">
                {steps[0].browsers.map((browser, i) => (
                  <a
                    key={i}
                    href={browser.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl hover:border-amber-500/50 transition-colors group"
                  >
                    <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                      <browser.icon className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium">{browser.name}</p>
                      <p className="text-sm text-neutral-500">
                        Click to install Tampermonkey
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-neutral-500 ml-auto group-hover:text-amber-400" />
                  </a>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    window.open(userscriptUrl, "_blank");
                    setInstalled(true);
                    setTimeout(() => setStep(3), 1000);
                  }}
                  className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3"
                >
                  <Download className="w-6 h-6" />
                  <span>Install IPL Auction Arena Userscript</span>
                </button>

                <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-sm text-neutral-400">
                  <p className="font-medium text-white mb-2">
                    What happens next:
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Tampermonkey will open a confirmation dialog</li>
                    <li>
                      Click{" "}
                      <span className="font-medium text-amber-400">
                        Install
                      </span>
                    </li>
                    <li>You'll see "IPL Auction Arena Exporter installed!"</li>
                  </ol>
                </div>

                {!installed && (
                  <p className="text-center text-neutral-500 text-sm">
                    Already installed?{" "}
                    <button
                      onClick={() => setStep(3)}
                      className="text-amber-400 hover:underline"
                    >
                      Continue →
                    </button>
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-green-400 mb-2">
                    Ready to Play!
                  </h3>
                  <p className="text-neutral-400">
                    The userscript is installed. Now go play your auction!
                  </p>
                </div>

                <Link
                  href="/"
                  className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3"
                >
                  <Zap className="w-6 h-6" />
                  <span>Go to Home & Enter Room Code</span>
                </Link>

                <div className="pt-6 border-t border-neutral-800">
                  <h4 className="font-medium mb-3">How it works:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-neutral-400 text-sm">
                    <li>
                      Play IPL Auction on{" "}
                      <a
                        href="https://playauctiongame.com"
                        target="_blank"
                        rel="noopener"
                        className="text-amber-400 hover:underline"
                      >
                        playauctiongame.com
                      </a>
                    </li>
                    <li>
                      When auction ends, click{" "}
                      <span className="font-medium text-white">
                        "Export to Arena"
                      </span>{" "}
                      button in header
                    </li>
                    <li>
                      Share the room link (e.g.,{" "}
                      <code className="bg-neutral-800 px-1 rounded">
                        arena.app/room/9TM8LF
                      </code>
                      ) with friends
                    </li>
                    <li>
                      Friends just click the link -{" "}
                      <span className="font-medium text-green-400">
                        no install needed!
                      </span>
                    </li>
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
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-neutral-800">
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                disabled={step === 3}
                className="btn-primary"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-10 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Code className="w-5 h-5" />
            For Developers
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-neutral-400">
            <div className="p-4 bg-neutral-800/50 rounded-lg font-mono text-white">
              <span className="text-green-400">// ==UserScript==</span>
              <br />
              <span className="text-amber-400">@name</span> IPL Auction Arena
              Exporter
              <br />
              <span className="text-amber-400">@match</span>{" "}
              https://www.playauctiongame.com/room/*
              <br />
              <span className="text-amber-400">@grant</span> GM_xmlhttpRequest
              <br />
              <span className="text-amber-400">@connect</span> arena.app
              <br />
              <span className="text-green-400">// ==/UserScript==</span>
            </div>
            <div className="p-4 bg-neutral-800/50 rounded-lg">
              <p className="mb-2">The userscript:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Detects auction COMPLETED status</li>
                <li>Extracts teams, players, prices from localStorage</li>
                <li>
                  Posts data to{" "}
                  <code className="bg-neutral-800 px-1 rounded">
                    /api/import-room
                  </code>
                </li>
                <li>Auto-updates via GitHub raw URL</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto text-center text-neutral-500 text-sm">
          Only the <strong className="text-white">HOST</strong> needs this
          userscript. Friends just join via room link.
        </div>
      </footer>
    </div>
  );
}
