import type { IGameState, IGameModel } from "./GameContracts";

export class GameModel implements IGameModel, IGameState {
    private movesLeft: number;
    private score: number;

    constructor(initialMoves: number = 0) {
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

    public getState(): IGameState {
        return this;
    }
}
