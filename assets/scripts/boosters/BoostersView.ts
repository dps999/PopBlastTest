import BoosterButton from "./BoosterButton";
import type { BoosterDefinition, IBoosterButtonListener, IBoostersView } from "./BoosterContracts";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoostersView extends cc.Component implements IBoostersView {
    @property(cc.Prefab)
    private buttonPrefab: cc.Prefab = null;

    @property([BoosterButton])
    private initialButtons: BoosterButton[] = [];

    private buttons: BoosterButton[] = [];

    public init(listener: IBoosterButtonListener, definitions: BoosterDefinition[]): void {
        const buttonsParent = this.node;
        this.buttons = new Array<BoosterButton>(definitions.length);
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
            button.init(listener, i, definitions[i].icon);
            this.buttons[i] = button;
        }
    }

    public renderButton(index: number, count: number, active: boolean, enabled: boolean): void {
        this.buttons[index].render(count, active, enabled);
    }
}
