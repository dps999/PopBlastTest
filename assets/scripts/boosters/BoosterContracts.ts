import type { TurnResult } from "../board/IBoardEngine";

/** Стратегии не зависят от компонентов Cocos, спавна и отображения. */
export interface IBoosterBoardActions {
    processRemoval(indices: number[], count: number): TurnResult;
    processSwap(first: number, second: number): TurnResult;
}

export interface IBoosterEffectStrategy {
    readonly targetCount: number;
    canSelect(index: number, cells: number[], selected: number[], selectedCount: number): boolean;
    execute(selected: number[], board: IBoosterBoardActions): TurnResult;
}

export interface BoosterDefinition {
    readonly effect: IBoosterEffectStrategy;
    readonly initialCount: number;
}

export interface IBoosterSelectionView {
    setSelectedCell(index: number): void;
}

export interface IBoostersView {
    renderButton(index: number, count: number, active: boolean, enabled: boolean): void;
}

export interface IBoosterButtonListener {
    selectBooster(index: number): void;
}

export interface IBoosterInputController {
    init(): void;
    isActive(): boolean;
    processCell(index: number): TurnResult | null;
}
