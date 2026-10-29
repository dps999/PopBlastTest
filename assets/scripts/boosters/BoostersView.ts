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
    private quantityLayer: cc.Node = null;

    public init(listener: IBoosterButtonListener, definitions: BoosterDefinition[]): void {
        const buttonsParent = this.node;
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
            button.init(listener, i, definitions[i].icon);
            this.buttons[i] = button;
        }
        if (layout) {
            layout.updateLayout();
        }

        // Отрисовываем количества после всех спрайтов, чтобы подписи кнопок шли одним батчем.
        this.prepareQuantityLayer(buttonsParent);
        for (let i = 0; i < this.buttons.length; i++) {
            this.buttons[i].moveQuantityLabelToLayer(this.quantityLayer);
        }
    }

    public renderButton(index: number, count: number, active: boolean, enabled: boolean): void {
        this.buttons[index].render(count, active, enabled);
    }

    private prepareQuantityLayer(buttonsParent: cc.Node): void {
        if (!this.quantityLayer) {
            this.quantityLayer = new cc.Node("BoosterQuantityLayer");
        }

        this.quantityLayer.parent = buttonsParent.parent;
        this.quantityLayer.setPosition(buttonsParent.x, buttonsParent.y);
        this.quantityLayer.setScale(buttonsParent.scaleX, buttonsParent.scaleY);
    }
}
