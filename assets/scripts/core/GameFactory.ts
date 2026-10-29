import {SuperTileFactory} from "../superTiles/SuperTileFactory";
import {BoardController} from "../board/BoardController";
import {BoardModel} from "../board/BoardModel";
import BoardView from "../board/BoardView";
import BoardTileRenderer from "../board/BoardTileRenderer";
import {TilePool} from "../tiles/TilePool";
import type {GameConfig} from "./GameConfig";
import {BoardInputService} from "../board/BoardInputService";
import {BoardEngine} from "../board/BoardEngine";
import {SpawnService} from "../board/SpawnService";
import {BoosterFactory} from "../boosters/BoosterFactory";
import {BoosterModel} from "../boosters/BoosterModel";
import {BoosterController} from "../boosters/BoosterController";
import type BoostersView from "../boosters/BoostersView";
import {GameController} from "../gameplay/GameController";
import {GameModel} from "../gameplay/GameModel";
import type {GameSession} from "../gameplay/GameSession";
import type {IGameView} from "../gameplay/GameContracts";

/** Единая точка создания и инициализации игры с явным внедрением зависимостей. */
export class GameFactory {
    public static initializeGame(
        view: BoardView,
        tilePrefab: cc.Prefab,
        tileRemovalParticlePrefab: cc.Prefab,
        colorSprites: cc.SpriteFrame[],
        config: GameConfig,
        superTilePrefabs: cc.Prefab[],
        boosterPrefabs: cc.Prefab[],
        boostersView: BoostersView,
        gameView: IGameView,
        session: GameSession
    ): void {
        if (!boostersView) {
            throw new Error("GameBootstrap requires a BoostersView reference.");
        }
        if (!gameView) {
            throw new Error("GameBootstrap requires a GameView reference.");
        }
        if (config.colorCount < 2 || config.colorCount > 5 || config.colorCount % 1 !== 0) {
            throw new Error("Level color count must be an integer from 2 to 5.");
        }
        if (colorSprites.length < config.colorCount) {
            throw new Error("Not enough color sprites for the configured level color count.");
        }
        const gameModel = new GameModel(config.initialMoves, config.pointsPerTile, config.targetScore);
        const superTiles = new SuperTileFactory(superTilePrefabs, config.colorCount);
        const model = new BoardModel(config.boardRows, config.boardColumns);
        const tilePool = new TilePool(tilePrefab);
        const engine = new BoardEngine(model, config.boardColumns, config.boardRows * config.boardColumns, superTiles.creation);
        const spawnService = new SpawnService(config.colorCount);
        const definitions = BoosterFactory.createDefinitions(boosterPrefabs);
        const capacity = config.boardRows * config.boardColumns;
        const boosters = new BoosterController(definitions, new BoosterModel(definitions), model, engine,
            view, boostersView, config.boardColumns, capacity);
        const boardController = new BoardController(model, view, engine, spawnService);
        const gameController = new GameController(boardController, boosters, gameModel, session, gameView);
        const inputService = new BoardInputService(gameController);
        const tileRenderer = view.getComponent(BoardTileRenderer) || view.addComponent(BoardTileRenderer);
        tileRenderer.init({
            tilePool,
            superTiles: superTiles.creation,
            colorSprites,
            config,
            inputService,
            tileRemovalParticlePrefab
        });
        view.init({ tileRenderer, colorSprites, config });
        boostersView.init(boosters, definitions);
        gameController.init();
        inputService.setStateListener(gameController);
    }
}
