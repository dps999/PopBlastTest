export interface TurnResult {
    valid: boolean;
    steps: unknown[];
}

export interface IBoardEngine {
    processClick(index: number): TurnResult;
}
