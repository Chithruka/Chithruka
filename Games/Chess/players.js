/*
 * Shared bot/player database.
 * Both characters.html (selection screen) and chess.html/chess.js (the game)
 * include this file so there is a single source of truth for bot names,
 * elo, avatars, flags and "vocabulary" (speech lines). Each bot has a
 * unique id from 1 to 11.
 */

// Pure SVGs representing distinct bot personalities (used when a bot has
// no photo-style avatar image).
const BOT_ICONS = {
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
    target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`
};

// The single source of truth for every bot. IDs run 1 to 11, low to high
// strength, matching the "engineDepth" each bot should play at.
//   id      - unique identifier, 1-11
//   name    - display name
//   elo     - approximate rating (number)
//   type    - "image" (content is a URL) or "svg" (content is inline SVG markup)
//   content - the image URL or SVG markup
//   flag    - emoji flag shown next to the name
//   speech  - the bot's "vocabulary" / catchphrase shown in the speech bubble
//   engineDepth - which engine strength setting (chess.js ENGINE_LEVELS) this bot plays at
const PLAYERS = {
    "1":  { id: "1",  name: "Braindead",           elo: 1,    type: "image", content: "https://chithruka.github.io/Chithruka/Games/Chess/Assets/images/characters/braindead.webp", flag: "🏳️", speech: "King to the center on move 3. It is the only way.", engineDepth: 0 },
    "2":  { id: "2",  name: "Clueless Colin",       elo: 100,  type: "svg",   content: BOT_ICONS.help,    flag: "🇺🇸", speech: "Hi, I'm Clueless Colin! Let's play!", engineDepth: 100 },
    "3":  { id: "3",  name: "Blunderbuss Barry",    elo: 250,  type: "svg",   content: BOT_ICONS.target,  flag: "🇬🇧", speech: "Defense is for cowards! All out attack!", engineDepth: 5 },
    "4":  { id: "4",  name: "One-Move Max",         elo: 600,  type: "svg",   content: BOT_ICONS.eye,     flag: "🇨🇦", speech: "Is that a free piece? Don't mind if I do.", engineDepth: 6 },
    "5":  { id: "5",  name: "Scholar Steve",        elo: 900,  type: "svg",   content: BOT_ICONS.book,    flag: "🇦🇺", speech: "Prepare to fall for my legendary opening trap!", engineDepth: 7 },
    "6":  { id: "6",  name: "Tactical Tina",        elo: 1200, type: "svg",   content: BOT_ICONS.zap,     flag: "🇩🇪", speech: "Keep your pieces protected, or I'll find a fork.", engineDepth: 8 },
    "7":  { id: "7",  name: "Positional Pete",      elo: 1600, type: "svg",   content: BOT_ICONS.shield,  flag: "🇳🇱", speech: "I am in no rush. I will slowly squeeze your position.", engineDepth: 9 },
    "8":  { id: "8",  name: "Expert Evan",          elo: 2000, type: "svg",   content: BOT_ICONS.cpu,     flag: "🇫🇷", speech: "I hope you know your opening theory 15 moves deep.", engineDepth: 10 },
    "9":  { id: "9",  name: "Grandmaster Gary",     elo: 2400, type: "svg",   content: BOT_ICONS.star,    flag: "🇷🇺", speech: "Your inaccuracies will be punished severely.", engineDepth: 11 },
    "10": { id: "10", name: "The Oracle",           elo: 2850, type: "svg",   content: BOT_ICONS.sparkle, flag: "🇮🇳", speech: "Resistance is futile. I play the objectively best move.", engineDepth: 15 },
    "11": { id: "11", name: "Stockfish",            elo: 3200, type: "image", content: "https://images.chesscomfiles.com/uploads/v1/bot_personality/4c07340e-8a5d-11ea-9abb-79b3443058a1.6bfb2f43.384x384o.9fad36f33baf.png", flag: "🇳🇴", speech: "Evaluation: +M12. You blundered on move 4.", engineDepth: 15 }
};

// Render a bot's avatar as an <img> or raw inline SVG.
function renderBotContent(botData) {
    if (botData.type === 'image') {
        return `<img src="${botData.content}" alt="${botData.name}">`;
    }
    return botData.content;
}

// Turn a bot's icon into an <img>-friendly URL, whether it's already an
// image URL or one of our inline SVGs (which use currentColor for stroke).
function botAvatarUrl(botData) {
    if (botData.type === 'image') return botData.content;
    const coloredSvg = botData.content.replace(/currentColor/g, '#81b64c');
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(coloredSvg);
}
