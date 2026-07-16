// ==UserScript==
// @name         IPL Auction Arena Exporter
// @namespace    https://github.com/yourusername/ipl-auction-arena
// @version      1.0.0
// @description  Export IPL Auction squads to IPL Auction Arena for post-auction XI battles
// @author       IPL Auction Arena
// @match        https://www.playauctiongame.com/room/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @connect      arena.app
// @connect      localhost
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/yourusername/ipl-auction-arena/main/userscript/ipl-auction-arena.user.js
// @downloadURL  https://raw.githubusercontent.com/yourusername/ipl-auction-arena/main/userscript/ipl-auction-arena.user.js
// ==/UserScript==

(function() {
  "use strict";
  (() => {
    const API_BASE = typeof GM_info !== "undefined" && GM_info.scriptHandler === "Tampermonkey" ? "https://arena.app/api" : "http://localhost:3000/api";
    const EXPORT_BUTTON_ID = "ipl-arena-export-btn";
    const STYLE_ID = "ipl-arena-styles";
    const IPL_TEAMS = [
      { id: "MI", name: "Mumbai Indians", shortName: "MI", color: "#004BA0" },
      { id: "CSK", name: "Chennai Super Kings", shortName: "CSK", color: "#FFCB05" },
      { id: "RCB", name: "Royal Challengers Bengaluru", shortName: "RCB", color: "#EC1C24" },
      { id: "KKR", name: "Kolkata Knight Riders", shortName: "KKR", color: "#3A225D" },
      { id: "DC", name: "Delhi Capitals", shortName: "DC", color: "#0078BC" },
      { id: "PBKS", name: "Punjab Kings", shortName: "PBKS", color: "#ED1B24" },
      { id: "RR", name: "Rajasthan Royals", shortName: "RR", color: "#EA1A85" },
      { id: "SRH", name: "Sunrisers Hyderabad", shortName: "SRH", color: "#FF822A" },
      { id: "GT", name: "Gujarat Titans", shortName: "GT", color: "#1A3A5C" },
      { id: "LSG", name: "Lucknow Super Giants", shortName: "LSG", color: "#A72056" }
    ];
    function log(...args) {
      console.log("[IPL Arena]", (/* @__PURE__ */ new Date()).toISOString(), ...args);
    }
    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
      #${EXPORT_BUTTON_ID} {
        position: fixed !important;
        top: 16px !important;
        right: 16px !important;
        z-index: 2147483647 !important;
        background: linear-gradient(135deg, #f59e0b, #ea580c) !important;
        color: #000 !important;
        border: none !important;
        padding: 12px 20px !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        font-size: 14px !important;
        cursor: pointer !important;
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        transition: all 0.2s !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      #${EXPORT_BUTTON_ID}:hover:not(:disabled) {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 28px rgba(245, 158, 11, 0.5) !important;
      }
      #${EXPORT_BUTTON_ID}:disabled {
        opacity: 0.6 !important;
        cursor: not-allowed !important;
        background: #6b7280 !important;
      }
      #${EXPORT_BUTTON_ID}.exporting {
        background: linear-gradient(135deg, #22c55e, #16a34a) !important;
      }
      #${EXPORT_BUTTON_ID}.error {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      }
      .ipl-arena-toast {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        background: #1f2937 !important;
        border: 1px solid #374151 !important;
        border-radius: 12px !important;
        padding: 16px 20px !important;
        color: #fff !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        animation: ipl-arena-slide-in 0.3s ease-out !important;
        max-width: 360px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .ipl-arena-toast.success { border-color: #22c55e !important; }
      .ipl-arena-toast.error { border-color: #ef4444 !important; }
      .ipl-arena-toast.info { border-color: #3b82f6 !important; }
      @keyframes ipl-arena-slide-in {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .ipl-arena-toast-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
      .ipl-arena-toast-text { font-size: 13px; color: #9ca3af; }
      .ipl-arena-spinner {
        display: inline-block; width: 16px; height: 16px;
        border: 2px solid #374151; border-top-color: #f59e0b;
        border-radius: 50%; animation: ipl-arena-spin 0.8s linear infinite;
      }
      @keyframes ipl-arena-spin { to { transform: rotate(360deg); } }
    `;
      document.head.appendChild(style);
    }
    function createExportButton() {
      const btn = document.createElement("button");
      btn.id = EXPORT_BUTTON_ID;
      btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span>Export to Arena</span>
    `;
      btn.title = "Click to export auction data to IPL Auction Arena";
      btn.addEventListener("click", handleExport);
      document.body.appendChild(btn);
      return btn;
    }
    function showToast(type, title, text) {
      const existing = document.querySelector(".ipl-arena-toast");
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.className = `ipl-arena-toast ${type}`;
      toast.innerHTML = `
      <div class="ipl-arena-toast-title">${title}</div>
      <div class="ipl-arena-toast-text">${text}</div>
    `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "ipl-arena-slide-in 0.3s ease-out reverse";
        setTimeout(() => toast.remove(), 300);
      }, 5e3);
    }
    function setButtonState(btn, state, text) {
      btn.disabled = state === "exporting";
      btn.className = state === "idle" ? "" : state;
      const icons = {
        idle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        exporting: `<span class="ipl-arena-spinner"></span>`,
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
      };
      btn.innerHTML = icons[state] + `<span>${text}</span>`;
    }
    function extractAuctionData() {
      var _a;
      try {
        const nextDataScript = document.getElementById("__NEXT_DATA__");
        if (nextDataScript) {
          const nextData = JSON.parse(nextDataScript.textContent || "{}");
          const pageProps = (_a = nextData == null ? void 0 : nextData.props) == null ? void 0 : _a.pageProps;
          if (pageProps == null ? void 0 : pageProps.roomState) {
            log("Found data in __NEXT_DATA__");
            return transformRoomState(pageProps.roomState);
          }
        }
        const visitorId = localStorage.getItem("auction_visitor_id");
        if (visitorId) {
          const roomId = window.location.pathname.split("/room/")[1];
          const sessionKey = `auction_session_${roomId}`;
          const sessionData = localStorage.getItem(sessionKey);
          if (sessionData) {
            try {
              const session = JSON.parse(sessionData);
              if (session.secretToken) {
                log("Found session in localStorage");
              }
            } catch (e) {
              log("Failed to parse session:", e);
            }
          }
        }
        if (window.__PARTY_STATE__) {
          log("Found data in __PARTY_STATE__");
          return transformRoomState(window.__PARTY_STATE__);
        }
        const root = document.getElementById("__next");
        if (root && root._reactRootContainer) {
        }
        return null;
      } catch (e) {
        log("Extraction error:", e);
        return null;
      }
    }
    function transformRoomState(state) {
      var _a, _b, _c;
      const teams = [];
      const players = [];
      for (const [teamId, teamData] of Object.entries(state.teams || {})) {
        const t = teamData;
        const teamInfo = IPL_TEAMS.find((ti) => ti.id === teamId) || { name: teamId, shortName: teamId, color: "#64748b" };
        const teamPlayers = [];
        if (t.squad && Array.isArray(t.squad)) {
          for (const squadItem of t.squad) {
            const player = squadItem.player;
            if (player) {
              teamPlayers.push({
                playerId: player.id || player.playerId || `player_${players.length}`,
                name: player.name,
                role: mapRole(player.role),
                isOverseas: player.isOverseas === true,
                price: player.price || 0,
                auctionData: player
              });
            }
          }
        }
        if (t.retainedPlayers && Array.isArray(t.retainedPlayers)) {
          for (const rp of t.retainedPlayers) {
            if (rp.player) {
              teamPlayers.push({
                playerId: rp.player.id || rp.player.playerId || `player_${players.length}`,
                name: rp.player.name,
                role: mapRole(rp.player.role),
                isOverseas: rp.player.isOverseas === true,
                price: rp.price || 0,
                auctionData: rp.player
              });
            }
          }
        }
        teams.push({
          teamId,
          name: teamInfo.name,
          shortName: teamInfo.shortName,
          color: teamInfo.color,
          purse: t.purse || 0,
          players: teamPlayers
        });
        players.push(...teamPlayers.map((p) => ({ ...p, teamId })));
      }
      return {
        auctionRoomId: state.roomId,
        teams,
        players,
        auctionSettings: {
          mode: ((_a = state.settings) == null ? void 0 : _a.mode) || "MINI_2026",
          purseAmount: ((_b = state.settings) == null ? void 0 : _b.purseAmount) || 12e3,
          bidTimer: ((_c = state.settings) == null ? void 0 : _c.bidTimer) || 15
        }
      };
    }
    function mapRole(role) {
      const r = role == null ? void 0 : role.toLowerCase();
      if ((r == null ? void 0 : r.includes("keep")) || (r == null ? void 0 : r.includes("wk"))) return "WICKET_KEEPER";
      if ((r == null ? void 0 : r.includes("all")) || (r == null ? void 0 : r.includes("ar"))) return "ALL_ROUNDER";
      if (r == null ? void 0 : r.includes("bowl")) return "BOWLER";
      return "BATTER";
    }
    function isAuctionCompleted() {
      var _a, _b, _c;
      try {
        const nextDataScript = document.getElementById("__NEXT_DATA__");
        if (nextDataScript) {
          const nextData = JSON.parse(nextDataScript.textContent || "{}");
          return ((_c = (_b = (_a = nextData.props) == null ? void 0 : _a.pageProps) == null ? void 0 : _b.roomState) == null ? void 0 : _c.status) === "COMPLETED";
        }
        if (window.__PARTY_STATE__) {
          return window.__PARTY_STATE__.status === "COMPLETED";
        }
      } catch (e) {
      }
      return false;
    }
    async function handleExport() {
      var _a;
      const btn = document.getElementById(EXPORT_BUTTON_ID);
      if (!btn || btn.disabled) return;
      setButtonState(btn, "exporting", "Extracting data...");
      showToast("info", "Exporting...", "Reading auction data...");
      try {
        if (!isAuctionCompleted()) {
          showToast("error", "Auction Not Finished", "Wait for auction to complete (status: COMPLETED) before exporting.");
          setButtonState(btn, "error", "Auction not done");
          setTimeout(() => setButtonState(btn, "idle", "Export to Arena"), 3e3);
          return;
        }
        const data = extractAuctionData();
        if (!data || !data.teams || data.teams.length === 0) {
          showToast("error", "No Data Found", "Could not extract squad data. Refresh page and try again.");
          setButtonState(btn, "error", "No data found");
          setTimeout(() => setButtonState(btn, "idle", "Export to Arena"), 3e3);
          return;
        }
        setButtonState(btn, "exporting", "Sending to Arena...");
        showToast("info", "Uploading...", "Sending squad data to Arena...");
        const visitorId = localStorage.getItem("auction_visitor_id") || "unknown";
        const response = await fetchWithGM(`${API_BASE}/import-room`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
            exportedBy: visitorId
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(((_a = err.error) == null ? void 0 : _a.message) || `HTTP ${response.status}`);
        }
        const result = await response.json();
        log("Export successful:", result);
        showToast("success", "Exported!", `Room created: ${result.data.shareUrl}`);
        setButtonState(btn, "success", "Exported!");
        try {
          await navigator.clipboard.writeText(result.data.shareUrl);
          showToast("success", "Link Copied", "Share this link with friends!");
        } catch {
        }
        setTimeout(() => {
          setButtonState(btn, "idle", "Export to Arena");
        }, 5e3);
      } catch (e) {
        log("Export failed:", e);
        showToast("error", "Export Failed", e.message || "Unknown error. Check console for details.");
        setButtonState(btn, "error", "Failed");
        setTimeout(() => setButtonState(btn, "idle", "Export to Arena"), 3e3);
      }
    }
    function fetchWithGM(url, options) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: options.method || "GET",
          url,
          headers: options.headers || {},
          data: options.body,
          onload: (resp) => {
            const response = new Response(resp.responseText, {
              status: resp.status,
              statusText: resp.statusText,
              headers: new Headers(resp.responseHeaders || {})
            });
            resolve(response);
          },
          onerror: (err) => reject(new Error("Network error: " + err)),
          ontimeout: () => reject(new Error("Request timeout"))
        });
      });
    }
    function init() {
      injectStyles();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
        return;
      }
      const roomMatch = window.location.pathname.match(/\/room\/([A-Z0-9]{6})/);
      if (!roomMatch) return;
      log("Userscript loaded on room:", roomMatch[1]);
      const btn = createExportButton();
      let checkCount = 0;
      const maxChecks = 60;
      const checkInterval = setInterval(() => {
        checkCount++;
        if (isAuctionCompleted()) {
          clearInterval(checkInterval);
          log("Auction completed detected!");
          showToast("info", "Auction Finished!", 'Click "Export to Arena" to send squads for XI battle.');
          btn.style.animation = "pulse 2s infinite";
          const style = document.createElement("style");
          style.textContent = `
          @keyframes pulse {
            0%, 100% { box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4); }
            50% { box-shadow: 0 4px 30px rgba(245, 158, 11, 0.8); }
          }
        `;
          document.head.appendChild(style);
        } else if (checkCount >= maxChecks) {
          clearInterval(checkInterval);
        }
      }, 1e3);
      const observer = new MutationObserver(() => {
        if (isAuctionCompleted()) {
          clearInterval(checkInterval);
          observer.disconnect();
          log("Auction completed detected via MutationObserver!");
          showToast("info", "Auction Finished!", 'Click "Export to Arena" to send squads for XI battle.');
          btn.style.animation = "pulse 2s infinite";
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === "E") {
          e.preventDefault();
          handleExport();
        }
      });
    }
    init();
  })();
})();
