import type { IGameModel, IGameTurnListener, IGameView, IScoreCalculator } from "./GameContracts";

export class GamePresenter implements IGameTurnListener {
    private readonly model: IGameModel;
    private readonly view: IGameView;
    private readonly scoreCalculator: IScoreCalculator;

    constructor(model: IGameModel, view: IGameView, scoreCalculator: IScoreCalculator) {
        this.model = model;
        this.view = view;
        this.scoreCalculator = scoreCalculator;
    }

    public start(): void {
        this.view.render(this.model.getState());
    }

    public onTurnResolved(removedCount: number): void {
        const points = this.scoreCalculator.calculate(removedCount);
        if (points <= 0) {
            return;
        }
        this.model.addScore(points);
        this.view.render(this.model.getState());
    }
}
