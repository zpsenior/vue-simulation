import { readXML } from "../dom/dom-reader";
import { HTMLNode, RenderContext } from "../parser/template";


export interface ProxyCache {
    readonly cache: WeakMap<any, any>;
    render(): void;
}

export interface VariableContainer {
    /**
     * 获取应用数据中的指定变量
     * @param key 变量名
     * @returns 变量值
     */
    getVariable(key: string): any;
    /**
     * 设置应用数据中的指定变量
     * @param key 变量名
     * @param value 变量值
     * @param render 是否在设置后立即渲染视图
     */
    setVariable(key: string, value: any, render?: boolean): void;
}

export interface App extends ProxyCache, VariableContainer {
    /**
     * 批量设置应用数据并渲染视图
     * @param kv 键值对对象
     */
    setData(data: any): void;
    /**
     * 在容器中查询匹配指定选择器的第一个元素
     * @param selector CSS选择器
     * @returns 匹配的HTML元素或undefined
     */
    querySelector(selector: string): HTMLElement | undefined;
    /**
     * 在容器中查询匹配指定选择器的所有元素
     * @param selector CSS选择器
     * @returns 匹配的HTML元素集合或undefined
     */
    querySelectorAll(selector: string): NodeListOf<HTMLElement> | undefined;
    /**
     * 加载指定URL的模板文件
     * @param urls 模板文件URL,可加载多个
     * @returns 模板内容
     */
    use(...urls: string[]): Promise<string>;
    /**
     * 将应用挂载到指定的DOM元素上
     * @param root 挂载点，可以是DOM元素或选择器字符串
     */
    mount(root: HTMLElement | string): void;
    /**
     * 渲染或更新应用视图
     */
    render(): void;
    ref<T>(val: T): Ref<T>;
    reactive<T extends Object>(val: T): T;
}

export abstract class Ref<T> {
    abstract get value(): T;
    abstract set value(val: T);
}

export class RefImpl<T> extends Ref<T> {
    name: string = '';
    private app: VariableContainer;
    private _value: T;
    constructor(app: VariableContainer, val: T) {
        super();
        this.app = app;
        this._value = val;
    }
    get value() {
        return this._value;
    }
    set value(val: T) {
        if (this._value !== val) {
            this._value = val;
            this.app.setVariable(this.name, val, true);
        }
    }
}

export function deepProxy(app: ProxyCache, val: any) {
    if (!val || typeof val !== 'object') {
        return val;
    }
    const cache = app.cache;
    if (cache.has(val)) {
        return cache.get(val);
    }
    const proxy = new Proxy(val, {
        get(target, prop) {
            const value = Reflect.get(target, prop);
            return deepProxy(app, value);
        },
        set(target, prop, value) {
            const oldValue = Reflect.get(target, prop);
            if (oldValue !== value) {
                const res = Reflect.set(target, prop, value);
                if (res) {
                    app.render();
                } else {
                    console.error(`set [${prop.toString()}] failed: `, target);
                }
            }
            return false;
        }
    });
    cache.set(val, proxy);
    return proxy;
}

export abstract class HTMLBase extends HTMLElement {
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue !== newValue) {
            if (!this.updateAttribute(name, newValue)) {
                this.setVariable(name, this.parseVariable(newValue));
            }
        }
        if (this.parentElement) {
            this.render();
        }
    }
    protected updateAttribute(_name: string, _value: string): boolean {
        return false;
    }

    private _context: RenderContext;
    private _root: HTMLNode;
    private _style: HTMLStyleElement;
    private _html: HTMLElement | undefined;
    private _shadowRoot: ShadowRoot;
    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
        this._style = document.createElement('style');
        this.bindStyle(this._style);
        this._shadowRoot.appendChild(this._style);
        this._context = this.buildContext();
        const dom = readXML(this.buildTemplate());
        this._root = new HTMLNode(dom);
    }
    protected render() {
        if (this._root.loop) {
            throw new Error("root element can not be a loop");
        } else if (this._root.condition) {
            throw new Error("root element can not be a condition");
        }
        if (!this._html) {
            this._html = this._root.init(this._context) as HTMLElement;
            //console.log("init  render:" + this._html)
            this._shadowRoot.appendChild(this._html);
        } else {
            this._root.update(this._context);
            const elements = this._root.elements;
            elements.clear();
            //console.log("update render:", html);
        }
        return this._html;
    }
    protected abstract buildContext(): RenderContext;
    protected abstract bindStyle(style: HTMLStyleElement): void;
    protected abstract buildTemplate(): string;
    protected setVariable(name: string, val: any) {
        this._context.setVariable(name, val);
    }
    protected getVariable(name: string) {
        return this._context.getVariable(name);
    }
    protected setData(params: any) {
        if (!this._context) {
            throw new Error("context is empty!");
        }
        if (typeof params != 'object') {
            throw new Error("params is not Object!");
        }
        const context = this._context;
        for (const item of Object.entries(params)) {
            const key = item[0];
            const value = item[1];
            context.setVariable(key, value);
        }
        this.render();
    }
    protected findSelector(selector: string) {
        return this._html?.querySelector(selector);
    }
    protected findSelectorAll(selector: string) {
        return this._html?.querySelectorAll(selector);
    }
    protected parseVariable(value: string) {
        if (value == 'undefined' || value == 'null') {
            return null;
        }
        return value;
    }
    connectedCallback() {
        this.render();
    }
}