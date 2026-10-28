export const TileKind = { Normal: 0, Row: 1, Column: 2, Radius: 3, Board: 4 } as const;
export type TileKind = number;

export interface SuperTileRule {
    kind: TileKind;
    minimumGroupSize: number;
}

export interface EffectContext {
    columns: number;
    capacity: number;
}

export interface ISuperTileEffectStrategy {
    collectTargets(originIndex: number, context: EffectContext, targets: number[]): number;
}

export interface ISuperTileCreationStrategy {
    selectKind(groupSize: number): TileKind;
}

export class ThresholdCreationStrategy implements ISuperTileCreationStrategy {
    private readonly kinds: number[];
    private readonly thresholds: number[];

    constructor(rules: SuperTileRule[]) {
        this.kinds = new Array<number>(rules.length);
        this.thresholds = new Array<number>(rules.length);
        let previous = 2;
        const kinds: boolean[] = [];
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (!Number.isInteger(rule.kind) || rule.kind <= 0 || kinds[rule.kind]
                || !Number.isInteger(rule.minimumGroupSize) || rule.minimumGroupSize < previous) {
                throw new Error("Super tile rules require unique positive kinds and nondecreasing integer thresholds >= 2.");
            }
            kinds[rule.kind] = true;
            this.kinds[i] = rule.kind;
            this.thresholds[i] = rule.minimumGroupSize;
            previous = rule.minimumGroupSize;
        }
    }

    /** При равных порогах приоритет у последнего правила в конфиге. */
    public selectKind(groupSize: number): TileKind {
        for (let i = this.kinds.length - 1; i >= 0; i--) {
            if (groupSize >= this.thresholds[i]) {
                return this.kinds[i];
            }
        }
        return TileKind.Normal;
    }
}

export class RowEffectStrategy implements ISuperTileEffectStrategy {
    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        const start = originIndex - originIndex % context.columns;
        for (let i = 0; i < context.columns; i++) {
            targets[i] = start + i;
        }
        return context.columns;
    }
}

export class ColumnEffectStrategy implements ISuperTileEffectStrategy {
    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        let count = 0;
        for (let i = originIndex % context.columns; i < context.capacity; i += context.columns) {
            targets[count++] = i;
        }
        return count;
    }
}

export class RadiusEffectStrategy implements ISuperTileEffectStrategy {
    private readonly radius: number;

    constructor(radius: number) {
        if (!Number.isInteger(radius) || radius < 1) {
            throw new Error("Super tile radius must be a positive integer.");
        }
        this.radius = radius;
    }

    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        const column = originIndex % context.columns;
        const row = Math.floor(originIndex / context.columns);
        const firstRow = Math.max(0, row - this.radius);
        const lastRow = Math.min(context.capacity / context.columns - 1, row + this.radius);
        const firstColumn = Math.max(0, column - this.radius);
        const lastColumn = Math.min(context.columns - 1, column + this.radius);
        let count = 0;
        for (let y = firstRow; y <= lastRow; y++) {
            for (let x = firstColumn; x <= lastColumn; x++) {
                targets[count++] = y * context.columns + x;
            }
        }
        return count;
    }
}

export class BoardEffectStrategy implements ISuperTileEffectStrategy {
    public collectTargets(_originIndex: number, context: EffectContext, targets: number[]): number {
        for (let i = 0; i < context.capacity; i++) {
            targets[i] = i;
        }
        return context.capacity;
    }
}
