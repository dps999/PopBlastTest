const { ccclass, requireComponent, disallowMultiple } = cc._decorator;

@ccclass
@requireComponent(cc.Layout)
@disallowMultiple
export default class AutoDisableLayout extends cc.Component {
    protected start(): void {
        const layout: cc.Layout = this.getComponent(cc.Layout);

        layout.enabled = true;
        layout.updateLayout();
        layout.enabled = false;
    }
}
