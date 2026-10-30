import type { IBoardInputStateListener } from "../board/IBoardController";
import type { TurnResult } from "../board/IBoardEngine";

/** Эффекты используют только операции поля и отделены от рендеринга. */
export interface IBoosterBoardActions {
    processRemoval(indices: number[], count: number): TurnResult;
    processSwap(first: number, second: number): TurnResult;
}

export interface IBoosterEffect {
    readonly targetCount: number;
    validate(): void;
    canSelect(index: number, cells: number[], selected: number[], selectedCount: number): boolean;
    execute(selected: number[], board: IBoosterBoardActions, context: BoosterContext): TurnResult;
}

export interface BoosterContext {
    readonly columns: number;
    readonly capacity: number;
    readonly targets: number[];
}

export interface BoosterDefinition {
    readonly effect: IBoosterEffect;
    readonly initialCount: number;
    readonly icon: cc.SpriteFrame;
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

export interface IBoosterInputController extends IBoardInputStateListener {
    init(): void;
    isActive(): boolean;
    processCell(index: number): TurnResult | null;
}
