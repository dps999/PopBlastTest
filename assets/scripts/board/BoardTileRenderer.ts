import type { ISuperTileCreationStrategy } from "../superTiles/SuperTileStrategies";
import type { GameConfig } from "../core/GameConfig";
import type Tile from "../tiles/Tile";
import type { TilePool } from "../tiles/TilePool";
import type { BoardInputService } from "./BoardInputService";
import type { CellMove } from "./IBoardEngine";
import type { IBoardView } from "./IBoardView";
import type BombExplosionPool from "../tiles/BombExplosionPool";
import { BoardEffectType } from "../core/BoardEffectType";
import { BoardEffectAnimationDispatcher, RocketEffectPool } from "./BoardEffectAnimationDispatcher";
import type { IBoardEffectAnimationContext } from "./BoardEffectAnimationDispatcher";

export interface BoardTileRendererDependencies {
    tilePool: TilePool;
    superTiles?: ISuperTileCreationStrategy;
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
    inputService: BoardInputService;
}

interface TileRemovalState {
    tile: Tile;
    elapsed: number;
    startScale: number;
    startOpacity: number;
    particlesStarted: boolean;
    startX: number;
    startY: number;
    targetTile: Tile;
}

interface TileShuffleState {
    tile: Tile;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    elapsed: number;
}

const { ccclass, property, disallowMultiple } = cc._decorator;

@ccclass
@disallowMultiple
export default class BoardTileRenderer extends cc.Component implements IBoardView, IBoardEffectAnimationContext {
    @property({ min: 1, tooltip: "Ускорение падения в локальных единицах поля в секунду в квадрате." })
    private fallAcceleration: number = 16000;

    @property({ min: 0, tooltip: "Максимальная высота отскока при приземлении." })
    private landingBounceHeight: number = 6;

    @property({ min: 0.01, tooltip: "Длительность отскока при приземлении в секундах." })
    private landingBounceDuration: number = 0.16;

    private tilePool: TilePool;
    private superTiles: ISuperTileCreationStrategy;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private inputService: BoardInputService;
    private explosionPool: BombExplosionPool;
    private rocketEffects: RocketEffectPool;
    private readonly effectDispatcher: BoardEffectAnimationDispatcher = new BoardEffectAnimationDispatcher();
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
    private shuffleStates: TileShuffleState[] = [];
    private shuffleCount: number = 0;
    private shuffleTilesBuffer: Tile[] = [];
    private removalStates: TileRemovalState[] = [];
    private removalCount: number = 0;
    private readonly particleColorsBySprite: Map<cc.SpriteFrame, cc.Color> = new Map<cc.SpriteFrame, cc.Color>();
    private columnSpawnCounts: number[] = [];
    private selectedIndex: number = -1;
    private readonly selectedColor: cc.Color = cc.color(255, 225, 100);
    private readonly originalColor: cc.Color = cc.color(255, 255, 255);
    private readonly removalDuration: number = 0.36;
    private readonly particleStartDelay: number = 0.08;
    private readonly effectRemovalDelay: number = 0.1;
    private effectRemovalElapsed: number = 0;
    private effectRemovalPending: boolean = false;
    private effectDelayPromise: Promise<boolean> = null;
    private effectDelayResolver: (completed: boolean) => void = null;
    private mergeTargetTile: Tile = null;
    private mergeTargetElapsed: number = 0;
    private mergeTargetStartScale: number = 1;
    private readonly mergeTargetDuration: number = 0.24;
    private readonly shuffleDuration: number = 0.3;
    private inputLocked: boolean = false;
    private disposed: boolean = false;
    private animationPromise: Promise<boolean> = null;
    private animationResolver: (completed: boolean) => void = null;
    private waitForRemovalOnly: boolean = false;
    private readonly animationExecutor = this.captureAnimationResolver.bind(this);
    private readonly effectDelayExecutor = this.captureEffectDelayResolver.bind(this);

    public setInputLocked(locked: boolean): void {
        this.inputLocked = locked;
        this.updateInputState();
    }

    public waitForAnimations(): Promise<boolean> {
        if (this.disposed || !this.hasAnimations()) {
            return Promise.resolve(!this.disposed);
        }
        if (!this.animationPromise) {
            this.waitForRemovalOnly = false;
            this.animationPromise = new Promise<boolean>(this.animationExecutor);
        }
        return this.animationPromise;
    }

    public waitForRemovals(): Promise<boolean> {
        if (this.disposed || this.removalCount === 0) {
            return Promise.resolve(!this.disposed);
        }
        if (!this.animationPromise) {
            this.waitForRemovalOnly = true;
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
        this.waitForRemovalOnly = false;
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
        if (!this.config.particleColors || this.config.particleColors.length !== this.colorSprites.length) {
            throw new Error("Particle colors must match colorSprites in count and order.");
        }
        this.particleColorsBySprite.clear();
        for (let i = 0; i < this.colorSprites.length; i++) {
            const color = this.config.particleColors[i];
            if (!color) {
                throw new Error("Each tile sprite requires a particle color.");
            }
            this.particleColorsBySprite.set(this.colorSprites[i], color);
        }
        const cellCount = this.config.boardRows * this.config.boardColumns;
        this.tiles = new Array<Tile>(cellCount).fill(null);
        this.shuffleTilesBuffer = new Array<Tile>(cellCount).fill(null);
        this.fallingStates = new Array(cellCount);
        this.shuffleStates = new Array<TileShuffleState>(cellCount);
        this.removalStates = new Array<TileRemovalState>(cellCount);
        // Состояния выделяются один раз при инициализации и переиспользуются во всех ходах.
        for (let i = 0; i < cellCount; i++) {
            this.fallingStates[i] = {
                tile: null,
                startY: 0,
                targetY: 0,
                elapsed: 0,
                duration: 0
            };
            this.shuffleStates[i] = {
                tile: null,
                startX: 0,
                startY: 0,
                targetX: 0,
                targetY: 0,
                elapsed: 0
            };
            this.removalStates[i] = {
                tile: null,
                elapsed: 0,
                startScale: 1,
                startOpacity: 255,
                particlesStarted: false,
                startX: 0,
                startY: 0,
                targetTile: null
            };
        }
        this.columnSpawnCounts = new Array<number>(this.config.boardColumns).fill(0);
    }

    public setLayout(initialPoint: cc.Node, tileSize: cc.Size, tileSpacing: cc.Size): void {
        this.initialPoint = initialPoint;
        this.explosionPool = this.initialPoint.getComponent("BombExplosionPool") as BombExplosionPool
            || this.initialPoint.getComponentInChildren("BombExplosionPool") as BombExplosionPool;
        if (!this.explosionPool) {
            const scene = cc.director.getScene();
            this.explosionPool = scene && scene !== this.initialPoint.parent
                ? scene.getComponentInChildren("BombExplosionPool") as BombExplosionPool : null;
        }
        if (!this.explosionPool) {
            throw new Error("Add BombExplosionPool to the scene or board InitialPoint.");
        }
        this.explosionPool.node.parent = initialPoint;
        this.explosionPool.node.zIndex = this.tiles.length * 2;
        this.tileSize = tileSize;
        this.columnStep = tileSize.width + tileSpacing.width;
        this.rowStep = tileSize.height + tileSpacing.height;
        const rocketPrefab = this.superTiles ? this.superTiles.getActivationEffectPrefab() : null;
        if (rocketPrefab && !this.rocketEffects) {
            this.rocketEffects = new RocketEffectPool(rocketPrefab, initialPoint, this.tiles.length,
                tileSize, this.tiles.length * 2 + 1);
        } else if (this.rocketEffects) {
            this.rocketEffects.setParent(initialPoint, this.tiles.length * 2 + 1);
        }
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
        this.setTileSprite(tile, value);
        tile.setSize(this.tileSize);
    }

    public removeTiles(indices: number[], count: number): void {
        for (let i = 0; i < count; i++) {
            this.startTileRemoval(indices[i], null);
        }
    }

    public playBombEffect(index: number): boolean {
        const tile = this.tiles[index];
        if (!tile || !this.explosionPool) {
            return false;
        }
        return this.explosionPool.playBomb(tile.node.x, tile.node.y);
    }

    public playEffects(indices: number[], effectTypes: BoardEffectType[], count: number): boolean {
        const started = this.effectDispatcher.play(indices, effectTypes, count, this);
        if (started) {
            this.effectRemovalElapsed = 0;
            this.effectRemovalPending = true;
        }
        return started;
    }

    public waitForEffectDelay(): Promise<boolean> {
        if (this.disposed || !this.effectRemovalPending) {
            return Promise.resolve(!this.disposed);
        }
        if (!this.effectDelayPromise) {
            this.effectDelayPromise = new Promise<boolean>(this.effectDelayExecutor);
        }
        return this.effectDelayPromise;
    }

    private captureEffectDelayResolver(resolve: (completed: boolean) => void): void {
        this.effectDelayResolver = resolve;
    }

    private finishEffectDelay(completed: boolean): void {
        const resolve = this.effectDelayResolver;
        this.effectDelayResolver = null;
        this.effectDelayPromise = null;
        this.effectRemovalPending = false;
        this.effectRemovalElapsed = 0;
        if (resolve) {
            resolve(completed);
        }
    }

    public playRocketEffect(index: number, effectType: BoardEffectType): boolean {
        const tile = this.tiles[index];
        if (!tile || !this.rocketEffects) {
            return false;
        }

        if (effectType === BoardEffectType.HorizontalRocket) {
            const endX = (this.config.boardColumns - 1) * this.columnStep;
            const started = this.rocketEffects.play(tile.node.x, tile.node.y,
                0, tile.node.y, endX, tile.node.y, true);
            if (started) {
                tile.node.opacity = 0;
            }
            return started;
        }
        if (effectType === BoardEffectType.VerticalRocket) {
            const endY = (this.config.boardRows - 1) * this.rowStep;
            const started = this.rocketEffects.play(tile.node.x, tile.node.y,
                tile.node.x, 0, tile.node.x, endY, false);
            if (started) {
                tile.node.opacity = 0;
            }
            return started;
        }
        return false;
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
        state.startOpacity = tile.node.opacity;
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
        this.explosionPool.play(tile.destructionParticles, tile.node.x, tile.node.y,
            this.particleColorsBySprite.get(tile.sprite.spriteFrame));
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

    public shuffleTiles(moves: CellMove[], moveCount: number): void {
        this.setSelectedCell(-1);
        this.stopFalling();
        this.stopShuffling();

        for (let i = 0; i < moveCount; i++) {
            const move = moves[i];
            const tile = this.tiles[move.from];
            this.shuffleTilesBuffer[move.to] = tile;
            if (!tile || move.from === move.to) {
                continue;
            }

            const state = this.shuffleStates[this.shuffleCount++];
            const column = move.to % this.config.boardColumns;
            const row = Math.floor(move.to / this.config.boardColumns);
            state.tile = tile;
            state.startX = tile.node.x;
            state.startY = tile.node.y;
            state.targetX = column * this.columnStep;
            state.targetY = row * this.rowStep;
            state.elapsed = 0;
        }

        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.shuffleTilesBuffer[i];
            this.tiles[i] = tile;
            this.shuffleTilesBuffer[i] = null;
            if (!tile) {
                continue;
            }
            tile.node.zIndex = i;
            this.inputService.bind(tile.sprite.node, i);
        }
        this.updateInputState();
    }

    private spawnTile(index: number, value: number): Tile {
        const tile = this.tilePool.get();
        this.setTileSprite(tile, value);
        this.layoutTile(tile, index);
        this.tiles[index] = tile;
        this.inputService.bind(tile.sprite.node, index);
        return tile;
    }

    private setTileSprite(tile: Tile, value: number): void {
        const strategy = this.superTiles ? this.superTiles.getStrategy(value) : null;
        tile.setSprite(strategy ? strategy.spriteFrame : this.colorSprites[value],
            strategy ? strategy.destructionParticles : null);
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
        state.duration = Math.sqrt(2 * Math.abs(targetY - tile.node.y) / this.fallAcceleration);
    }

    protected update(deltaTime: number): void {
        if (this.effectRemovalPending) {
            this.effectRemovalElapsed += deltaTime;
            if (this.effectRemovalElapsed >= this.effectRemovalDelay) {
                this.finishEffectDelay(true);
            }
        }
        if (this.rocketEffects) {
            this.rocketEffects.update(deltaTime);
        }
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

        for (let i = 0; i < this.shuffleCount;) {
            const state = this.shuffleStates[i];
            const tile = state.tile;
            const elapsed = state.elapsed + deltaTime;
            const progress = Math.min(1, elapsed / this.shuffleDuration);
            const easedProgress = progress * progress * (3 - 2 * progress);
            state.elapsed = elapsed;
            tile.node.x = state.startX + (state.targetX - state.startX) * easedProgress;
            tile.node.y = state.startY + (state.targetY - state.startY) * easedProgress;
            if (progress < 1) {
                i++;
                continue;
            }

            tile.node.setPosition(state.targetX, state.targetY);
            state.tile = null;
            const lastActiveIndex = --this.shuffleCount;
            this.shuffleStates[i] = this.shuffleStates[lastActiveIndex];
            this.shuffleStates[lastActiveIndex] = state;
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
                tile.node.opacity = state.startOpacity * Math.min(1, (1 - progress) * 4);
            } else {
                tile.node.scale = state.startScale * (1 - progress);
                tile.node.opacity = state.startOpacity * (1 - progress);
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

        if (this.waitForRemovalOnly ? this.removalCount === 0 : !this.hasAnimations()) {
            this.finishAnimationWait(true);
        }
        this.updateInputState();
    }

    private refreshTilesLayout(): void {
        this.stopFalling();
        this.stopShuffling();
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

    private stopShuffling(): void {
        for (let i = 0; i < this.shuffleCount; i++) {
            const state = this.shuffleStates[i];
            state.tile.node.setPosition(state.targetX, state.targetY);
            state.tile = null;
        }
        this.shuffleCount = 0;
    }

    private updateInputState(): void {
        if (this.inputService && !this.disposed) {
            this.inputService.setEnabled(!this.inputLocked && !this.hasAnimations());
        }
    }

    private hasAnimations(): boolean {
        return this.effectRemovalPending || this.fallingCount > 0 || this.shuffleCount > 0 || this.removalCount > 0
            || this.mergeTargetTile !== null || (this.explosionPool && this.explosionPool.isPlaying)
            || (this.rocketEffects && this.rocketEffects.isPlaying);
    }

    protected onDestroy(): void {
        this.disposed = true;
        this.finishEffectDelay(false);
        this.finishAnimationWait(false);
        this.setSelectedCell(-1);
        this.stopFalling();
        this.stopShuffling();
        if (this.inputService) {
            this.inputService.dispose();
        }
        this.explosionPool = null;
        if (this.rocketEffects) {
            this.rocketEffects.dispose();
            this.rocketEffects = null;
        }
        this.particleColorsBySprite.clear();
    }
}
