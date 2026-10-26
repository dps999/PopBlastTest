import {GameState, IGameModel} from "./GamePresenter";

export class GameModel implements IGameModel {
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

    public getState(): GameState {
        return {
            getMovesLeft: () => this.movesLeft,
            getScore: () => this.score
        };
    }
}