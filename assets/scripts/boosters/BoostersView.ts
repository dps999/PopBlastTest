import BoosterButton from "./BoosterButton";
import type { BoosterController } from "./BoosterController";
import type { BoosterDefinition, IBoostersView } from "./BoosterContracts";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoostersView extends cc.Component implements IBoostersView {
    @property(cc.Prefab)
    private buttonPrefab: cc.Prefab = null;

    @property([BoosterButton])
    private initialButtons: BoosterButton[] = [];

    private buttons: BoosterButton[] = [];

    private controller: BoosterController = null;

    public init(controller: BoosterController, definitions: BoosterDefinition[]): void {
        const buttonsParent = this.node;
        this.controller = controller;
        this.buttons = new Array<BoosterButton>(definitions.length);
        const layout = buttonsParent.getComponent(cc.Layout);
        for (let i = 0; i < definitions.length; i++) {
            let buttonNode: cc.Node;
            if (i < this.initialButtons.length && this.initialButtons[i]) {
                buttonNode = this.initialButtons[i].node;
            } else if (i < buttonsParent.childrenCount) {
                buttonNode = buttonsParent.children[i];
            } else {
                if (!this.buttonPrefab) {
                    throw new Error("BoostersView requires the common button prefab to display all registered boosters.");
                }
                buttonNode = cc.instantiate(this.buttonPrefab);
                buttonNode.parent = buttonsParent;
            }
            const button = buttonNode.getComponent(BoosterButton);
            if (!button) {
                throw new Error("Booster button prefab requires a BoosterButton component.");
            }
            button.init(controller, i, definitions[i].icon);
            this.buttons[i] = button;
        }
        if (layout) {
            layout.updateLayout();
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
