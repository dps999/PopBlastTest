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
        config: GameConfig
    ): BoardController {
        const model = new BoardModel(config.boardRows, config.boardColumns);
        const tilePool = new TilePool(tilePrefab);
        const engine = new BoardEngine(model, config.boardColumns, config.boardRows * config.boardColumns);
        const spawnService = new SpawnService(colorSprites.length);
        const controller = new BoardController(model, view, engine, spawnService);
        const inputService = new BoardInputService(controller);
        const tileRenderer = view.getComponent(BoardTileRenderer) || view.addComponent(BoardTileRenderer);
        tileRenderer.init({
            tilePool,
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
