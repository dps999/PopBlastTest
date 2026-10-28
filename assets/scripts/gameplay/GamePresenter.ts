import type { IGameModel, IGameTurnListener, IGameView } from "./GameContracts";

export class GamePresenter implements IGameTurnListener {
    private readonly model: IGameModel;
    private readonly view: IGameView;

    constructor(model: IGameModel, view: IGameView) {
        this.model = model;
        this.view = view;
    }

    public start(): void {
        this.view.render(this.model.getState());
    }

    public onTurnResolved(removedCount: number): void {
        const points = this.model.addScoreForRemovedTiles(removedCount);
        if (points <= 0) {
            return;
        }
        this.view.render(this.model.getState());
    }
}
