import { GameEventType } from "../events/GameEvents";
import { GamePhase } from "./GameStateContracts";
import type { IGamePhaseState, IGameStateObserver } from "./GameStateContracts";

abstract class GamePhaseState implements IGamePhaseState {
    public readonly phase: GamePhase;
    private readonly observer: IGameStateObserver | null;

    constructor(phase: GamePhase, observer: IGameStateObserver | null) {
        this.phase = phase;
        this.observer = observer;
    }

    public enter(): void {
        if (this.observer) {
            this.observer.onStateEntered(this.phase);
        }
    }

    public exit(): void {
        if (this.observer) {
            this.observer.onStateExited(this.phase);
        }
    }

    public handleEvent(_event: GameEventType): GamePhase | undefined {
        return undefined;
    }
}

export class PreparingState extends GamePhaseState {
    constructor(observer: IGameStateObserver | null = null) {
        super(GamePhase.Preparing, observer);
    }

    public handleEvent(event: GameEventType): GamePhase | undefined {
        return event === GameEventType.LevelStarted ? GamePhase.Playing : undefined;
    }
}

export class PlayingState extends GamePhaseState {
    constructor(observer: IGameStateObserver | null = null) {
        super(GamePhase.Playing, observer);
    }

    public handleEvent(event: GameEventType): GamePhase | undefined {
        switch (event) {
            case GameEventType.TurnStarted:
                return GamePhase.Resolving;
            case GameEventType.LevelWon:
                return GamePhase.Won;
            case GameEventType.LevelLost:
                return GamePhase.Lost;
            default:
                return undefined;
        }
    }
}

export class ResolvingState extends GamePhaseState {
    constructor(observer: IGameStateObserver | null = null) {
        super(GamePhase.Resolving, observer);
    }

    public handleEvent(event: GameEventType): GamePhase | undefined {
        switch (event) {
            case GameEventType.TurnResolved:
                return GamePhase.Playing;
            case GameEventType.LevelWon:
                return GamePhase.Won;
            case GameEventType.LevelLost:
                return GamePhase.Lost;
            default:
                return undefined;
        }
    }
}

/** Терминальные состояния принимают новый запуск только через GameSession.start(). */
export class WonState extends GamePhaseState {
    constructor(observer: IGameStateObserver | null = null) {
        super(GamePhase.Won, observer);
    }
}

export class LostState extends GamePhaseState {
    constructor(observer: IGameStateObserver | null = null) {
        super(GamePhase.Lost, observer);
    }
}
