/** Компонент, которому фабрика передаёт зависимости после создания Cocos. */
export interface IInitializable<TDependencies> {
    init(dependencies: TDependencies): void;
}