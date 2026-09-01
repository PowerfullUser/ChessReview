// Imports
import settings from "./settings.json" with {"type":"json"}

// Settings
const username = settings.user.name;
const platform = settings.user.platform;
const email = settings.user.email;

// Headers
const headers = {
    "Accept" : "application/json"
};

// Chess.com JSON Data

// Latest Archive
async function getMonthlyArchives(username : string) {
    try {
        const url = `https://api.chess.com/pub/player/${(username).toLowerCase()}/games/archives`;
        const request = await fetch(url, {headers});

        if (!request.ok) {
            return;
        };

        const archives = await request.json();
        const latest_archive = archives.archives?.at(-1) ?? null;

        return latest_archive;

    } catch (error) {
        return `Error (${error})`;
    }
};

// Chess.com Last 15 Games from archive
async function getGameData(url : string) {
    const request = await fetch(url);

    if (!request.ok) {
        return;
    };

    const data = await request.json();
    const limit_games = data.games.slice(-15).toReversed();

    const pgn_data = limit_games.map((game: {pgn:string}) => game.pgn);
    const url_data = limit_games.map((game: {url:string}) => game.url);

    const white_username = limit_games.map((game: any) => game.white?.username ?? "Unknown");
    const black_username = limit_games.map((game: any) => game.black?.username ?? "Unknown");

    const white_rating = limit_games.map((game: any) => game.white?.rating ?? 0);
    const black_rating = limit_games.map((game: any) => game.black?.rating ?? 0);

    const list = {
        "pgn" : pgn_data,
        "url" : url_data,
        "white" : white_username,
        "black" : black_username,
        "whiterating" : white_rating,
        "blackrating" : black_rating,
    };

    return list
};

// List Format
type GameList = {
    pgn : string[];
    url : string[];
    white : string[];
    black : string[];
    whiterating : number[];
    blackrating : number[];
};

// Insert Games to List
function insertToList(latest_games : GameList) {
    const games_panel = document.querySelector(".games") as HTMLElement | null;

    if (!games_panel) {
        return;
    };

    games_panel.innerHTML = "";

    for (let i = 0; i < latest_games.pgn.length; i++) {
        const gameCard = document.createElement("div");
        gameCard.className = "game-card";

        const pgn = latest_games.pgn[i];
        const url = latest_games.url[i];
        const whiteUser = latest_games.white[i];
        const blackUser = latest_games.black[i];
        const whiteRating = latest_games.whiterating[i];
        const blackRating = latest_games.blackrating[i];

        gameCard.innerHTML = `<div>${whiteUser} vs ${blackUser}</div>`;
        games_panel.appendChild(gameCard);

        gameCard.addEventListener("click", () => {
            sessionStorage.setItem("selectedPgn", pgn ?? "");

            sessionStorage.setItem("white-username", whiteUser ?? "Unknown");
            sessionStorage.setItem("black-username", blackUser ?? "Unknown");

            sessionStorage.setItem("white-rating", (whiteRating ?? 0).toString());
            sessionStorage.setItem("black-rating", (blackRating ?? 0).toString());

            window.location.href = "/reviewer";
        })
    };
};

// Load Chess.com API Data
if (platform === "chess.com") {
    const archive = await getMonthlyArchives(username);
    
    if (archive && typeof archive === "string" && archive.startsWith("http")) {
        const latest_games = await getGameData(archive);

        if (latest_games) {
            insertToList(latest_games);
        }
    } else {
        console.error("Failed to load archive for user:", username);
    }
}

// Load Lichess.org API Data
else if (platform === "lichess.org") {
    undefined;
}