/*
 * Braindead bot banter.
 * Makes the "Braindead" bot (id "1", ENGINE_DEPTH === BRAINDEAD_LEVEL) react
 * naturally to what's happening on the board by showing lines in its existing
 * speech bubble (showBotSpeechBubble). No other bot is affected.
 *
 * This file must be loaded AFTER players.js, chess.js, and
 * bot-banter-loader.js (which provides the shared window.BotBanter
 * helpers this file uses for piece-aware capture lines). It patches a
 * couple of chess.js's global functions (finalizeMoveOutcome,
 * showBotSpeechBubble) to hook into the game flow without editing chess.js
 * directly.
 */
(function () {
    "use strict";

    const PREGAME_GREETINGS = [
        "Are we playing the one with the jumping horses or the little plastic pucks?",
        "I\u2019ve spent zero seconds preparing for this match. Let\u2019s go.",
        "Good luck! I closed my eyes and let Jesus take the mouse.",
        "My Elo is 1, but my heart is a 3000.",
        "Ready to get crushed by the ultimate strategy: absolute chaos."
    ];

    const MIDGAME_CHATTER = [
        "Why are we fighting? Can't the white and black pieces just get along?",
        "I'm just clicking things until the computer makes a sound.",
        "Ah, the 'Bongcloud.' Wait, no, I just moved my rook pawn.",
        "Do you think the little castle guys get dizzy when they move so far?",
        "I call this next move: 'The Accidental Finger Slip.'"
    ];

    const OPPONENT_CASTLES = [
        "Wait, you moved two pieces at once. I\u2019m calling a referee.",
        "Whoa, magic trick! How did you make the king swap places like that?",
        "Coward! Bring your king out to the center like a real warrior."
    ];

    // Piece-aware pools: put a line under a specific piece key (pawn,
    // knight, bishop, rook, queen) ONLY if it mentions that piece by name.
    // Anything generic enough to apply to any piece goes under "default".
    const LOSES_PIECE = {
        default: [
            "Take him, I didn't like that guy anyway.",
            "Oh, was that piece important? It looked pointy.",
            "You fool, you've activated my trap! (I have no trap).",
            "That's fine. The less pieces I have, the less choices I have to make."
        ],
        queen: [
            "Take her, I didn't like her anyway."
        ]
    };

    const TAKES_PIECE = {
        default: [
            "Oops, my finger slipped. Thanks for the free guy!",
            "I literally did not see your piece there, but I'll take it.",
            "Yum. Wood is my favorite flavor.",
            "Just as I calculated 14 moves ago. Obviously."
        ],
        queen: [
            "That piece tastes different."
        ]
    };

    const IN_CHECK = [
        "Why is the screen flashing red? Did I win?",
        "Oh no, my tall guy with the cross on his head is in danger!",
        "Check? Can I pay with cash instead?"
    ];

    const LOSES_GAME = [
        "Wait, the game is over? I was just getting warmed up!",
        "I thought the goal was to lose all your pieces first. My bad.",
        "You only won because you used strategy. Try playing with your monitor off next time.",
        "Well played! I have absolutely no idea what just happened."
    ];

    const WINS_GAME = [
        "Wait, seriously? I won? I was trying to move my horse!",
        "See? Grandmasters overcomplicate this game. Just click randomly.",
        "I am a tactical genius. Please don't ask me to explain how I did that.",
        "Bow before the Elo 1 champion!"
    ];

    const DRAW_LINES = [
        "A tie! This proves we are entirely equal in skill.",
        "I ran out of legal moves? I thought I could just move off the board.",
        "We both survive! A beautiful day for peace."
    ];

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    // Only chatter when the current opponent is the Braindead bot and a
    // color/game has actually started.
    function isBraindeadActive() {
        return typeof ENGINE_DEPTH !== "undefined" &&
            typeof BRAINDEAD_LEVEL !== "undefined" &&
            ENGINE_DEPTH === BRAINDEAD_LEVEL &&
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
    // "speech" line for a random greeting whenever it's Braindead talking. ---
    if (typeof showBotSpeechBubble === "function") {
        const _origShowBotSpeechBubble = showBotSpeechBubble;
        showBotSpeechBubble = function (text) {
            if (typeof ENGINE_DEPTH !== "undefined" && typeof BRAINDEAD_LEVEL !== "undefined" &&
                ENGINE_DEPTH === BRAINDEAD_LEVEL && text === engineSpeech) {
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
                console.error("Braindead banter error:", e);
            }
        };
    }

    function reactToMove(piece, id, castle, fromPos, wasCapture) {
        // Skip the recursive rook-only leg of a castle; we react on the
        // king's own move below instead.
        if (castle) return;
        if (!isBraindeadActive()) return;

        const moverColor = piece.piece_name.includes("WHITE") ? "white" : "black";
        const eColor = engineColor();
        const braindeadIsMover = moverColor === eColor;
        const userIsMover = !braindeadIsMover;
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
        } else if (wasCapture && braindeadIsMover) {
            line = BotBanter.pickForPiece(TAKES_PIECE, BotBanter.lastCapturedPieceType);
        } else if (typeof whoInCheck !== "undefined" && whoInCheck === eColor) {
            line = pick(IN_CHECK);
        } else if (Math.random() < 0.15) {
            line = pick(MIDGAME_CHATTER);
        }

        say(line, delay);
    }
})();
