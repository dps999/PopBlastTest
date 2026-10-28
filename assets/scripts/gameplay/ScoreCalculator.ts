import type { IScoreCalculator } from "./GameContracts";

/** Начисляет очки только за фактически удалённые клетки. */
export class ScoreCalculator implements IScoreCalculator {
    private readonly pointsPerTile: number;

    constructor(pointsPerTile: number) {
        if (!Number.isInteger(pointsPerTile) || pointsPerTile < 1) {
            throw new Error("Points per tile must be a positive integer.");
        }
        this.pointsPerTile = pointsPerTile;
    }

    public calculate(removedCount: number): number {
        return removedCount * this.pointsPerTile;
    }
}
