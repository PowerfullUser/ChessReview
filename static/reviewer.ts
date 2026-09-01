import {Chess, Move} from "chess.js";

interface PieceMap {
    [key: string]: string;
}

interface AnalysisScore {
    value: number;
    isMate: boolean;
}

interface EvaluationHistory {
    scores: number[];
    whiteScores: number[];
    blackScores: number[];
}

const pgn = sessionStorage.getItem("selectedPgn");

if (!pgn) {
    const message = "No PGN was provided";
    console.error(message);
} 

else {    
    const cleanPgn = pgn.replace(/\\n/g, "\n");
    const game = new Chess();

    function loadBoard(game: Chess): void {
        const unicodePieces: PieceMap = {
            'w-p': '/static/Pieces/wp.png', 
            'w-r': '/static/Pieces/wr.png', 
            'w-n': '/static/Pieces/wn.png', 
            'w-b': '/static/Pieces/wb.png', 
            'w-q': '/static/Pieces/wq.png', 
            'w-k': '/static/Pieces/wk.png',
            'b-p': '/static/Pieces/bp.png', 
            'b-r': '/static/Pieces/br.png', 
            'b-n': '/static/Pieces/bn.png', 
            'b-b': '/static/Pieces/bb.png', 
            'b-q': '/static/Pieces/bq.png', 
            'b-k': '/static/Pieces/bk.png'
        }

        const board = document.querySelector(".board") as HTMLElement | null;
        
        if (!board) {
            return;
        }

        board.innerHTML = ""
        const boardState = game.board();

        for (let row=0; row < 8; row++) {
            for (let col=0; col < 8; col++) {
                const square = document.createElement("div");

                const isLight = (row+col) % 2 === 0
                square.className = `square ${isLight ? "light" : "dark"}`;

                const piece = boardState[row]?.[col];
                
                if (piece) {
                    const key = `${piece.color}-${piece.type}`;
                    const image = unicodePieces[key];

                    if (image) {
                        const pieceImg = document.createElement("img");
                        pieceImg.src = image;
                        pieceImg.className = "piece";
                        pieceImg.draggable = false;
                        square.appendChild(pieceImg)
                    }
                }

                board.appendChild(square);
            };
        };
    };

    function loadWhiteDetails(): void {
        const whiteUsernameElement = document.querySelector(".white-username") as HTMLElement;
        const whiteUsername = sessionStorage.getItem("white-username");

        const whiteRatingElement = document.querySelector(".white-rating") as HTMLElement;
        const whiteRating = sessionStorage.getItem("white-rating");

        whiteUsernameElement.textContent = whiteUsername ?? "Unknown";
        whiteRatingElement.textContent = whiteRating ?? "0";
    };

    function loadBlackDetails(): void {
        const blackUserElement = document.querySelector(".black-username") as HTMLElement;
        const blackUsername = sessionStorage.getItem("black-username");

        const blackRatingElement = document.querySelector(".black-rating") as HTMLElement;
        const blackRating = sessionStorage.getItem("black-rating");

        blackUserElement.textContent = blackUsername ?? "Unknown";
        blackRatingElement.textContent = blackRating ?? "0";
    }

    try {
        game.loadPgn(cleanPgn, {strict:false});

        loadBoard(game);
        loadWhiteDetails();
        loadBlackDetails();

        const moveHistory = game.history({verbose: true});

        const replayGame = new Chess();
        let currentIndex = 0;

        function renderCurrentPosition(): void {
            replayGame.reset()

            for (let i=0; i < currentIndex; i++) {
                const move = moveHistory[i]

                if (move) {
                    replayGame.move(move)
                }
            }

            loadBoard(replayGame);
        }

        const startElement = document.getElementById("start") as HTMLElement;
        const backElement = document.getElementById("back") as HTMLElement;
        const forwardElement = document.getElementById("forward") as HTMLElement;
        const endElement = document.getElementById("end") as HTMLElement;

        startElement.addEventListener("click", () => {
            currentIndex = 0;
            renderCurrentPosition();
        });

        backElement.addEventListener("click", () => {
            if (currentIndex > 0) {
                currentIndex--;
                renderCurrentPosition();
            }
        });

        forwardElement.addEventListener("click", () => {
            if (currentIndex < moveHistory.length) {
                currentIndex++;
                renderCurrentPosition();
            }
        })

        endElement.addEventListener("click", () => {
            currentIndex = moveHistory.length;
            renderCurrentPosition();
        })

        window.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" && currentIndex > 0) {
                currentIndex--;
                renderCurrentPosition();
            }

            else if (e.key === "ArrowRight" && currentIndex < moveHistory.length) {
                currentIndex++;
                renderCurrentPosition();
            }

            else if (e.key === "ArrowUp") {
                currentIndex = moveHistory.length;
                renderCurrentPosition();
            }

            else if (e.key === "ArrowDown") {
                currentIndex = 0;
                renderCurrentPosition()
            };
        })

        function moveList(history: Move[]): void {
            const whiteMovesElement = document.querySelector(".white-moves") as HTMLElement;
            const blackMovesElement = document.querySelector(".black-moves") as HTMLElement;

            for (let i=0; i < history.length; i++) {
                const isEven = i % 2 === 0;
                
                if (isEven === true) {
                    const whiteMoveElement = document.createElement("div") as HTMLElement;
                    whiteMoveElement.className = "white-move";

                    if (whiteMoveElement) {
                        whiteMoveElement.textContent = history[i]?.san ?? "";

                        whiteMoveElement.addEventListener("click", () => {
                            currentIndex = i+1;
                            renderCurrentPosition();
                        })

                        whiteMovesElement.appendChild(whiteMoveElement);
                    }
                }

                else if (isEven === false) {
                    const blackMoveElement = document.createElement("div") as HTMLElement;
                    blackMoveElement.className = "black-move";
                    
                    if (blackMoveElement) {
                        blackMoveElement.textContent = history[i]?.san ?? "";

                        blackMoveElement.addEventListener("click", () => {
                            currentIndex = i+1;
                            renderCurrentPosition();
                        })

                        blackMovesElement.appendChild(blackMoveElement);
                    }
                }
            }
        }

        moveList(moveHistory);

        const stockfish: Worker = new Worker("/static/stockfish.js");
        let evalHistory: number[] = [];
        let percentages: number[] = [];

        let whiteAccuracies: number[] = [];
        let blackAccuracies: number[] = [];

        type FeedbackCategory =
            | "great"
            | "excellent"
            | "best"
            | "good"
            | "inaccurate"
            | "mistake"
            | "blunder";

        type FeedbackCounts = Record<FeedbackCategory, number>;
        type FeedbackType = Record<"white" | "black", FeedbackCounts>;

        let feedbackJson: FeedbackType = {
            "white" : {
                "great" : 0,
                "excellent" : 0,
                "best" : 0,
                "good" : 0,
                "inaccurate" : 0,
                "mistake" : 0,
                "blunder" : 0
            },

            "black" : {
                "great" : 0,
                "excellent" : 0,
                "best" : 0,
                "good" : 0,
                "inaccurate" : 0,
                "mistake" : 0,
                "blunder" : 0
            }
        };

        stockfish.postMessage("uci");

        async function analyzeGame(moves: Move[]): Promise<void> {
            const tempBoard = new Chess();

            evalHistory = [];
            percentages = [];

            const startScore = await getEval(tempBoard.fen(), 12);
            percentages = [getWinPercentage(startScore)];

            for (let i=0; i < moves.length; i++) {
                const move = moves[i];
                if (!move) break;

                if (move === undefined) {
                    break;
                }

                tempBoard.move(move);
                
                const score = await getEval(tempBoard.fen(), 12);
                evalHistory.push(score);
                
                const winPercent = getWinPercentage(score);
                percentages.push(winPercent);
            }

            gameReview(percentages);
            getMoveFeedback(percentages);
            
            const whitePercentage = calculateAverage(whiteAccuracies);
            const blackPercentage = calculateAverage(blackAccuracies);

            displayAverage(whitePercentage, blackPercentage);
            displayFeedback(feedbackJson);
        };

        function getWinPercentage(score : number) {
            const cp = 100 * score
            const formula = 50 + 50 * (2 / (1 + Math.exp(-0.003682 * cp)) - 1);

            return Math.round(formula);
        };

        function gameReview(list : number[]) {
            whiteAccuracies = [];
            blackAccuracies = [];

            for (let i=1; i < list.length; i++) {
                if (i % 2 === 0) {
                    const currentWhite = list[i];
                    const prevWhite = list[i - 1];

                    if (currentWhite && prevWhite) {
                        const diff = Math.max(0, prevWhite - currentWhite);
                        whiteAccuracies.push(diff);
                    };
                }
                
                else {
                    const currentBlack = list[i];
                    const prevBlack = list[i - 1];

                    if (currentBlack && prevBlack) {
                        const currentBlackWin = 100 - currentBlack;
                        const prevBlackWin = 100 - prevBlack;

                        const diff = Math.max(0, prevBlackWin - currentBlackWin);
                        blackAccuracies.push(diff);
                    }
                };
            }
        };

        function returnFeedback(data : number) {
            if (data === 0) {
                return "great";
            }

            else if (data <= 2) {
                return "excellent";
            }

            else if (data <=5) {
                return "good";
            }

            else if (data <= 10) {
                return "inaccurate";
            }

            else if (data <= 20) {
                return "mistake";
            }

            else {
                return "blunder";
            };
        }

        function getMoveFeedback(list : number[]) {
            for (let i=1; i < list.length; i++) {
                const currentMove = list[i];
                const prevMove = list[i - 1];

                const isWhite = i % 2 === 0;

                if (currentMove && prevMove) {
                    if (isWhite) {
                        const diff = Math.max(0, prevMove - currentMove);

                        const category = returnFeedback(diff);
                        feedbackJson["white"][category]++;
                    }

                    else {
                        const prevBlackWin = 100 - prevMove;
                        const currentBlackWin = 100 - currentMove;

                        const diff = Math.max(0, prevBlackWin - currentBlackWin);
                        const category = returnFeedback(diff);

                        feedbackJson["black"][category]++;
                    };
                };
            };
        }

        function calculateAverage(list : number[]) {
            const total = list.reduce((sum, current) => sum + current, 0);
            const length = list.length;

            const avg = total / length
            const formula = 100 * Math.exp(-0.05 * avg);

            return Math.round(formula);
        }

        function displayAverage(white : number, black : number) {
            const whiteElement = document.getElementById("white-accuracy") as HTMLElement;
            const blackElement = document.getElementById("black-accuracy") as HTMLElement;

            const whiteAccuracy = white.toString()
            const blackAccuracy = black.toString()

            if (whiteAccuracy && blackAccuracy) {
                whiteElement.textContent = whiteAccuracy;
                blackElement.textContent = blackAccuracy;
            };
        };

        function displayFeedback(json : FeedbackType) {
            const white_greatElement = document.getElementById("great-white") as HTMLElement;
            const white_excellentElement = document.getElementById("excellent-white") as HTMLElement;
            const white_goodElement = document.getElementById("good-white") as HTMLElement;
            const white_inaccurateElement = document.getElementById("inaccurate-white") as HTMLElement;
            const white_mistakeElement = document.getElementById("mistake-white") as HTMLElement;
            const white_blunderElement = document.getElementById("blunder-white") as HTMLElement;

            const black_greatElement = document.getElementById("great-black") as HTMLElement;
            const black_excellentElement = document.getElementById("excellent-black") as HTMLElement;
            const black_goodElement = document.getElementById("good-black") as HTMLElement;
            const black_inaccurateElement = document.getElementById("inaccurate-black") as HTMLElement;
            const black_mistakeElement = document.getElementById("mistake-black") as HTMLElement;
            const black_blunderElement = document.getElementById("blunder-black") as HTMLElement;

            if (json) {
                white_greatElement.textContent = json["white"]["great"].toString()
                white_excellentElement.textContent = json["white"]["excellent"].toString()
                white_goodElement.textContent = json["white"]["good"].toString()
                white_inaccurateElement.textContent = json["white"]["inaccurate"].toString()
                white_mistakeElement.textContent = json["white"]["mistake"].toString()
                white_blunderElement.textContent = json["white"]["blunder"].toString()

                black_greatElement.textContent = json["black"]["great"].toString()
                black_excellentElement.textContent = json["black"]["excellent"].toString()
                black_goodElement.textContent = json["black"]["good"].toString()
                black_inaccurateElement.textContent = json["black"]["inaccurate"].toString()
                black_mistakeElement.textContent = json["black"]["mistake"].toString()
                black_blunderElement.textContent = json["black"]["blunder"].toString()
            }
        }

        function getEval(fen: string, depth: number = 12): Promise<number> {
            return new Promise<number>((resolve) => {
                stockfish.postMessage(`position fen ${fen}`);
                stockfish.postMessage(`go depth ${depth.toString()}`)

                stockfish.onmessage = (e) => {
                    const line = e.data;

                    if (typeof line === "string" && line.includes("score cp")) {
                        const match = line.match(/score cp (-?\d+)/);

                        if (match && match[1]) {
                            stockfish.postMessage("stop");

                            const score = parseInt(match[1], 10) / 100;
                            resolve(score)
                        }
                    }

                    else if (typeof line == "string" && line.includes("score mate")) {
                        const match = line.match(/score mate (-?\d+)/);

                        if (match && match[1]) {
                            stockfish.postMessage("stop");

                            const score = parseInt(match[1], 10) * 100;
                            resolve(score);
                        }
                    };
                };
            });
        };

        analyzeGame(moveHistory);
    }
    catch (error) {
        console.error(error);
    };
};