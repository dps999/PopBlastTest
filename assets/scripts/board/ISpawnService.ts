export interface ISpawnService {
    /** Заполняет пустые клетки. Индексы возрастают; читать только префикс возвращённой длины. */
    spawn(cells: number[], spawnedIndices?: number[], kinds?: number[]): number;
}
