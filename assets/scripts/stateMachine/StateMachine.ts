import type { IState } from "./IState";

/** Работает с готовыми экземплярами состояний и переиспользует их при переходах. */
export class StateMachine {
    private currentState: IState | null = null;
    private pendingState: IState | null | undefined = undefined;
    private transitioning: boolean = false;

    public getCurrentState(): IState | null {
        return this.currentState;
    }

    /**
     * null завершает текущее состояние.
     * Запрос из enter/exit выполняется после текущего перехода;
     * при нескольких таких запросах сохраняется последний.
     */
    public changeState(state: IState | null): void {
        this.pendingState = state;
        if (this.transitioning) {
            return;
        }

        this.transitioning = true;
        try {
            while (this.pendingState !== undefined) {
                const nextState = this.pendingState;
                this.pendingState = undefined;
                if (this.currentState === nextState) {
                    continue;
                }

                const previousState = this.currentState;
                this.currentState = null;
                if (previousState) {
                    previousState.exit();
                }

                this.currentState = nextState;
                if (nextState) {
                    nextState.enter();
                }
            }
        } finally {
            this.pendingState = undefined;
            this.transitioning = false;
        }
    }
}
