import { GameEventType } from "../events/GameEvents";
import { StateMachine } from "../stateMachine/StateMachine";
import { GamePhase } from "./GameStateContracts";
import type { IGamePhaseState, IGameStateObserver } from "./GameStateContracts";
import { LostState, PlayingState, PreparingState, ResolvingState, WonState } from "./GameStates";

/** Обрабатывает события игрового цикла прямыми вызовами, без диспетчера подписок. */
export class GameSession {
    private readonly machine: StateMachine<IGamePhaseState> = new StateMachine<IGamePhaseState>();
    private readonly states: { readonly [T in GamePhase]: IGamePhaseState };
    private readonly observer: IGameStateObserver | null;
    private paused: boolean = false;

    constructor(observer: IGameStateObserver | null = null) {
        this.observer = observer;
        this.states = {
            preparing: new PreparingState(observer),
            playing: new PlayingState(observer),
            resolving: new ResolvingState(observer),
            won: new WonState(observer),
            lost: new LostState(observer)
        };
    }

    /** Первый запуск или повтор после завершённого уровня. */
    public start(): boolean {
        const phase = this.getPhase();
        if (phase !== null && phase !== GamePhase.Won && phase !== GamePhase.Lost) {
            return false;
        }
        this.setPaused(false);
        this.machine.changeState(this.states.preparing);
        return true;
    }

    public stop(): void {
        this.machine.changeState(null);
        this.setPaused(false);
    }

    public getPhase(): GamePhase | null {
        const state = this.machine.getCurrentState();
        return state ? state.phase : null;
    }

    public isPaused(): boolean {
        return this.paused;
    }

    public canAcceptInput(): boolean {
        return !this.paused && this.getPhase() === GamePhase.Playing;
    }

    /** Возвращает false для события, недопустимого в текущей фазе. */
    public handleEvent(event: GameEventType): boolean {
        const state = this.machine.getCurrentState();
        if (!state) {
            return false;
        }

        if (event === GameEventType.Paused) {
            if (this.paused || state.phase !== GamePhase.Playing && state.phase !== GamePhase.Resolving) {
                return false;
            }
            this.setPaused(true);
            return true;
        }
        if (event === GameEventType.Resumed) {
            if (!this.paused) {
                return false;
            }
            this.setPaused(false);
            return true;
        }
        if (this.paused && event === GameEventType.TurnStarted) {
            return false;
        }

        const nextPhase = state.handleEvent(event);
        if (nextPhase === undefined) {
            return false;
        }
        this.machine.changeState(this.states[nextPhase]);
        if (nextPhase === GamePhase.Won || nextPhase === GamePhase.Lost) {
            this.setPaused(false);
        }
        return true;
    }

    private setPaused(paused: boolean): void {
        if (this.paused === paused) {
            return;
        }
        this.paused = paused;
        if (this.observer) {
            this.observer.onPauseChanged(paused);
        }
    }
}
