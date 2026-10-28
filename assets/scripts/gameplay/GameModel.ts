import type { IGameState, IGameModel } from "./GameContracts";

export class GameModel implements IGameModel, IGameState {
    private movesLeft: number;
    private score: number;
    private readonly pointsPerTile: number;

    constructor(initialMoves: number = 0, pointsPerTile: number = 10) {
        if (!Number.isInteger(pointsPerTile) || pointsPerTile < 1) {
            throw new Error("Points per tile must be a positive integer.");
        }
        this.movesLeft = initialMoves;
        this.score = 0;
        this.pointsPerTile = pointsPerTile;
    }

    public spendMove(): void {
        if (this.movesLeft > 0) {
            this.movesLeft--;
        }
    }

    /** Начисляет очки за удалённые клетки и возвращает размер награды. */
    public addScoreForRemovedTiles(count: number): number {
        if (count <= 0) {
            return 0;
        }
        const points = count * this.pointsPerTile;
        this.score += points;
        return points;
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
