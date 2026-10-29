interface TiledParticle {
    textureUVOffset: number;
}

interface ParticleBuffer {
    _vData: Float32Array;
}

interface TiledParticleSimulator {
    sys: { _renderSpriteFrame: { uv: number[] } };
    particles: TiledParticle[];
    emitParticle(position: cc.Vec2): void;
    updateUVs(force?: boolean): void;
    updateParticleBuffer(particle: TiledParticle, position: cc.Vec2, buffer: ParticleBuffer, offset: number): void;
    originalEmitParticle: TiledParticleSimulator["emitParticle"];
    originalUpdateUVs: TiledParticleSimulator["updateUVs"];
    originalUpdateParticleBuffer: TiledParticleSimulator["updateParticleBuffer"];
    tiledUVs: Float32Array;
    tiledSourceUVs: number[];
    tiledUVsReady: boolean;
}

interface TiledParticleSystem extends cc.ParticleSystem {
    _simulator: TiledParticleSimulator;
}

function emitTiledParticle(this: TiledParticleSimulator, position: cc.Vec2): void {
    this.originalEmitParticle.call(this, position);
    this.particles[this.particles.length - 1].textureUVOffset = Math.floor(Math.random() * 4) * 8;
}

function cacheTiledUVs(simulator: TiledParticleSimulator): void {
    const frame = simulator.sys._renderSpriteFrame;
    if (!frame) {
        simulator.tiledUVsReady = false;
        return;
    }
    const uv = frame.uv;
    const source = simulator.tiledSourceUVs;
    simulator.tiledUVsReady = true;
    if (source[0] === uv[0] && source[1] === uv[1]
        && source[2] === uv[2] && source[3] === uv[3]
        && source[4] === uv[4] && source[5] === uv[5]) {
        return;
    }
    // Интерполяция углов сохраняет сетку и для повёрнутого кадра в атласе.
    const stepUX = (uv[2] - uv[0]) * 0.5;
    const stepUY = (uv[3] - uv[1]) * 0.5;
    const stepVX = (uv[4] - uv[0]) * 0.5;
    const stepVY = (uv[5] - uv[1]) * 0.5;
    const cached = simulator.tiledUVs;
    for (let cell = 0; cell < 4; cell++) {
        const column = cell % 2;
        const row = Math.floor(cell / 2);
        const u = uv[0] + column * stepUX + row * stepVX;
        const v = uv[1] + column * stepUY + row * stepVY;
        const offset = cell * 8;
        cached[offset] = u;
        cached[offset + 1] = v;
        cached[offset + 2] = u + stepUX;
        cached[offset + 3] = v + stepUY;
        cached[offset + 4] = u + stepVX;
        cached[offset + 5] = v + stepVY;
        cached[offset + 6] = u + stepUX + stepVX;
        cached[offset + 7] = v + stepUY + stepVY;
    }
    for (let i = 0; i < 6; i++) {
        source[i] = uv[i];
    }
}

function updateTiledUVs(this: TiledParticleSimulator, force?: boolean): void {
    this.originalUpdateUVs.call(this, force);
    // Движок вызывает этот метод при загрузке/смене текстуры и росте числа частиц.
    cacheTiledUVs(this);
}

function updateTiledParticleBuffer(
    this: TiledParticleSimulator,
    particle: TiledParticle,
    position: cc.Vec2,
    buffer: ParticleBuffer,
    offset: number
): void {
    this.originalUpdateParticleBuffer.call(this, particle, position, buffer, offset);
    if (!this.tiledUVsReady) {
        return;
    }
    const uv = this.tiledUVs;
    const uvOffset = particle.textureUVOffset;
    const vertices = buffer._vData;
    // Cocos 2.4: четыре вершины, по пять 32-битных значений (xy, uv, color).
    vertices[offset + 2] = uv[uvOffset];
    vertices[offset + 3] = uv[uvOffset + 1];
    vertices[offset + 7] = uv[uvOffset + 2];
    vertices[offset + 8] = uv[uvOffset + 3];
    vertices[offset + 12] = uv[uvOffset + 4];
    vertices[offset + 13] = uv[uvOffset + 5];
    vertices[offset + 17] = uv[uvOffset + 6];
    vertices[offset + 18] = uv[uvOffset + 7];
}

const { ccclass, requireComponent, disallowMultiple, executeInEditMode } = cc._decorator;

@ccclass
@requireComponent(cc.ParticleSystem)
@disallowMultiple
@executeInEditMode
export default class TiledParticleTexture extends cc.Component {
    private system: TiledParticleSystem = null;
    private simulator: TiledParticleSimulator = null;
    private readonly tiledUVs: Float32Array = new Float32Array(32);
    private readonly sourceUVs: number[] = [NaN, NaN, NaN, NaN, NaN, NaN];

    protected onEnable(): void {
        // Доступ к внутреннему симулятору изолирован здесь: у ParticleSystem 2.x нет sheet animation API.
        if (!this.system) {
            this.system = this.getComponent(cc.ParticleSystem) as TiledParticleSystem;
        }
        const simulator = this.system._simulator;
        if (typeof simulator.emitParticle !== "function" || typeof simulator.updateUVs !== "function"
            || typeof simulator.updateParticleBuffer !== "function") {
            cc.error("TiledParticleTexture requires the Cocos Creator 2.4 web particle simulator.");
            return;
        }
        this.simulator = simulator;
        simulator.tiledUVs = this.tiledUVs;
        simulator.tiledSourceUVs = this.sourceUVs;
        cacheTiledUVs(simulator);
        // Preview редактора может уже испускать частицы при включении компонента.
        for (let i = 0; i < simulator.particles.length; i++) {
            simulator.particles[i].textureUVOffset = Math.floor(Math.random() * 4) * 8;
        }
        simulator.originalEmitParticle = simulator.emitParticle;
        simulator.originalUpdateUVs = simulator.updateUVs;
        simulator.originalUpdateParticleBuffer = simulator.updateParticleBuffer;
        simulator.emitParticle = emitTiledParticle;
        simulator.updateUVs = updateTiledUVs;
        simulator.updateParticleBuffer = updateTiledParticleBuffer;
    }

    protected onDisable(): void {
        const simulator = this.simulator;
        if (!simulator) {
            return;
        }
        simulator.emitParticle = simulator.originalEmitParticle;
        simulator.updateUVs = simulator.originalUpdateUVs;
        simulator.updateParticleBuffer = simulator.originalUpdateParticleBuffer;
        simulator.originalEmitParticle = null;
        simulator.originalUpdateUVs = null;
        simulator.originalUpdateParticleBuffer = null;
        simulator.tiledUVs = null;
        simulator.tiledSourceUVs = null;
        simulator.tiledUVsReady = false;
        this.simulator = null;
    }
}
