interface ExplosionPoolState {
    available: cc.ParticleSystem[];
    active: cc.ParticleSystem[];
    startDelays: number[];
    availableCount: number;
    activeCount: number;
    startColor: cc.Color;
    endColor: cc.Color;
}

const { ccclass, property, disallowMultiple } = cc._decorator;

@ccclass
@disallowMultiple
export default class BombExplosionPool extends cc.Component {
    @property(cc.Prefab)
    private explosionPrefab: cc.Prefab = null;

    @property({ type: cc.Integer, min: 1 })
    private capacity: number = 16;

    @property({ min: 0, tooltip: "Задержка запуска внешней частицы бомбы, в секундах." })
    private bombOuterDelay: number = 0.8;

    @property(cc.Prefab)
    private tileExplosionPrefab: cc.Prefab = null;

    @property({ type: cc.Integer, min: 1 })
    public tileCapacity: number = 81;

    private bombs: ExplosionPoolState = null;
    private tiles: ExplosionPoolState = null;

    public get isPlaying(): boolean {
        return !!((this.tiles && this.tiles.activeCount > 0) || (this.bombs && this.bombs.activeCount > 0));
    }

    protected onLoad(): void {
        this.bombs = this.warm(this.explosionPrefab, this.capacity, 1);
        this.tiles = this.warm(this.tileExplosionPrefab, this.tileCapacity, 0);
    }

    private warm(prefab: cc.Prefab, capacity: number, zIndex: number): ExplosionPoolState {
        if (!prefab || !Number.isInteger(capacity) || capacity < 1) {
            throw new Error("Explosion pool requires a prefab and positive capacity.");
        }
        const pool: ExplosionPoolState = {
            available: new Array<cc.ParticleSystem>(capacity),
            active: new Array<cc.ParticleSystem>(capacity),
            startDelays: new Array<number>(capacity),
            availableCount: 0,
            activeCount: 0,
            startColor: cc.color(255, 255, 255),
            endColor: cc.color(255, 255, 255, 255)
        };
        for (let i = 0; i < capacity; i++) {
            const node = cc.instantiate(prefab);
            node.active = false;
            node.parent = this.node;
            node.zIndex = zIndex;
            const particles = node.getComponent(cc.ParticleSystem);
            if (!particles) {
                throw new Error("Explosion prefab must contain cc.ParticleSystem.");
            }
            if (i === 0) {
                cc.Color.copy(pool.startColor, particles.startColor);
                cc.Color.copy(pool.endColor, particles.endColor);
            }
            particles.playOnLoad = false;
            particles.autoRemoveOnFinish = false;
            this.configureNestedParticles(node);
            pool.available[pool.availableCount++] = particles;
        }
        return pool;
    }

    /** Координаты относительно узла пула. false — все эффекты заняты. */
    public play(prefab: cc.Prefab, x: number, y: number, color: cc.Color = null): boolean {
        const pool = prefab === this.tileExplosionPrefab ? this.tiles
            : prefab === this.explosionPrefab ? this.bombs : null;
        return this.playFrom(pool, x, y, color);
    }

    public playBomb(x: number, y: number): boolean {
        return this.playFrom(this.bombs, x, y, null);
    }

    private playFrom(pool: ExplosionPoolState, x: number, y: number, color: cc.Color): boolean {
        if (!pool || pool.availableCount === 0) {
            return false;
        }
        const particles = pool.available[--pool.availableCount];
        pool.available[pool.availableCount] = null;
        const startColor = particles.startColor;
        const endColor = particles.endColor;
        cc.Color.copy(startColor, color || pool.startColor);
        cc.Color.copy(endColor, color || pool.endColor);
        startColor.a = pool.startColor.a;
        endColor.a = 255;
        particles.startColor = startColor;
        particles.endColor = endColor;
        particles.node.setPosition(x, y);
        particles.node.active = true;
        this.restartNestedParticles(particles.node);
        const delay = pool === this.bombs ? this.bombOuterDelay : 0;
        const activeIndex = pool.activeCount;
        pool.startDelays[activeIndex] = delay;
        if (delay <= 0) {
            particles.resetSystem();
        }
        pool.active[activeIndex] = particles;
        pool.activeCount = activeIndex + 1;
        return true;
    }

    protected update(dt: number): void {
        this.updatePool(this.tiles, dt);
        this.updatePool(this.bombs, dt);
    }

    private updatePool(pool: ExplosionPoolState, dt: number): void {
        if (!pool) {
            return;
        }
        for (let i = 0; i < pool.activeCount;) {
            const particles = pool.active[i];
            const delay = pool.startDelays[i];
            if (delay > 0) {
                const remainingDelay = delay - dt;
                pool.startDelays[i] = remainingDelay > 0 ? remainingDelay : 0;
                if (remainingDelay <= 0) {
                    particles.resetSystem();
                }
                i++;
                continue;
            }
            if (!particles.stopped || particles.particleCount > 0) {
                i++;
                continue;
            }
            if (this.hasActiveNestedParticles(particles.node)) {
                i++;
                continue;
            }
            particles.node.active = false;
            pool.available[pool.availableCount++] = particles;
            const last = --pool.activeCount;
            if (i !== last) {
                pool.active[i] = pool.active[last];
                pool.startDelays[i] = pool.startDelays[last];
            }
            pool.active[last] = null;
            pool.startDelays[last] = 0;
        }
    }

    private configureNestedParticles(node: cc.Node): void {
        for (let i = 0; i < node.childrenCount; i++) {
            const child = node.children[i];
            const particles = child.getComponent(cc.ParticleSystem);
            if (particles) {
                particles.playOnLoad = false;
                particles.autoRemoveOnFinish = false;
            }
            this.configureNestedParticles(child);
        }
    }

    private restartNestedParticles(node: cc.Node): void {
        for (let i = 0; i < node.childrenCount; i++) {
            const child = node.children[i];
            if (child.active) {
                const particles = child.getComponent(cc.ParticleSystem);
                if (particles) {
                    particles.resetSystem();
                }
                this.restartNestedParticles(child);
            }
        }
    }

    private hasActiveNestedParticles(node: cc.Node): boolean {
        for (let i = 0; i < node.childrenCount; i++) {
            const child = node.children[i];
            if (!child.active) {
                continue;
            }
            const particles = child.getComponent(cc.ParticleSystem);
            if (particles && (!particles.stopped || particles.particleCount > 0)) {
                return true;
            }
            if (this.hasActiveNestedParticles(child)) {
                return true;
            }
        }
        return false;
    }

    protected onDestroy(): void {
        const tiles = this.tiles;
        const bombs = this.bombs;
        this.tiles = null;
        this.bombs = null;
        this.clear(tiles);
        this.clear(bombs);
    }

    private clear(pool: ExplosionPoolState): void {
        if (!pool) {
            return;
        }
        for (let i = 0; i < pool.availableCount; i++) {
            const particles = pool.available[i];
            // При удалении родителя Cocos уничтожает детей раньше onDestroy компонента.
            if (cc.isValid(particles, true) && cc.isValid(particles.node, true)) {
                particles.node.destroy();
            }
            pool.available[i] = null;
        }
        for (let i = 0; i < pool.activeCount; i++) {
            const particles = pool.active[i];
            if (cc.isValid(particles, true) && cc.isValid(particles.node, true)) {
                particles.node.destroy();
            }
            pool.active[i] = null;
        }
        pool.availableCount = 0;
        pool.activeCount = 0;
    }
}
