import type {GameState, IGameModel, IGameState} from "./GamePresenter";

export class GameModel implements IGameModel, IGameState {
    private movesLeft: number;
    private score: number;

    constructor(initialMoves: number) {
        this.movesLeft = initialMoves;
        this.score = 0;
    }

    public spendMove(): void {
        if (this.movesLeft > 0) {
            this.movesLeft--;
        }
    }
    
    public addScore(points: number): void {
        this.score += points;
    }

    public getMovesLeft(): number {
        return this.movesLeft;
    }

    public getScore(): number {
        return this.score;
    }

    public getState(): GameState {
        return this;
    }
}
