import { BoardController } from "../board/BoardController";
import { BoardModel } from "../board/BoardModel";
import BoardView from "../board/BoardView";
import { TilePool } from "../tiles/TilePool";
import type { GameConfig } from "./GameConfig";

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
        view.init({
            tilePool,
            colorSprites,
            config
        });
        const controller = new BoardController(model, view);
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
