import BoardView from "../board/BoardView";
import { GameConfig } from "./GameConfig";
import { GameFactory } from "./GameFactory";
import BoostersView from "../boosters/BoostersView";
import GameView from "../gameplay/GameView";
import { GameSession } from "../gameplay/GameSession";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameBootstrap extends cc.Component {
    @property(GameConfig)
    private config: GameConfig = new GameConfig();

    @property(BoardView)
    private boardView: BoardView = null;

    @property(cc.Prefab)
    private tilePrefab: cc.Prefab = null;

    @property(cc.Prefab)
    private tileRemovalParticlePrefab: cc.Prefab = null;

    @property([cc.SpriteFrame])
    private colorSprites: cc.SpriteFrame[] = [];

    /** Префабы стратегий супер-тайлов. */
    @property([cc.Prefab])
    private superTilePrefabs: cc.Prefab[] = [];

    /** Каждый префаб содержит BoosterConfig и один компонент стратегии, без Sprite. */
    @property([cc.Prefab])
    private boosterPrefabs: cc.Prefab[] = [];

    @property(BoostersView)
    private boostersView: BoostersView = null;

    @property(GameView)
    private gameView: GameView = null;

    private readonly session: GameSession = new GameSession();

    public restartLevel(): void {
        cc.director.loadScene(cc.director.getScene().name);
    }

    protected onDestroy(): void {
        this.session.stop();
    }

    protected start(): void {
        GameFactory.initializeGame(this.boardView, this.tilePrefab, this.tileRemovalParticlePrefab, this.colorSprites, this.config,
            this.superTilePrefabs, this.boosterPrefabs, this.boostersView, this.gameView, this.session);
    }
}
