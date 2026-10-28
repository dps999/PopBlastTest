import type { TurnResult } from "./IBoardEngine";

export interface IBoardController {
    init(): void;
    processClick(index: number): TurnResult;
    applyTurnResult(result: TurnResult | null): Promise<boolean>;
}

/** Обработчик клика, подключаемый к визуальным клеткам поля. */
export interface IBoardInputHandler {
    onCellClicked(index: number): void | Promise<void>;
}

/** Получатель изменений доступности ввода. */
export interface IBoardInputStateListener {
    onInputEnabledChanged(enabled: boolean): void;
}
