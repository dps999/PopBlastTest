export interface CellMove {
    from: number;
    to: number;
}

/** Результат и его буферы переиспользуются; потреблять до следующего processClick. */
export interface TurnResult {
    valid: boolean;
    /** Фиксированный массив; читать первые removedCount записей до следующего processClick. */
    removedIndices: number[];
    matchCount: number;
    /** Количество реально удалённых клеток; matchCount — размер обычной группы. */
    removedCount: number;
    /** Индекс до гравитации, -1 при отсутствии преобразования. */
    transformedIndex: number;
    transformedKind: number;
    /** Фиксированный массив; читать первые moveCount записей до следующего processClick. */
    moves: CellMove[];
    moveCount: number;
}

export interface IBoardEngine {
    processClick(index: number): TurnResult;
}
