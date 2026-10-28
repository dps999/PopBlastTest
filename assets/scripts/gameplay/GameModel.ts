import type { IGameState, IGameModel } from "./GameContracts";

export class GameModel implements IGameModel, IGameState {
    private movesLeft: number;
    private score: number = 0;
    private readonly pointsPerTile: number;
    private readonly targetScore: number;

    constructor(initialMoves: number = 20, pointsPerTile: number = 10, targetScore: number = 500) {
        if (!Number.isInteger(initialMoves) || initialMoves < 1) {
            throw new Error("Initial moves must be a positive integer.");
        }
        if (!Number.isInteger(pointsPerTile) || pointsPerTile < 1) {
            throw new Error("Points per tile must be a positive integer.");
        }
        if (!Number.isInteger(targetScore) || targetScore < 1) {
            throw new Error("Target score must be a positive integer.");
        }
        this.movesLeft = initialMoves;
        this.pointsPerTile = pointsPerTile;
        this.targetScore = targetScore;
    }

    /** Вызывается один раз для уже принятого полем действия, до ожидания анимаций. */
    public applyTurn(removedCount: number, spendsMove: boolean): void {
        if (this.isWon() || this.isLost()) {
            return;
        }
        if (!Number.isInteger(removedCount) || removedCount < 0) {
            throw new Error("Removed tile count must be a non-negative integer.");
        }
        this.score += removedCount * this.pointsPerTile;
        if (spendsMove) {
            this.movesLeft--;
        }
    }

    public isWon(): boolean {
        return this.score >= this.targetScore;
    }

    public isLost(): boolean {
        return this.movesLeft === 0 && !this.isWon();
    }

    public getMovesLeft(): number {
        return this.movesLeft;
    }

    public getScore(): number {
        return this.score;
    }

    public getTargetScore(): number {
        return this.targetScore;
    }

    public getState(): IGameState {
        return this;
    }
}
