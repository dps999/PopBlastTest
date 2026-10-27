export interface RemoveStep {
    type: "remove";
    indices: number[];
}

export interface TurnResult {
    valid: boolean;
    steps: RemoveStep[];
}

export interface IBoardEngine {
    processClick(index: number): TurnResult;
}
