import type { ISpawnService } from "./ISpawnService";

export class SpawnService implements ISpawnService {
    private readonly colorCount: number;

    constructor(colorCount: number) {
        this.colorCount = colorCount;
    }

    public spawn(cells: number[]): void {
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === -1) {
                cells[i] = cc.math.randomRangeInt(0, this.colorCount);
            }
        }
    }
}
