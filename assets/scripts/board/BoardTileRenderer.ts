import type { IInitializable } from "../core/GameFactory";
import type { GameConfig } from "../core/GameConfig";
import type Tile from "../tiles/Tile";
import type { TilePool } from "../tiles/TilePool";
import type { BoardInputService } from "./BoardInputService";
import type { CellMove } from "./IBoardEngine";

export interface BoardTileRendererDependencies {
    tilePool: TilePool;
    superTileSprites?: cc.SpriteFrame[];
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
    inputService: BoardInputService;
}

const { ccclass, property, disallowMultiple } = cc._decorator;

@ccclass
@disallowMultiple
export default class BoardTileRenderer extends cc.Component implements IInitializable<BoardTileRendererDependencies> {
    @property({ min: 1, tooltip: "Средняя скорость ускоренного падения в локальных единицах поля в секунду." })
    private fallSpeed: number = 800;

    @property({ min: 0, tooltip: "Максимальная высота отскока при приземлении." })
    private landingBounceHeight: number = 6;

    @property({ min: 0.01, tooltip: "Длительность отскока при приземлении в секундах." })
    private landingBounceDuration: number = 0.16;

    private tilePool: TilePool;
    private superTileSprites: cc.SpriteFrame[];
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
    private columnSpawnCounts: number[] = [];

    public init(dependencies: BoardTileRendererDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.superTileSprites = dependencies.superTileSprites;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.inputService = dependencies.inputService;
        const cellCount = this.config.boardRows * this.config.boardColumns;
        this.tiles = new Array<Tile>(cellCount).fill(null);
        this.fallingStates = new Array(cellCount);
        // Состояния выделяются один раз при инициализации и переиспользуются во всех ходах.
        for (let i = 0; i < cellCount; i++) {
            this.fallingStates[i] = {
                tile: null,
                startY: 0,
                targetY: 0,
                elapsed: 0,
                duration: 0
            };
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

    public initRender(cells: number[], kinds?: number[]): void {
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] !== -1) {
                this.spawnTile(i, cells[i], kinds ? kinds[i] : 0);
            }
        }
    }

    public transformTile(index: number, kind: number): void {
        const tile = this.tiles[index];
        tile.setSprite(this.superTileSprites[kind - 1]);
        tile.setSize(this.tileSize);
    }

    public removeTiles(indices: number[], count: number): void {
        for (let i = 0; i < count; i++) {
            const index = indices[i];
            const tile = this.tiles[index];
            if (!tile) {
                continue;
            }

            this.inputService.unbind(tile.sprite.node);
            this.tilePool.release(tile);
            this.tiles[index] = null;
        }
    }

    public fallTiles(
        moves: CellMove[],
        moveCount: number,
        cells: number[],
        spawnedIndices: number[],
        spawnCount: number,
        kinds?: number[]
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

            const tile = this.spawnTile(index, cells[index], kinds ? kinds[index] : 0);
            tile.node.y = spawnRow * this.rowStep;
            this.startFalling(tile, index);
        }
    }

    private spawnTile(index: number, color: number, kind: number = 0): Tile {
        const tile = this.tilePool.get();
        tile.setSprite(kind === 0 ? this.colorSprites[color] : this.superTileSprites[kind - 1]);
        this.layoutTile(tile, index);
        this.tiles[index] = tile;
        this.inputService.bind(tile.sprite.node, index);
        return tile;
    }

    private startFalling(tile: Tile, index: number): void {
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
        if (this.fallingCount === 0) {
            return;
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

        if (this.fallingCount === 0) {
            this.inputService.setEnabled(true);
        }
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
        const column = index % this.config.boardColumns;
        const row = Math.floor(index / this.config.boardColumns);
        tile.node.setPosition(column * this.columnStep, row * this.rowStep);
    }

    private stopFalling(): void {
        for (let i = 0; i < this.fallingCount; i++) {
            this.fallingStates[i].tile = null;
        }
        this.fallingCount = 0;
        if (this.inputService) {
            this.inputService.setEnabled(true);
        }
    }

    protected onDestroy(): void {
        this.stopFalling();
        if (this.inputService) {
            this.inputService.dispose();
        }
    }
}
