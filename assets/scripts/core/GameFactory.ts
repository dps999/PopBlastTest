import { SuperTileFactory } from "../superTiles/SuperTileFactory";
import { BoardController } from "../board/BoardController";
import { BoardModel } from "../board/BoardModel";
import BoardView from "../board/BoardView";
import BoardTileRenderer from "../board/BoardTileRenderer";
import { TilePool } from "../tiles/TilePool";
import type { GameConfig } from "./GameConfig";
import { BoardInputService } from "../board/BoardInputService";
import { BoardEngine } from "../board/BoardEngine";
import { SpawnService } from "../board/SpawnService";

/** Компонент, которому фабрика передаёт зависимости после создания Cocos. */
export interface IInitializable<TDependencies> {
    init(dependencies: TDependencies): void;
}

/** Единая точка создания игровых компонентов с явным внедрением зависимостей. */
export class GameFactory {
    public static createBoard(
        view: BoardView,
        tilePrefab: cc.Prefab,
        colorSprites: cc.SpriteFrame[],
        config: GameConfig,
        superTileSprites: cc.SpriteFrame[]
    ): BoardController {
        if (config.colorCount < 2 || config.colorCount > 5 || config.colorCount % 1 !== 0) {
            throw new Error("Level color count must be an integer from 2 to 5.");
        }
        if (colorSprites.length < config.colorCount) {
            throw new Error("Not enough color sprites for the configured level color count.");
        }
        for (let i = 0; i < config.superTileRules.length; i++) {
            if (!superTileSprites[config.superTileRules[i].kind - 1]) {
                throw new Error("Missing sprite for configured super tile kind.");
            }
        }
        const superTiles = SuperTileFactory.create(config.superTileRules, config.superTileRadius);
        const model = new BoardModel(config.boardRows, config.boardColumns);
        const tilePool = new TilePool(tilePrefab);
        const engine = new BoardEngine(model, config.boardColumns, config.boardRows * config.boardColumns, superTiles);
        const spawnService = new SpawnService(config.colorCount);
        const controller = new BoardController(model, view, engine, spawnService);
        const inputService = new BoardInputService(controller);
        const tileRenderer = view.getComponent(BoardTileRenderer) || view.addComponent(BoardTileRenderer);
        tileRenderer.init({
            tilePool,
            superTileSprites,
            colorSprites,
            config,
            inputService
        });
        view.init({ tileRenderer, colorSprites, config });
        controller.init();
        return controller;
    }

    public static addComponent<TDependencies, T extends cc.Component & IInitializable<TDependencies>>(
        node: cc.Node,
        componentType: { new(): T },
        dependencies: TDependencies
    ): T {
        // Cocos может вызвать onLoad внутри addComponent, до передачи зависимостей.
        // Зависимости используй в init или в более поздних lifecycle-методах.
        const component = node.addComponent(componentType);
        component.init(dependencies);
        return component;
    }
}
