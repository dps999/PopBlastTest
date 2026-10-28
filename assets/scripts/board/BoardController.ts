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

    public applyTurnResult(result: TurnResult | null): void {
        if (!result || !result.valid) {
            return;
        }

        if (result.swappedFirstIndex >= 0) {
            this.view.swapTiles(result.swappedFirstIndex, result.swappedSecondIndex);
            return;
        }

        const cells = this.model.getCells();
        const spawnCount = this.spawnService.spawn(cells, this.spawnedIndices);
        if (result.transformedIndex >= 0) {
            this.view.mergeTiles(result.removedIndices, result.removedCount, result.transformedIndex);
            this.view.transformTile(result.transformedIndex, result.transformedValue);
        } else {
            this.view.removeTiles(result.removedIndices, result.removedCount);
        }
        this.view.fallTiles(result.moves, result.moveCount, cells, this.spawnedIndices, spawnCount);
    }
}
