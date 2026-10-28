export interface IGameState {
    getMovesLeft(): number;
    getScore(): number;
    getTargetScore(): number;
}

export interface IGameModel {
    applyTurn(removedCount: number, spendsMove: boolean): void;
    isWon(): boolean;
    isLost(): boolean;
    getState(): IGameState;
}

export interface IGameView {
    render(state: IGameState): void;
    showResult(won: boolean, state: IGameState): void;
}
