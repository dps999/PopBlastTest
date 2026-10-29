import type { CellMove } from "./IBoardEngine";
import type { BoardEffectType } from "../core/BoardEffectType";

export interface IBoardView {
    initRender(cells: number[]): void;

    transformTile(index: number, value: number): void;

    removeTiles(indices: number[], count: number): void;

    playEffects(indices: number[], effectTypes: BoardEffectType[], count: number): boolean;

    /** Коротко ждёт перед удалением клеток, пока эффект начинает попадание. */
    waitForEffectDelay(): Promise<boolean>;

    mergeTiles(indices: number[], count: number, targetIndex: number): void;

    swapTiles(first: number, second: number): void;

    setSelectedCell(index: number): void;

    setInputLocked(locked: boolean): void;

    /** true после всех анимаций и частиц; false при уничтожении представления. */
    waitForAnimations(): Promise<boolean>;

    /** Ожидает удаления тайлов, не блокируя падение завершением частиц. */
    waitForRemovals(): Promise<boolean>;

    /** Синхронно потребляет префиксы буферов и запускает общее падение. */
    fallTiles(moves: CellMove[], moveCount: number, cells: number[], spawnedIndices: number[], spawnCount: number): void;

    /** Перемещает тайлы согласно перестановке из движка поля. */
    shuffleTiles(moves: CellMove[], moveCount: number): void;
}
