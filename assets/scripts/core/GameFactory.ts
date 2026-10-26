/** Компонент, которому фабрика передаёт зависимости после создания Cocos. */
export interface IInitializable<TDependencies> {
    init(dependencies: TDependencies): void;
}

/** Единая точка создания игровых компонентов с явным внедрением зависимостей. */
export class GameFactory {
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
