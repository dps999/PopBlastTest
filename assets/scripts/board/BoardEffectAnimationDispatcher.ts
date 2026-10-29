import { BoardEffectType } from "../core/BoardEffectType";

export interface IBoardEffectAnimationContext {
    playBombEffect(index: number): boolean;
    playRocketEffect(index: number, effectType: BoardEffectType): boolean;
}

interface IBoardEffectAnimationStrategy {
    readonly effectType: BoardEffectType;
    play(index: number, context: IBoardEffectAnimationContext): boolean;
}

class BombEffectAnimationStrategy implements IBoardEffectAnimationStrategy {
    public readonly effectType: BoardEffectType = BoardEffectType.Bomb;

    public play(index: number, context: IBoardEffectAnimationContext): boolean {
        return context.playBombEffect(index);
    }
}

class RocketEffectAnimationStrategy implements IBoardEffectAnimationStrategy {
    public readonly effectType: BoardEffectType;

    public constructor(effectType: BoardEffectType) {
        this.effectType = effectType;
    }

    public play(index: number, context: IBoardEffectAnimationContext): boolean {
        return context.playRocketEffect(index, this.effectType);
    }
}

/** Маршрутизирует общий список визуальных эффектов к соответствующим стратегиям. */
export class BoardEffectAnimationDispatcher {
    private readonly strategies: IBoardEffectAnimationStrategy[];

    public constructor() {
        this.strategies = [
            new BombEffectAnimationStrategy(),
            new RocketEffectAnimationStrategy(BoardEffectType.HorizontalRocket),
            new RocketEffectAnimationStrategy(BoardEffectType.VerticalRocket)
        ];
    }

    public play(indices: number[], effectTypes: BoardEffectType[], count: number,
        context: IBoardEffectAnimationContext): boolean {
        let started = false;
        for (let i = 0; i < count; i++) {
            const effectType = effectTypes[i];
            let matched = false;
            for (let j = 0; j < this.strategies.length; j++) {
                const strategy = this.strategies[j];
                if (strategy.effectType !== effectType) {
                    continue;
                }
                matched = true;
                if (strategy.play(indices[i], context)) {
                    started = true;
                }
                break;
            }
            if (!matched) {
                throw new Error("No board effect animation strategy is registered.");
            }
        }
        return started;
    }
}

interface RocketEffectState {
    root: cc.Node;
    firstRocket: cc.Node;
    secondRocket: cc.Node;
    startX: number;
    startY: number;
    firstTargetX: number;
    firstTargetY: number;
    secondTargetX: number;
    secondTargetY: number;
    elapsed: number;
    duration: number;
}

/** Пул пар спрайтов, которые разлетаются по линии перед её очисткой. */
export class RocketEffectPool {
    private readonly states: RocketEffectState[];
    private readonly available: RocketEffectState[];
    private readonly active: RocketEffectState[];
    private availableCount: number = 0;
    private activeCount: number = 0;
    private readonly splitOffset: number;
    private readonly spriteWidth: number;
    private readonly spriteHeight: number;

    public constructor(prefab: cc.Prefab, parent: cc.Node, capacity: number, tileSize: cc.Size, zIndex: number) {
        if (!prefab || !parent || !Number.isInteger(capacity) || capacity < 1) {
            throw new Error("Rocket effect pool requires a prefab, parent and positive capacity.");
        }
        this.states = new Array<RocketEffectState>(capacity);
        this.available = new Array<RocketEffectState>(capacity);
        this.active = new Array<RocketEffectState>(capacity);
        this.splitOffset = Math.min(tileSize.width, tileSize.height) * 0.08;

        const firstRocket = prefab.data.getChildByName("RocketA");
        const secondRocket = prefab.data.getChildByName("RocketB");
        const firstSprite = firstRocket ? firstRocket.getComponent(cc.Sprite) : null;
        const secondSprite = secondRocket ? secondRocket.getComponent(cc.Sprite) : null;
        if (!firstSprite || !secondSprite || !firstSprite.spriteFrame || !secondSprite.spriteFrame) {
            throw new Error("Rocket effect prefab requires RocketA and RocketB Sprite children.");
        }
        const visualConfig = prefab.data.getComponent("RocketFlightConfig") as { scaleMultiplier: number };
        if (!visualConfig || !Number.isFinite(visualConfig.scaleMultiplier) || visualConfig.scaleMultiplier <= 0) {
            throw new Error("Rocket effect prefab requires a positive scale multiplier.");
        }
        const spriteSize = firstSprite.spriteFrame.getOriginalSize();
        this.spriteWidth = spriteSize.width;
        this.spriteHeight = spriteSize.height;

        const scale = Math.min(tileSize.width * 0.38 / this.spriteWidth,
            tileSize.height * 0.62 / this.spriteHeight) * visualConfig.scaleMultiplier;
        for (let i = 0; i < capacity; i++) {
            const root = cc.instantiate(prefab);
            const rocketA = root.getChildByName("RocketA");
            const rocketB = root.getChildByName("RocketB");
            const spriteA = rocketA ? rocketA.getComponent(cc.Sprite) : null;
            const spriteB = rocketB ? rocketB.getComponent(cc.Sprite) : null;
            if (!spriteA || !spriteB || !spriteA.spriteFrame || !spriteB.spriteFrame) {
                root.destroy();
                throw new Error("Rocket effect prefab requires RocketA and RocketB Sprite children.");
            }
            spriteA.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            spriteB.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            rocketA.setContentSize(this.spriteWidth, this.spriteHeight);
            rocketB.setContentSize(this.spriteWidth, this.spriteHeight);
            root.parent = parent;
            root.zIndex = zIndex;
            root.active = false;
            rocketA.setScale(scale);
            rocketB.setScale(scale);
            const state: RocketEffectState = {
                root,
                firstRocket: rocketA,
                secondRocket: rocketB,
                startX: 0,
                startY: 0,
                firstTargetX: 0,
                firstTargetY: 0,
                secondTargetX: 0,
                secondTargetY: 0,
                elapsed: 0,
                duration: 0
            };
            this.states[i] = state;
            this.available[this.availableCount++] = state;
        }
    }

    public get isPlaying(): boolean {
        return this.activeCount > 0;
    }

    public play(startX: number, startY: number,
        firstTargetX: number, firstTargetY: number,
        secondTargetX: number, secondTargetY: number,
        horizontal: boolean): boolean {
        if (this.availableCount === 0) {
            return false;
        }
        const state = this.available[--this.availableCount];
        this.available[this.availableCount] = null;
        const firstDistance = Math.sqrt((firstTargetX - startX) * (firstTargetX - startX)
            + (firstTargetY - startY) * (firstTargetY - startY));
        const secondDistance = Math.sqrt((secondTargetX - startX) * (secondTargetX - startX)
            + (secondTargetY - startY) * (secondTargetY - startY));

        state.startX = startX;
        state.startY = startY;
        state.firstTargetX = firstTargetX;
        state.firstTargetY = firstTargetY;
        state.secondTargetX = secondTargetX;
        state.secondTargetY = secondTargetY;
        state.elapsed = 0;
        state.duration = Math.max(0.22, Math.max(firstDistance, secondDistance) / 1250);
        state.root.setPosition(0, 0);
        if (horizontal) {
            state.firstRocket.setPosition(startX, startY + this.splitOffset);
            state.secondRocket.setPosition(startX, startY - this.splitOffset);
            state.firstRocket.angle = -90;
            state.secondRocket.angle = 90;
        } else {
            state.firstRocket.setPosition(startX + this.splitOffset, startY);
            state.secondRocket.setPosition(startX - this.splitOffset, startY);
            state.firstRocket.angle = 180;
            state.secondRocket.angle = 0;
        }
        state.root.active = true;
        this.active[this.activeCount++] = state;
        return true;
    }

    public update(deltaTime: number): void {
        for (let i = 0; i < this.activeCount;) {
            const state = this.active[i];
            const elapsed = state.elapsed + deltaTime;
            const progress = Math.min(1, elapsed / state.duration);
            const easedProgress = progress * progress * (3 - 2 * progress);
            state.elapsed = elapsed;
            state.firstRocket.x = state.startX
                + (state.firstTargetX - state.startX) * easedProgress;
            state.firstRocket.y = state.startY
                + (state.firstTargetY - state.startY) * easedProgress;
            state.secondRocket.x = state.startX
                + (state.secondTargetX - state.startX) * easedProgress;
            state.secondRocket.y = state.startY
                + (state.secondTargetY - state.startY) * easedProgress;
            if (progress < 1) {
                i++;
                continue;
            }

            state.firstRocket.setPosition(state.firstTargetX, state.firstTargetY);
            state.secondRocket.setPosition(state.secondTargetX, state.secondTargetY);
            state.root.active = false;
            const last = --this.activeCount;
            this.active[i] = this.active[last];
            this.active[last] = null;
            this.available[this.availableCount++] = state;
        }
    }

    public setParent(parent: cc.Node, zIndex: number): void {
        for (let i = 0; i < this.states.length; i++) {
            const root = this.states[i].root;
            if (root.parent !== parent) {
                root.parent = parent;
            }
            root.zIndex = zIndex;
        }
    }

    public dispose(): void {
        for (let i = 0; i < this.states.length; i++) {
            const state = this.states[i];
            if (state && cc.isValid(state.root, true)) {
                state.root.destroy();
            }
            this.states[i] = null;
            this.available[i] = null;
            this.active[i] = null;
        }
        this.availableCount = 0;
        this.activeCount = 0;
    }
}
