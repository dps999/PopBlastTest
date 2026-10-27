export interface CellMove {
    from: number;
    to: number;
}

export interface TurnResult {
    valid: boolean;
    /** Фиксированный массив; читать первые matchCount записей до следующего processClick. */
    removedIndices: number[];
    matchCount: number;
    /** Фиксированный массив; читать первые moveCount записей до следующего processClick. */
    moves: CellMove[];
    moveCount: number;
}

export interface IBoardEngine {
    processClick(index: number): TurnResult;
}
