/*
 * Shared bot/player database.
 * Both characters.html (selection screen) and chess.html/chess.js (the game)
 * include this file so there is a single source of truth for bot names,
 * elo, avatars, flags and "vocabulary" (speech lines). Each bot has a
 * unique id from 1 to 10.
 */

// The single source of truth for every bot. IDs run 1 to 10, low to high
// strength, matching the "engineDepth" each bot should play at.
//   id      - unique identifier, 1-10
//   name    - display name
//   elo     - approximate rating (number)
//   type    - "image" (content is a URL) or "svg" (content is inline SVG markup)
//   content - the image URL or SVG markup
//   flag    - emoji flag shown next to the name
//   speech  - the bot's "vocabulary" / catchphrase shown in the speech bubble
//   engineDepth - which engine strength setting (chess.js ENGINE_LEVELS) this bot plays at
const PLAYERS = {
    "1":  { id: "1",  name: "Braindead",           elo: 1,    type: "image", content: "https://chithruka.github.io/Chithruka/Games/Chess/Assets/images/characters/braindead.webp", flag: "🏳️", speech: "King to the center on move 3. It is the only way.", engineDepth: 0 },
    "2":  { id: "2",  name: "Clueless Colin",       elo: 100,  type: "image", content: "https://robohash.org/CluelessColin.png?set=set1&size=200x200", flag: "🇺🇸", speech: "Hi, I'm Clueless Colin! Let's play!", engineDepth: 100 },
    "3":  { id: "3",  name: "Blunderbuss Barry",    elo: 300,  type: "image", content: "https://robohash.org/BlunderbussBarry.png?set=set1&size=200x200", flag: "🇬🇧", speech: "Defense is for cowards! All out attack!", engineDepth: 300 },
    "4":  { id: "4",  name: "One-Move Max",         elo: 600,  type: "image", content: "https://robohash.org/OneMoveMax.png?set=set1&size=200x200", flag: "🇨🇦", speech: "Is that a free piece? Don't mind if I do.", engineDepth: 600 },
    "5":  { id: "5",  name: "Scholar Steve",        elo: 1000, type: "image", content: "https://robohash.org/ScholarSteve.png?set=set1&size=200x200", flag: "🇦🇺", speech: "Prepare to fall for my legendary opening trap!", engineDepth: 1000 },
    "6":  { id: "6",  name: "Tactical Tina",        elo: 1200, type: "image", content: "https://robohash.org/TacticalTina.png?set=set1&size=200x200", flag: "🇩🇪", speech: "Keep your pieces protected, or I'll find a fork.", engineDepth: 1200 },
    "7":  { id: "7",  name: "Positional Pete",      elo: 1800, type: "image", content: "https://robohash.org/PositionalPete.png?set=set1&size=200x200", flag: "🇳🇱", speech: "I am in no rush. I will slowly squeeze your position.", engineDepth: 1800 },
    "8":  { id: "8",  name: "Expert Evan",          elo: 2000, type: "image", content: "https://robohash.org/ExpertEvan.png?set=set1&size=200x200", flag: "🇫🇷", speech: "I hope you know your opening theory 15 moves deep.", engineDepth: 2000 },
    "9":  { id: "9",  name: "Grandmaster Gary",     elo: 2500, type: "image", content: "https://robohash.org/GrandmasterGary.png?set=set1&size=200x200", flag: "🇷🇺", speech: "Your inaccuracies will be punished severely.", engineDepth: 2500 },
    "10": { id: "10", name: "Stockfish",            elo: 3200, type: "image", content: "https://stockfishchess.org/images/logo/icon_512x512@2x.webp", flag: "🇳🇴", speech: "Evaluation: +M12. You blundered on move 4.", engineDepth: "max" }
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