import type { TurnResult } from "../board/IBoardEngine";
import type { IBoardInputStateListener } from "../board/BoardInputService";
import type { IBoardModel } from "../board/IBoardModel";
import type { BoosterModel } from "./BoosterModel";
import type { BoosterDefinition, IBoosterBoardActions, IBoosterButtonListener, IBoosterInputController, IBoosterSelectionView, IBoostersView } from "./BoosterContracts";

export class BoosterController implements IBoosterButtonListener, IBoosterInputController, IBoardInputStateListener {
    private readonly definitions: BoosterDefinition[];
    private readonly stock: BoosterModel;
    private readonly model: IBoardModel;
    private readonly board: IBoosterBoardActions;
    private readonly selectionView: IBoosterSelectionView;
    private readonly view: IBoostersView;
    private readonly selected: number[];
    private selectedCount: number = 0;
    private activeIndex: number = -1;
    private inputEnabled: boolean = true;
    private disposed: boolean = false;

    constructor(definitions: BoosterDefinition[], stock: BoosterModel, model: IBoardModel,
        board: IBoosterBoardActions, selectionView: IBoosterSelectionView, view: IBoostersView) {
        this.definitions = definitions;
        this.stock = stock;
        this.model = model;
        this.board = board;
        this.selectionView = selectionView;
        this.view = view;
        let capacity = 0;
        for (let i = 0; i < definitions.length; i++) {
            const count = definitions[i].effect.targetCount;
            if (!Number.isInteger(count) || count < 1) {
                throw new Error("Booster target count must be a positive integer.");
            }
            capacity = Math.max(capacity, count);
        }
        this.selected = new Array<number>(capacity).fill(-1);
    }

    public init(): void {
        this.stock.reset();
        this.cancel();
        this.render();
    }

    public isActive(): boolean {
        return !this.disposed && this.activeIndex >= 0;
    }

    public selectBooster(index: number): void {
        if (this.disposed || !this.inputEnabled || !Number.isInteger(index)
            || index < 0 || index >= this.definitions.length || this.stock.getCount(index) === 0) {
            return;
        }
        const wasActive = this.activeIndex === index;
        this.cancel();
        if (!wasActive) {
            this.activeIndex = index;
        }
        this.render();
    }

    /** null: цель не принята или ещё нужны цели; обычный клик при этом не выполняется. */
    public processCell(index: number): TurnResult | null {
        if (!this.inputEnabled || !this.isActive()) {
            return null;
        }
        if (this.selectedCount > 0 && this.selected[0] === index) {
            this.clearSelection();
            return null;
        }
        const effect = this.definitions[this.activeIndex].effect;
        const cells = this.model.getCells();
        if (!Number.isInteger(index) || index < 0 || index >= cells.length || cells[index] < 0
            || !effect.canSelect(index, cells, this.selected, this.selectedCount)) {
            return null;
        }
        this.selected[this.selectedCount++] = index;
        if (this.selectedCount < effect.targetCount) {
            this.selectionView.setSelectedCell(this.selected[0]);
            return null;
        }
        const result = effect.execute(this.selected, this.board);
        if (result.valid) {
            this.stock.spend(this.activeIndex);
            this.cancel();
            this.render();
        } else {
            this.clearSelection();
        }
        return result;
    }

    public onInputEnabledChanged(enabled: boolean): void {
        if (this.disposed) {
            return;
        }
        this.inputEnabled = enabled;
        this.render();
    }

    public dispose(): void {
        this.cancel();
        this.disposed = true;
    }

    private cancel(): void {
        this.activeIndex = -1;
        this.clearSelection();
    }

    private clearSelection(): void {
        this.selectedCount = 0;
        this.selected.fill(-1);
        this.selectionView.setSelectedCell(-1);
    }

    private render(): void {
        for (let i = 0; i < this.definitions.length; i++) {
            const count = this.stock.getCount(i);
            this.view.renderButton(i, count, this.activeIndex === i, this.inputEnabled && count > 0);
        }
    }
}
