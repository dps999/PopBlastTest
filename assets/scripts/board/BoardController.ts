import {IBoardView} from "./IBoardView";
import {IBoardModel} from "./IBoardModel";

export class BoardController {
    private readonly model: IBoardModel;
    private readonly view: IBoardView;

    constructor(model: IBoardModel, view: IBoardView) {
        this.model = model;
        this.view = view;
    }

    public init(): void {
        this.model.init();
        this.view.initRender(this.model.getCells());
    }
}
