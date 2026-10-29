import type { ISuperTileCreationStrategy } from "../superTiles/SuperTileStrategies";
import type { GameConfig } from "../core/GameConfig";
import type Tile from "../tiles/Tile";
import type { TilePool } from "../tiles/TilePool";
import type { BoardInputService } from "./BoardInputService";
import type { CellMove } from "./IBoardEngine";

export interface BoardTileRendererDependencies {
    tilePool: TilePool;
    superTiles?: ISuperTileCreationStrategy;
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
    inputService: BoardInputService;
    tileRemovalParticlePrefab: cc.Prefab;
}

interface TileRemovalState {
    tile: Tile;
    elapsed: number;
    startScale: number;
    particlesStarted: boolean;
    startX: number;
    startY: number;
    targetTile: Tile;
}

const { ccclass, property, disallowMultiple } = cc._decorator;

@ccclass
@disallowMultiple
export default class BoardTileRenderer extends cc.Component {
    @property({ min: 1, tooltip: "Средняя скорость ускоренного падения в локальных единицах поля в секунду." })
    private fallSpeed: number = 800;

    @property({ min: 0, tooltip: "Максимальная высота отскока при приземлении." })
    private landingBounceHeight: number = 6;

    @property({ min: 0.01, tooltip: "Длительность отскока при приземлении в секундах." })
    private landingBounceDuration: number = 0.16;

    private tilePool: TilePool;
    private superTiles: ISuperTileCreationStrategy;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private inputService: BoardInputService;
    private initialPoint: cc.Node;
    private tileSize: cc.Size;
    private columnStep: number = 0;
    private rowStep: number = 0;
    private tiles: Tile[] = [];
    private fallingStates: {
        tile: Tile;
        startY: number;
        targetY: number;
        elapsed: number;
        duration: number;
    }[] = [];
    private fallingCount: number = 0;
    private removalStates: TileRemovalState[] = [];
    private removalCount: number = 0;
    private particlePool: cc.NodePool = new cc.NodePool();
    private activeParticleSystems: cc.ParticleSystem[] = [];
    private activeParticleCount: number = 0;
    private tileRemovalParticlePrefab: cc.Prefab;
    private columnSpawnCounts: number[] = [];
    private selectedIndex: number = -1;
    private readonly selectedColor: cc.Color = cc.color(255, 225, 100);
    private readonly originalColor: cc.Color = cc.color(255, 255, 255);
    private readonly removalDuration: number = 0.36;
    private readonly particleStartDelay: number = 0.08;
    private mergeTargetTile: Tile = null;
    private mergeTargetElapsed: number = 0;
    private mergeTargetStartScale: number = 1;
    private readonly mergeTargetDuration: number = 0.24;
    private inputLocked: boolean = false;
    private disposed: boolean = false;
    private animationPromise: Promise<boolean> = null;
    private animationResolver: (completed: boolean) => void = null;
    private readonly animationExecutor = this.captureAnimationResolver.bind(this);

    public setInputLocked(locked: boolean): void {
        this.inputLocked = locked;
        this.updateInputState();
    }

    public waitForAnimations(): Promise<boolean> {
        if (this.disposed || !this.hasAnimations()) {
            return Promise.resolve(!this.disposed);
        }
        if (!this.animationPromise) {
            this.animationPromise = new Promise<boolean>(this.animationExecutor);
        }
        return this.animationPromise;
    }

    private captureAnimationResolver(resolve: (completed: boolean) => void): void {
        this.animationResolver = resolve;
    }

    private finishAnimationWait(completed: boolean): void {
        const resolve = this.animationResolver;
        this.animationResolver = null;
        this.animationPromise = null;
        if (resolve) {
            resolve(completed);
        }
    }

    public setSelectedCell(index: number): void {
        if (this.selectedIndex >= 0) {
            const previous = this.tiles[this.selectedIndex];
            if (previous && cc.isValid(previous.sprite.node)) {
                previous.sprite.node.color = this.originalColor;
            }
        }
        this.selectedIndex = -1;
        const tile = this.tiles[index];
        if (tile && cc.isValid(tile.sprite.node)) {
            cc.Color.copy(this.originalColor, tile.sprite.node.color);
            tile.sprite.node.color = this.selectedColor;
            this.selectedIndex = index;
        }
    }

    public swapTiles(first: number, second: number): void {
        this.setSelectedCell(-1);
        const tile = this.tiles[first];
        this.tiles[first] = this.tiles[second];
        this.tiles[second] = tile;
        this.layoutTile(this.tiles[first], first);
        this.layoutTile(tile, second);
        this.inputService.bind(this.tiles[first].sprite.node, first);
        this.inputService.bind(tile.sprite.node, second);
    }

    public init(dependencies: BoardTileRendererDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.superTiles = dependencies.superTiles;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.inputService = dependencies.inputService;
        this.tileRemovalParticlePrefab = dependencies.tileRemovalParticlePrefab;
        if (!this.tileRemovalParticlePrefab) {
            throw new Error("BoardTileRenderer requires a tile removal particle prefab.");
        }
        const cellCount = this.config.boardRows * this.config.boardColumns;
        this.tiles = new Array<Tile>(cellCount).fill(null);
        this.fallingStates = new Array(cellCount);
        this.removalStates = new Array<TileRemovalState>(cellCount);
        this.activeParticleSystems = new Array<cc.ParticleSystem>(cellCount);
        // Состояния выделяются один раз при инициализации и переиспользуются во всех ходах.
        for (let i = 0; i < cellCount; i++) {
            this.fallingStates[i] = {
                tile: null,
                startY: 0,
                targetY: 0,
                elapsed: 0,
                duration: 0
            };
            this.removalStates[i] = {
                tile: null,
                elapsed: 0,
                startScale: 1,
                particlesStarted: false,
                startX: 0,
                startY: 0,
                targetTile: null
            };
        }
        // Прогреваем пул один раз, чтобы уничтожение тайлов не создавало узлы в игровом цикле.
        for (let i = 0; i < cellCount; i++) {
            const node = cc.instantiate(this.tileRemovalParticlePrefab);
            const particleSystem = node.getComponent(cc.ParticleSystem);
            if (!particleSystem) {
                throw new Error("Tile removal particle prefab must contain cc.ParticleSystem.");
            }
            particleSystem.playOnLoad = false;
            node.active = false;
            this.particlePool.put(node);
        }
        this.columnSpawnCounts = new Array<number>(this.config.boardColumns).fill(0);
    }

    public setLayout(initialPoint: cc.Node, tileSize: cc.Size, tileSpacing: cc.Size): void {
        this.initialPoint = initialPoint;
        this.tileSize = tileSize;
        this.columnStep = tileSize.width + tileSpacing.width;
        this.rowStep = tileSize.height + tileSpacing.height;
        this.refreshTilesLayout();
    }

    public initRender(cells: number[]): void {
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] !== -1) {
                this.spawnTile(i, cells[i]);
            }
        }
    }

    public transformTile(index: number, value: number): void {
        const tile = this.tiles[index];
        tile.setSprite(this.getSprite(value));
        tile.setSize(this.tileSize);
    }

    public removeTiles(indices: number[], count: number): void {
        for (let i = 0; i < count; i++) {
            this.startTileRemoval(indices[i], null);
        }
    }

    public mergeTiles(indices: number[], count: number, targetIndex: number): void {
        const targetTile = this.tiles[targetIndex];
        if (!targetTile) {
            this.removeTiles(indices, count);
            return;
        }
        this.setSelectedCell(-1);
        this.mergeTargetTile = targetTile;
        this.mergeTargetElapsed = 0;
        this.mergeTargetStartScale = targetTile.node.scale;
        this.inputService.setEnabled(false);
        for (let i = 0; i < count; i++) {
            this.startTileRemoval(indices[i], targetTile);
        }
    }

    private startTileRemoval(index: number, targetTile: Tile): void {
        if (index === this.selectedIndex) {
            this.setSelectedCell(-1);
        }
        const tile = this.tiles[index];
        if (!tile) {
            return;
        }
        this.inputService.deactivate(tile.sprite.node);
        this.tiles[index] = null;
        const state = this.removalStates[this.removalCount++];
        state.tile = tile;
        state.elapsed = 0;
        state.startScale = tile.node.scale;
        state.startX = tile.node.x;
        state.startY = tile.node.y;
        state.targetTile = targetTile;
        state.particlesStarted = targetTile !== null;
        if (targetTile) {
            tile.node.zIndex = this.tiles.length + index;
        }
        this.inputService.setEnabled(false);
    }

    private spawnParticles(tile: Tile): void {
        if (this.activeParticleCount >= this.activeParticleSystems.length) {
            return;
        }
        const node = this.particlePool.get();
        if (!node) {
            return;
        }
        const particleSystem = node.getComponent(cc.ParticleSystem);
        if (!particleSystem) {
            this.particlePool.put(node);
            return;
        }
        node.parent = this.initialPoint;
        node.zIndex = this.tiles.length * 2;
        node.setPosition(tile.node.x, tile.node.y);
        particleSystem.spriteFrame = tile.sprite.spriteFrame;
        node.active = true;
        particleSystem.resetSystem();
        this.activeParticleSystems[this.activeParticleCount++] = particleSystem;
    }

    public fallTiles(
        moves: CellMove[],
        moveCount: number,
        cells: number[],
        spawnedIndices: number[],
        spawnCount: number
    ): void {
        if (this.fallingCount > 0) {
            this.refreshTilesLayout();
        }
        if (moveCount + spawnCount === 0) {
            return;
        }

        this.inputService.setEnabled(false);
        for (let i = 0; i < moveCount; i++) {
            const move = moves[i];
            const tile = this.tiles[move.from];
            this.tiles[move.from] = null;
            this.tiles[move.to] = tile;
            this.inputService.bind(tile.sprite.node, move.to);
            this.startFalling(tile, move.to);
        }

        this.columnSpawnCounts.fill(0);
        // SpawnService выдаёт индексы по возрастанию: новые клетки столбца идут снизу вверх.
        for (let i = 0; i < spawnCount; i++) {
            const index = spawnedIndices[i];
            const column = index % this.config.boardColumns;
            const spawnRow = this.config.boardRows + this.columnSpawnCounts[column];
            this.columnSpawnCounts[column]++;

            const tile = this.spawnTile(index, cells[index]);
            tile.node.y = spawnRow * this.rowStep;
            this.startFalling(tile, index);
        }
    }

    private spawnTile(index: number, value: number): Tile {
        const tile = this.tilePool.get();
        tile.setSprite(this.getSprite(value));
        this.layoutTile(tile, index);
        this.tiles[index] = tile;
        this.inputService.bind(tile.sprite.node, index);
        return tile;
    }

    private getSprite(value: number): cc.SpriteFrame {
        const strategy = this.superTiles ? this.superTiles.getStrategy(value) : null;
        return strategy ? strategy.spriteFrame : this.colorSprites[value];
    }

    private startFalling(tile: Tile, index: number): void {
        tile.node.zIndex = index;
        const state = this.fallingStates[this.fallingCount++];
        const row = Math.floor(index / this.config.boardColumns);
        const targetY = row * this.rowStep;
        state.tile = tile;
        state.startY = tile.node.y;
        state.targetY = targetY;
        state.elapsed = 0;
        state.duration = Math.abs(targetY - tile.node.y) / this.fallSpeed;
    }

    protected update(deltaTime: number): void {
        for (let i = 0; i < this.fallingCount;) {
            const state = this.fallingStates[i];
            const tile = state.tile;
            const elapsed = state.elapsed + deltaTime;
            const duration = state.duration;
            const targetY = state.targetY;
            state.elapsed = elapsed;
            if (elapsed < duration) {
                const progress = elapsed / duration;
                // Квадратичный прогресс даёт падение из покоя с постоянным ускорением.
                tile.node.y = state.startY + (targetY - state.startY) * progress * progress;
                i++;
                continue;
            }

            const bounceHeight = Math.min(this.landingBounceHeight, Math.abs(targetY - state.startY) * 0.08);
            const bounceProgress = (elapsed - duration) / this.landingBounceDuration;
            if (bounceHeight > 0 && bounceProgress < 1) {
                const remaining = 1 - bounceProgress;
                // Нулевая скорость на краях отскока обеспечивает мягкий возврат в ячейку.
                tile.node.y = targetY + 16 * bounceHeight * bounceProgress * bounceProgress * remaining * remaining;
                i++;
                continue;
            }

            tile.node.y = targetY;
            state.tile = null;
            // Завершённое состояние уходит за активную часть массива без удаления объекта.
            const lastActiveIndex = --this.fallingCount;
            this.fallingStates[i] = this.fallingStates[lastActiveIndex];
            this.fallingStates[lastActiveIndex] = state;
        }

        for (let i = 0; i < this.removalCount;) {
            const state = this.removalStates[i];
            const tile = state.tile;
            const elapsed = state.elapsed + deltaTime;
            const progress = Math.min(1, elapsed / this.removalDuration);
            state.elapsed = elapsed;
            if (state.targetTile) {
                const targetNode = state.targetTile.node;
                tile.node.x = state.startX + (targetNode.x - state.startX) * progress;
                tile.node.y = state.startY + (targetNode.y - state.startY) * progress;
                tile.node.opacity = 255 * Math.min(1, (1 - progress) * 4);
            } else {
                tile.node.scale = state.startScale * (1 - progress);
                tile.node.opacity = 255 * (1 - progress);
            }
            if (!state.particlesStarted && elapsed >= this.particleStartDelay) {
                this.spawnParticles(tile);
                state.particlesStarted = true;
            }
            if (progress < 1) {
                i++;
                continue;
            }
            tile.node.scale = 1;
            tile.node.opacity = 255;
            this.tilePool.release(tile);
            state.tile = null;
            state.targetTile = null;
            const lastActiveIndex = --this.removalCount;
            this.removalStates[i] = this.removalStates[lastActiveIndex];
            this.removalStates[lastActiveIndex] = state;
        }

        if (this.mergeTargetTile) {
            this.mergeTargetElapsed += deltaTime;
            const pulseProgress = Math.min(1, this.mergeTargetElapsed / this.mergeTargetDuration);
            const pulse = 1 + 0.2 * Math.sin(pulseProgress * Math.PI);
            this.mergeTargetTile.node.scale = this.mergeTargetStartScale * pulse;
            if (pulseProgress >= 1) {
                this.mergeTargetTile.node.scale = this.mergeTargetStartScale;
                this.mergeTargetTile = null;
            }
        }

        for (let i = 0; i < this.activeParticleCount;) {
            const particleSystem = this.activeParticleSystems[i];
            if (!particleSystem.stopped || particleSystem.particleCount > 0) {
                i++;
                continue;
            }
            const node = particleSystem.node;
            node.active = false;
            this.particlePool.put(node);
            const lastActiveIndex = --this.activeParticleCount;
            this.activeParticleSystems[i] = this.activeParticleSystems[lastActiveIndex];
            this.activeParticleSystems[lastActiveIndex] = null;
        }

        if (!this.hasAnimations()) {
            this.finishAnimationWait(true);
        }
        this.updateInputState();
    }

    private refreshTilesLayout(): void {
        this.stopFalling();
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            if (tile) {
                this.layoutTile(tile, i);
            }
        }
    }

    private layoutTile(tile: Tile, index: number): void {
        tile.setSize(this.tileSize);
        tile.node.parent = this.initialPoint;
        tile.node.zIndex = index;
        const column = index % this.config.boardColumns;
        const row = Math.floor(index / this.config.boardColumns);
        tile.node.setPosition(column * this.columnStep, row * this.rowStep);
    }

    private stopFalling(): void {
        for (let i = 0; i < this.fallingCount; i++) {
            this.fallingStates[i].tile = null;
        }
        this.fallingCount = 0;
        this.updateInputState();
    }

    private updateInputState(): void {
        if (this.inputService && !this.disposed) {
            this.inputService.setEnabled(!this.inputLocked && !this.hasAnimations());
        }
    }

    private hasAnimations(): boolean {
        return this.fallingCount > 0 || this.removalCount > 0
            || this.mergeTargetTile !== null || this.activeParticleCount > 0;
    }

    protected onDestroy(): void {
        this.disposed = true;
        this.finishAnimationWait(false);
        this.setSelectedCell(-1);
        this.stopFalling();
        if (this.inputService) {
            this.inputService.dispose();
        }
        this.particlePool.clear();
    }
}
