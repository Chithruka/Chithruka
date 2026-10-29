/*
 * Bot banter loader.
 * Dynamically loads a bot-specific banter script (like braindead-banter.js)
 * ONLY once the game actually knows which bot the user is playing against,
 * so nothing extra is fetched for bots that don't talk yet.
 *
 * To give a bot its own reactions: create a JS file with the filename
 * listed below for that bot's id (same folder as chess.html, same pattern
 * as braindead-banter.js) and it will be picked up automatically. Bots
 * with no entry, or whose file doesn't exist yet, are simply skipped.
 *
 * This file also sets up window.BotBanter, a small shared helper that every
 * per-bot banter script can use so they don't each have to reinvent it:
 *
 *   BotBanter.lastCapturedPieceType
 *     After a move finishes, this holds the type of piece that was just
 *     captured ("pawn" | "knight" | "bishop" | "rook" | "queen"), or null
 *     if the move wasn't a capture. Read it inside your finalizeMoveOutcome
 *     hook, right where you currently check `wasCapture`.
 *
 *   BotBanter.pick(list)
 *     Returns a random line from a flat array.
 *
 *   BotBanter.pickForPiece(pools, pieceType)
 *     `pools` is an object like:
 *       { default: [...], pawn: [...], rook: [...], queen: [...] }
 *     Returns a random line from pools[pieceType] if that bucket exists and
 *     has lines, otherwise falls back to pools.default. Use this instead of
 *     a single flat array for "lost a piece" / "took a piece" lines, so a
 *     line that name-drops "rook" only ever gets said about an actual rook.
 *
 * Must be loaded AFTER players.js and chess.js.
 */
(function () {
    "use strict";

    // PLAYERS id -> banter script filename.
    const BOT_BANTER_FILES = {
        "1": "braindead-banter.js",       // Braindead
        "2": "clueless-colin-banter.js",  // Clueless Colin
        "3": "blunderbuss-barry-banter.js", // Blunderbuss Barry
        "4": "one-move-max-banter.js",    // One-Move Max
        "5": "scholar-steve-banter.js",   // Scholar Steve
        "6": "tactical-tina-banter.js",   // Tactical Tina
        "7": "positional-pete-banter.js", // Positional Pete
        "8": "expert-evan-banter.js",     // Expert Evan
        "9": "grandmaster-gary-banter.js",// Grandmaster Gary
        "10": "leela-banter.js",     // The Oracle
        "11": "stockfish-banter.js"       // Stockfish
    };

    let loadedBotId = null;

    function currentBotId() {
        if (typeof PLAYERS === "undefined") return null;
        const entry = Object.entries(PLAYERS).find(([, b]) => b.name === engineName);
        return entry ? entry[0] : null;
    }

    function loadBotBanter() {
        const botId = currentBotId();
        if (!botId || botId === loadedBotId) return;
        const file = BOT_BANTER_FILES[botId];
        if (!file) return;
        loadedBotId = botId;
        const script = document.createElement("script");
        script.src = file;
        script.onerror = function () {
            console.info(`Bot banter: no file found for "${engineName}" (expected ${file}).`);
        };
        document.body.appendChild(script);
    }

    // attachBotSpeechAvatarHandlers runs exactly once, right after the user
    // (or a preset URL) locks in which bot/color they're playing - the
    // earliest point at which engineName is guaranteed to be final.
    if (typeof attachBotSpeechAvatarHandlers === "function") {
        const _origAttachBotSpeechAvatarHandlers = attachBotSpeechAvatarHandlers;
        attachBotSpeechAvatarHandlers = function () {
            _origAttachBotSpeechAvatarHandlers();
            loadBotBanter();
        };
    }

    // --- Shared helpers for all per-bot banter files ---

    const BotBanter = window.BotBanter = window.BotBanter || {};

    BotBanter.lastCapturedPieceType = null;

    BotBanter.pick = function (list) {
        return list[Math.floor(Math.random() * list.length)];
    };

    BotBanter.pickForPiece = function (pools, pieceType) {
        if (!pools) return null;
        const specific = pieceType && pools[pieceType];
        const list = (specific && specific.length) ? specific : pools.default;
        return (list && list.length) ? BotBanter.pick(list) : null;
    };

    // Figures out what, if anything, sits on the destination square (or the
    // en-passant square) BEFORE a move is applied, mirroring the exact same
    // capture checks chess.js itself uses inside moveElement.
    function computeCapturedPieceType(piece, id) {
        try {
            const isPawn = piece.piece_name.toLowerCase().includes("pawn");
            let capturedPiece = null;
            if (isPawn && typeof enPassant !== "undefined" && enPassant && id === enPassant.square &&
                !piece.piece_name.includes(enPassant.pawn.piece_name.split("_")[0])) {
                capturedPiece = enPassant.pawn;
            } else if (typeof keySquareMapper !== "undefined" && keySquareMapper[id] && keySquareMapper[id].piece) {
                capturedPiece = keySquareMapper[id].piece;
            }
            if (!capturedPiece) return null;
            const name = capturedPiece.piece_name.toLowerCase();
            if (name.includes("pawn")) return "pawn";
            if (name.includes("knight")) return "knight";
            if (name.includes("bishop")) return "bishop";
            if (name.includes("rook")) return "rook";
            if (name.includes("queen")) return "queen";
            if (name.includes("king")) return "king";
            return null;
        } catch (e) {
            return null;
        }
    }

    // Wrap moveElement exactly once (regardless of which bot ends up
    // talking) to record what's about to be captured before chess.js
    // mutates the board. Every per-bot script reads the result back via
    // BotBanter.lastCapturedPieceType inside its finalizeMoveOutcome hook.
    if (typeof moveElement === "function" && !BotBanter._moveElementWrapped) {
        BotBanter._moveElementWrapped = true;
        const _origMoveElementForBanter = moveElement;
        moveElement = function (piece, id, castle, autoPromoteLetter, instant) {
            BotBanter.lastCapturedPieceType = computeCapturedPieceType(piece, id);
            _origMoveElementForBanter(piece, id, castle, autoPromoteLetter, instant);
        };
    }
})();

