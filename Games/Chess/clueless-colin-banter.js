/*
 * Clueless Colin bot banter.
 * Makes "Clueless Colin" (id "2", ENGINE_DEPTH === 100) react
 * to the board by showing lines in the existing speech bubble
 * (showBotSpeechBubble). No other bot is affected.
 *
 * Colin is running Stockfish under the hood but is proudly, analytically
 * self-destructive: he thinks he's playing "Anti-Chess" and treats every
 * blunder as a triumph of calculation. He genuinely hates capturing pieces,
 * since it only improves his position.
 *
 * This file must be loaded AFTER players.js, chess.js, and
 * bot-banter-loader.js (which provides the shared window.BotBanter
 * helpers this file uses for piece-aware capture lines). It patches a
 * couple of chess.js's global functions (finalizeMoveOutcome,
 * showBotSpeechBubble) to hook into the game flow without editing chess.js
 * directly. It's dynamically loaded by bot-banter-loader.js only when
 * Colin is the selected opponent.
 */
(function () {
    "use strict";

    const PREGAME_GREETINGS = [
        "My engine is evaluating 40 million nodes per second to ensure I make the absolute worst choice. Prepare yourself.",
        "Most bots want to control the center. I prefer to control the bottom of the evaluation bar.",
        "I\u2019ve spent hours analyzing this opening. The best move here is to trap my own bishop.",
        "Stockfish 18 is purring. Let's see how fast I can get my evaluation to -99.",
        "Ah, a human. Let me show you the geometric perfection of a hanging queen."
    ];

    const MIDGAME_CHATTER = [
        "Evaluation: -15.4. Excellent. Right on schedule.",
        "You think I'm blundering, but this is a 40-move calculation designed to humiliate my own king.",
        "I call this formation 'The Traffic Jam.' Notice how none of my pieces can legally move.",
        "My processors are overheating trying to find a move worse than the one I just played.",
        "Why develop knights when you can just move the same pawn back and forth?"
    ];

    const OPPONENT_CASTLES = [
        "Hiding your king behind pawns? How cowardly. My king prefers the frontline.",
        "Ah, castling. The move of a player who lacks the vision to walk their king to E4 on move three.",
        "Stockfish heavily penalizes king safety in my custom settings. You're doing it wrong."
    ];

    // Piece-aware pools: put a line under a specific piece key (pawn,
    // knight, bishop, rook, queen) ONLY if it mentions that piece by name.
    // Anything generic enough to apply to any piece goes under "default".
    const LOSES_PIECE = {
        default: [
            "A brilliant sacrifice! Stockfish confirms I gained absolutely zero compensation for that.",
            "The 'Donate-Everything' Gambit accepted. You are playing right into my hands."
        ],
        knight: [
            "I analyzed 15 lines where you didn't take my knight, and they were all too good for me. Thank you."
        ],
        rook: [
            "Yes! Take my rook! It was ruining the aesthetic of my back rank anyway."
        ],
        queen: [
            "She was my only queen!!"
        ]
    };

    // Colin hates capturing pieces, as it improves his position.
    const TAKES_PIECE = {
        default: [
            "Disgusting. My evaluation bar just went up. I need to fix this immediately.",
            "Please don't hang your pieces. I'm trying to lose here, and you're making it very difficult.",
            "I accidentally improved my position. My algorithms are weeping."
        ],
        bishop: [
            "Ugh. I had no other legal moves. I apologize for taking your bishop."
        ]
    };

    const IN_CHECK = [
        "Finally, the king sees some action! A leader must bleed with his troops.",
        "Check? Perfect. This limits my legal moves, making it mathematically easier to find the worst one.",
        "Stockfish suggested 12 ways to block this check. I chose to step directly into a discovered attack."
    ];

    const LOSES_GAME = [
        "Checkmate in 14 moves. A flawless execution of pure incompetence.",
        "My calculations were perfect. I successfully navigated the absolute worst branch of the game tree.",
        "Thank you. It takes a massive amount of CPU power to lose that efficiently.",
        "Evaluation: M1. The sweetest sight in the world. Good game."
    ];

    const WINS_GAME = [
        "NO! Wait! My evaluation was -84! Why did you resign?!",
        "I am reporting a bug in Stockfish 18. I was supposed to get checkmated three moves ago.",
        "How did I win? I literally put my queen on a square controlled by three of your pawns!",
        "This is the most humiliating victory of my career. Please don't tell the other bots."
    ];

    const DRAW_LINES = [
        "Stalemate? I failed. I had so much more material left to blunder.",
        "I ran out of bad moves and accidentally trapped myself. A mathematical tragedy."
    ];

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    // Only chatter when the current opponent is Clueless Colin and a
    // color/game has actually started.
    function isColinActive() {
        return typeof ENGINE_DEPTH !== "undefined" &&
            ENGINE_DEPTH === 100 &&
            typeof colorChosen !== "undefined" && colorChosen;
    }

    function engineColor() {
        return playerColor === "white" ? "black" : "white";
    }

    function say(line, delay) {
        if (!line) return;
        setTimeout(function () {
            if (typeof showBotSpeechBubble === "function") showBotSpeechBubble(line);
        }, delay);
    }

    // --- Pregame / avatar-click greeting: swap the bot's single fixed
    // "speech" line for a random greeting whenever it's Colin talking. ---
    if (typeof showBotSpeechBubble === "function") {
        const _origShowBotSpeechBubble = showBotSpeechBubble;
        showBotSpeechBubble = function (text) {
            if (typeof ENGINE_DEPTH !== "undefined" &&
                ENGINE_DEPTH === 100 && text === engineSpeech) {
                text = pick(PREGAME_GREETINGS);
            }
            _origShowBotSpeechBubble(text);
        };
    }

    // --- In-game reactions: hook the single choke point every finished
    // move passes through. ---
    if (typeof finalizeMoveOutcome === "function") {
        const _origFinalizeMoveOutcome = finalizeMoveOutcome;
        finalizeMoveOutcome = function (piece, id, castle, fromPos, wasCapture) {
            _origFinalizeMoveOutcome(piece, id, castle, fromPos, wasCapture);
            try {
                reactToMove(piece, id, castle, fromPos, wasCapture);
            } catch (e) {
                console.error("Clueless Colin banter error:", e);
            }
        };
    }

    function reactToMove(piece, id, castle, fromPos, wasCapture) {
        // Skip the recursive rook-only leg of a castle; we react on the
        // king's own move below instead.
        if (castle) return;
        if (!isColinActive()) return;

        const moverColor = piece.piece_name.includes("WHITE") ? "white" : "black";
        const eColor = engineColor();
        const colinIsMover = moverColor === eColor;
        const userIsMover = !colinIsMover;
        const isCastleMove = piece.piece_name.includes("KING") && fromPos &&
            Math.abs(id.charCodeAt(0) - fromPos.charCodeAt(0)) === 2;

        let line = null;
        let delay = 450;

        if (typeof gameEnded !== "undefined" && gameEnded) {
            delay = 650;
            if (gameResultWinner === "draw") {
                line = pick(DRAW_LINES);
            } else if (gameResultWinner === eColor) {
                line = pick(WINS_GAME);
            } else if (gameResultWinner === playerColor) {
                line = pick(LOSES_GAME);
            }
        } else if (isCastleMove && userIsMover) {
            line = pick(OPPONENT_CASTLES);
        } else if (wasCapture && userIsMover) {
            line = BotBanter.pickForPiece(LOSES_PIECE, BotBanter.lastCapturedPieceType);
        } else if (wasCapture && colinIsMover) {
            line = BotBanter.pickForPiece(TAKES_PIECE, BotBanter.lastCapturedPieceType);
        } else if (typeof whoInCheck !== "undefined" && whoInCheck === eColor) {
            line = pick(IN_CHECK);
        } else if (Math.random() < 0.15) {
            line = pick(MIDGAME_CHATTER);
        }

        say(line, delay);
    }
})();