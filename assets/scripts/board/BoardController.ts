import type { IBoardView } from "./IBoardView";
import type { IBoardModel } from "./IBoardModel";
import type { IBoardController } from "./IBoardController";
import type { IBoardEngine } from "./IBoardEngine";
import type { ISpawnService } from "./ISpawnService";

export class BoardController implements IBoardController {
    private readonly model: IBoardModel;
    private readonly view: IBoardView;
    private readonly engine: IBoardEngine;
    private readonly spawnService: ISpawnService;

    constructor(model: IBoardModel, view: IBoardView, engine: IBoardEngine, spawnService: ISpawnService) {
        this.model = model;
        this.view = view;
        this.engine = engine;
        this.spawnService = spawnService;
    }

    public init(): void {
        this.model.init();
        const cells = this.model.getCells();
        this.spawnService.spawn(cells);
        this.view.initRender(cells);
    }

    public onCellClicked(index: number): void {
        const result = this.engine.processClick(index);
        if (!result.valid) {
            return;
        }

        this.view.removeTiles(result.removedIndices, result.matchCount);
        this.view.moveTiles(result.moves, result.moveCount);
    }
}
