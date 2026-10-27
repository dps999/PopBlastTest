import type { IBoardView } from "./IBoardView";
import type { IBoardModel } from "./IBoardModel";
import type { IBoardController } from "./IBoardController";
import type { IBoardEngine } from "./IBoardEngine";

export class BoardController implements IBoardController {
    private readonly model: IBoardModel;
    private readonly view: IBoardView;
    private readonly engine: IBoardEngine;

    constructor(model: IBoardModel, view: IBoardView, engine: IBoardEngine) {
        this.model = model;
        this.view = view;
        this.engine = engine;
    }

    public init(): void {
        this.model.init();
        this.view.initRender(this.model.getCells());
    }

    public onCellClicked(index: number): void {
        this.engine.processClick(index);
    }
}
