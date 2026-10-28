import BoosterButton from "./BoosterButton";
import type { BoosterController } from "./BoosterController";
import type { IBoostersView } from "./BoosterContracts";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoostersView extends cc.Component implements IBoostersView {
    /** Порядок соответствует определениям BoosterFactory: бомба, телепорт. */
    @property([BoosterButton])
    private buttons: BoosterButton[] = [];

    private controller: BoosterController = null;

    public init(controller: BoosterController, count: number): void {
        if (this.buttons.length !== count) {
            throw new Error("Booster buttons must match the registered definitions.");
        }
        this.controller = controller;
        for (let i = 0; i < count; i++) {
            if (!this.buttons[i]) {
                throw new Error("Missing booster button.");
            }
            this.buttons[i].init(controller, i);
        }
    }

    public renderButton(index: number, count: number, active: boolean, enabled: boolean): void {
        this.buttons[index].render(count, active, enabled);
    }

    protected onDestroy(): void {
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }
    }
}
