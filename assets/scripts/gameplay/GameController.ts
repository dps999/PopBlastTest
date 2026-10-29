import type { IBoardController, IBoardInputHandler, IBoardInputStateListener } from "../board/IBoardController";
import type { IBoosterInputController } from "../boosters/BoosterContracts";
import { GameEventType } from "../events/GameEvents";
import type { IGameModel, IGameView } from "./GameContracts";
import type { GameSession } from "./GameSession";
import { GamePhase } from "./GameStateContracts";

/** Координирует действие поля, учёт результата и существующую FSM. */
export class GameController implements IBoardInputHandler, IBoardInputStateListener {
    private readonly maxAutoShuffles: number = 3;
    private readonly board: IBoardController;
    private readonly boosters: IBoosterInputController;
    private readonly model: IGameModel;
    private readonly session: GameSession;
    private readonly view: IGameView;

    constructor(board: IBoardController, boosters: IBoosterInputController,
        model: IGameModel, session: GameSession, view: IGameView) {
        this.board = board;
        this.boosters = boosters;
        this.model = model;
        this.session = session;
        this.view = view;
    }

    public init(): void {
        if (!this.session.start()) {
            return;
        }
        this.board.init();
        this.boosters.init();
        this.view.render(this.model.getState());
        this.session.handleEvent(GameEventType.LevelStarted);
        this.prepareInitialBoard();
    }

    public onInputEnabledChanged(enabled: boolean): void {
        this.boosters.onInputEnabledChanged(enabled && this.session.canAcceptInput());
    }

    private async prepareInitialBoard(): Promise<void> {
        try {
            const hasMove = await this.board.shuffleUntilMove(this.maxAutoShuffles);
            if (this.session.getPhase() !== GamePhase.Playing) {
                return;
            }
            if (hasMove === null) {
                this.session.stop();
                this.onInputEnabledChanged(false);
                return;
            }
            if (!hasMove) {
                this.session.handleEvent(GameEventType.LevelLost);
                this.onInputEnabledChanged(false);
                this.view.showResult(false, this.model.getState());
                return;
            }
            this.onInputEnabledChanged(true);
        } catch (error) {
            this.session.stop();
            this.onInputEnabledChanged(false);
            cc.error(error);
        }
    }

    public async onCellClicked(index: number): Promise<void> {
        if (!this.session.canAcceptInput()) {
            return;
        }
        const usesBooster = this.boosters.isActive();
        try {
            const result = usesBooster ? this.boosters.processCell(index) : this.board.processClick(index);
            if (!result || !result.valid) {
                return;
            }
            this.session.handleEvent(GameEventType.TurnStarted);
            this.onInputEnabledChanged(false);
            // BoardModel уже изменена движком. Отмена визуализации не отменяет действие.
            this.model.applyTurn(result.removedCount, !usesBooster);
            this.view.render(this.model.getState());
            const completed = await this.board.applyTurnResult(result);
            if (this.session.getPhase() !== GamePhase.Resolving) {
                return;
            }
            if (!completed) {
                this.session.stop();
                this.onInputEnabledChanged(false);
                return;
            }
            const won = this.model.isWon();
            let lost = this.model.isLost();
            if (!won && !lost) {
                const hasMove = await this.board.shuffleUntilMove(this.maxAutoShuffles);
                if (this.session.getPhase() !== GamePhase.Resolving) {
                    return;
                }
                if (hasMove === null) {
                    this.session.stop();
                    this.onInputEnabledChanged(false);
                    return;
                }
                lost = !hasMove;
            }
            this.session.handleEvent(won ? GameEventType.LevelWon
                : lost ? GameEventType.LevelLost : GameEventType.TurnResolved);
            this.onInputEnabledChanged(true);
            if (won || lost) {
                this.view.showResult(won, this.model.getState());
            }
        } catch (error) {
            this.session.stop();
            this.onInputEnabledChanged(false);
            throw error;
        }
    }
}
