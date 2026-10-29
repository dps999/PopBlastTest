import type { IBoardView } from "./IBoardView";
import type { IBoardModel } from "./IBoardModel";
import type { IBoardController } from "./IBoardController";
import type { IBoardEngine, TurnResult } from "./IBoardEngine";
import type { ISpawnService } from "./ISpawnService";

export class BoardController implements IBoardController {
    private readonly model: IBoardModel;
    private readonly view: IBoardView;
    private readonly engine: IBoardEngine;
    private readonly spawnService: ISpawnService;
    private spawnedIndices: number[] = [];

    constructor(model: IBoardModel, view: IBoardView, engine: IBoardEngine, spawnService: ISpawnService) {
        this.model = model;
        this.view = view;
        this.engine = engine;
        this.spawnService = spawnService;
    }

    public init(): void {
        this.model.init();
        const cells = this.model.getCells();
        this.spawnedIndices = new Array<number>(cells.length).fill(0);
        this.spawnService.spawn(cells);
        this.view.initRender(cells);
    }

    public processClick(index: number): TurnResult {
        return this.engine.processClick(index);
    }

    public async shuffleUntilMove(maxShuffles: number): Promise<boolean | null> {
        if (this.engine.hasAvailableMove()) {
            return true;
        }
        if (!Number.isInteger(maxShuffles) || maxShuffles < 1) {
            return false;
        }

        this.view.setInputLocked(true);
        try {
            for (let attempt = 0; attempt < maxShuffles; attempt++) {
                const shuffle = this.engine.shuffle();
                this.view.shuffleTiles(shuffle.moves, shuffle.moveCount);
                if (!await this.view.waitForAnimations()) {
                    return null;
                }
                if (this.engine.hasAvailableMove()) {
                    return true;
                }
            }
            return false;
        } finally {
            this.view.setInputLocked(false);
        }
    }

    public async applyTurnResult(result: TurnResult | null): Promise<boolean> {
        if (!result || !result.valid) {
            return false;
        }

        this.view.setInputLocked(true);
        try {
            if (result.swappedFirstIndex >= 0) {
                this.view.swapTiles(result.swappedFirstIndex, result.swappedSecondIndex);
                return await this.view.waitForAnimations();
            }

            if (result.effectCount > 0
                && this.view.playEffects(result.effectIndices, result.effectTypes, result.effectCount)
                && !await this.view.waitForAnimations()) {
                return false;
            }

            const isMerge = result.transformedIndex >= 0;
            if (isMerge) {
                this.view.mergeTiles(result.removedIndices, result.removedCount, result.transformedIndex);
                this.view.transformTile(result.transformedIndex, result.transformedValue);
            } else {
                this.view.removeTiles(result.removedIndices, result.removedCount);
            }
            const removalCompleted = isMerge
                ? await this.view.waitForAnimations()
                : await this.view.waitForRemovals();
            if (!removalCompleted) {
                return false;
            }

            const cells = this.model.getCells();
            const spawnCount = this.spawnService.spawn(cells, this.spawnedIndices);
            this.view.fallTiles(result.moves, result.moveCount, cells, this.spawnedIndices, spawnCount);
            return await this.view.waitForAnimations();
        } finally {
            this.view.setInputLocked(false);
        }
    }
}
