import fs from 'fs'
import path from 'path'

const distDir = path.resolve(__dirname, '../public/userscript')
const outputFile = path.join(distDir, 'ipl-auction-arena.user.js')

// Read the built file
let content = fs.readFileSync(outputFile, 'utf-8')

// Ensure proper userscript header (Vite might not preserve it exactly)
const header = `// ==UserScript==
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
`

// Remove any existing header and prepend clean one
content = content.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n?/, '')
content = header + '\n' + content

// Write final file
fs.writeFileSync(outputFile, content)
console.log('Userscript built:', outputFile)
console.log('Size:', (content.length / 1024).toFixed(1), 'KB')