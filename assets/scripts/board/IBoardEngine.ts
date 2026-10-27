export interface CellMove {
    from: number;
    to: number;
}

export interface TurnResult {
    valid: boolean;
    removedIndices: number[];
    moves: CellMove[];
}

export interface IBoardEngine {
    processClick(index: number): TurnResult;
}
