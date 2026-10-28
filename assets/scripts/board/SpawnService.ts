import type { ISpawnService } from "./ISpawnService";

export class SpawnService implements ISpawnService {
    private readonly colorCount: number;

    constructor(colorCount: number) {
        this.colorCount = colorCount;
    }

    public spawn(cells: number[], spawnedIndices?: number[], kinds?: number[]): number {
        let count = 0;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === -1) {
                cells[i] = cc.math.randomRangeInt(0, this.colorCount);
                if (kinds) {
                    kinds[i] = 0;
                }
                if (spawnedIndices) {
                    spawnedIndices[count] = i;
                }
                count++;
            }
        }
        return count;
    }
}
