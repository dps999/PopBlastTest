export interface IGameState {
    getMovesLeft(): number;
    getScore(): number;
}

export interface IGameModel {
    spendMove(): void;
    addScoreForRemovedTiles(count: number): number;
    getState(): IGameState;
}

export interface IGameView {
    render(state: IGameState): void;
}

/** Получает только данные завершённого действия, без буферов поля. */
export interface IGameTurnListener {
    onTurnResolved(removedCount: number): void;
}
