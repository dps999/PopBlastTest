import type { IBoardView } from "./IBoardView";
import type { IBoardModel } from "./IBoardModel";
import type { IBoardController } from "./IBoardController";
import type { IBoardEngine } from "./IBoardEngine";
import type { ISpawnService } from "./ISpawnService";
import type { IBoosterInputController } from "../boosters/BoosterContracts";

export class BoardController implements IBoardController {
    private readonly model: IBoardModel;
    private readonly view: IBoardView;
    private readonly engine: IBoardEngine;
    private readonly spawnService: ISpawnService;
    private readonly boosters: IBoosterInputController;
    private spawnedIndices: number[] = [];

    constructor(model: IBoardModel, view: IBoardView, engine: IBoardEngine, spawnService: ISpawnService,
        boosters?: IBoosterInputController) {
        this.model = model;
        this.view = view;
        this.engine = engine;
        this.spawnService = spawnService;
        this.boosters = boosters;
    }

    public init(): void {
        this.model.init();
        const cells = this.model.getCells();
        this.spawnedIndices = new Array<number>(cells.length).fill(0);
        this.spawnService.spawn(cells);
        this.view.initRender(cells);
        if (this.boosters) {
            this.boosters.init();
        }
    }

    public onCellClicked(index: number): void {
        const result = this.boosters && this.boosters.isActive()
            ? this.boosters.processCell(index) : this.engine.processClick(index);
        if (!result || !result.valid) {
            return;
        }

        if (result.swappedFirstIndex >= 0) {
            this.view.swapTiles(result.swappedFirstIndex, result.swappedSecondIndex);
            return;
        }

        const cells = this.model.getCells();
        const spawnCount = this.spawnService.spawn(cells, this.spawnedIndices);
        this.view.removeTiles(result.removedIndices, result.removedCount);
        if (result.transformedIndex >= 0) {
            this.view.transformTile(result.transformedIndex, result.transformedValue);
        }
        this.view.fallTiles(result.moves, result.moveCount, cells, this.spawnedIndices, spawnCount);
    }
}
