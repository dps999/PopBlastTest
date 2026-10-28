import type { GameEventType } from "../events/GameEvents";
import type { IState } from "../stateMachine/IState";

export const GamePhase = {
    Preparing: "preparing",
    Playing: "playing",
    Resolving: "resolving",
    Won: "won",
    Lost: "lost"
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

/** Поведение игровой фазы; интерфейс данных IGameState остаётся в GameContracts. */
export interface IGamePhaseState extends IState {
    readonly phase: GamePhase;
    /** undefined означает, что событие недопустимо в этой фазе. */
    handleEvent(event: GameEventType): GamePhase | undefined;
}

/** Прямые уведомления для подключения подготовки, ввода и экранов игры. */
export interface IGameStateObserver {
    onStateEntered(phase: GamePhase): void;
    onStateExited(phase: GamePhase): void;
    onPauseChanged(paused: boolean): void;
}
