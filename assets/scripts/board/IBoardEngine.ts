export interface CellMove {
    from: number;
    to: number;
}

/** Результат и его буферы переиспользуются; потреблять до следующей операции движка. */
export interface TurnResult {
    valid: boolean;
    /** Фиксированный массив; читать первые removedCount записей до следующей операции. */
    removedIndices: number[];
    matchCount: number;
    /** Количество реально удалённых клеток; matchCount — размер обычной группы. */
    removedCount: number;
    /** Индекс до гравитации, -1 при отсутствии преобразования. */
    transformedIndex: number;
    transformedValue: number;
    /** Индексы обмена, -1 при отсутствии обмена. */
    swappedFirstIndex: number;
    swappedSecondIndex: number;
    /** Фиксированный массив; читать первые moveCount записей до следующей операции. */
    moves: CellMove[];
    moveCount: number;
}

export interface IBoardEngine {
    processClick(index: number): TurnResult;
    processRemoval(indices: number[], count: number): TurnResult;
    processSwap(first: number, second: number): TurnResult;
}
