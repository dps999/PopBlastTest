import type { BoosterDefinition } from "./BoosterContracts";

export class BoosterModel {
    private readonly initialCounts: number[];
    private readonly counts: number[];

    constructor(definitions: BoosterDefinition[]) {
        this.initialCounts = new Array<number>(definitions.length).fill(0);
        this.counts = new Array<number>(definitions.length).fill(0);
        for (let i = 0; i < definitions.length; i++) {
            const count = definitions[i].initialCount;
            if (!Number.isInteger(count) || count < 0) {
                throw new Error("Booster stock must be a non-negative integer.");
            }
            this.initialCounts[i] = count;
        }
        this.reset();
    }

    public reset(): void {
        for (let i = 0; i < this.counts.length; i++) {
            this.counts[i] = this.initialCounts[i];
        }
    }

    public getCount(index: number): number {
        return this.counts[index];
    }

    public spend(index: number): void {
        if (this.counts[index] > 0) {
            this.counts[index]--;
        }
    }
}
