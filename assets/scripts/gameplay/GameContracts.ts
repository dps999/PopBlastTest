export interface IGameState {
    getMovesLeft(): number;
    getScore(): number;
}

export interface IGameModel {
    spendMove(): void;
    addScore(points: number): void;
    getState(): IGameState;
}

export interface IGameView {
    render(state: IGameState): void;
}

export interface IScoreCalculator {
    calculate(removedCount: number): number;
}

/** Получает только данные завершённого действия, без буферов поля. */
export interface IGameTurnListener {
    onTurnResolved(removedCount: number): void;
}
