import { HTMLNode, MapRenderContext } from "../parser/template";
import { deepProxy, App, Ref, RefImpl } from "./base";
import { loadTemplate } from "../utils/utils";

interface AppConfig {
    data?: any;
    template?: string;
    methods?: { [key: string]: Function };
    onLoad?: Function;
}

export function createApp(config: AppConfig): App {
    const app = new AppImpl(config);
    return app;
}

class AppImpl implements App {
    private _cache: WeakMap<any, any> = new WeakMap();
    private _context: MapRenderContext;
    private _root: HTMLElement | undefined;
    private _template: string | undefined;
    private _node: HTMLNode | undefined;
    private _config: AppConfig;
    private _refs: Map<string, Ref<any>> = new Map();

    constructor(config: AppConfig) {
        this._config = config || {};
        this._context = new MapRenderContext();
        this._template = this._config.template;

        // 初始化数据
        if (this._config.data) {
            for (const key of Object.keys(this._config.data)) {
                this.setVariable(key, this._config.data[key], false);
            }
        }

        // 初始化方法
        if (this._config.methods) {
            for (const key of Object.keys(this._config.methods)) {
                this.setVariable(key, this._config.methods[key].bind(this), false);
            }
        }

        // 绑定this到方法
        const self = this;
        this.setVariable('this', new Proxy({}, {
            get(_, prop) {
                if (prop === 'setVariable') {
                    return self.setVariable.bind(self);
                }
                if (prop === 'getVariable') {
                    return self.getVariable.bind(self);
                }
                if (prop === 'setData') {
                    return self.setData.bind(self);
                }
                return self.getVariable(prop as string);
            }
        }), false);

        // 调用onLoad钩子
        if (this._config.onLoad) {
            this._config.onLoad.bind(this)();
        }
    }

    get cache(): WeakMap<any, any> {
        return this._cache;
    }

    getVariable(key: string): any {
        return this._context.getVariable(key);
    }

    setVariable(key: string, value: any, render: boolean = true): void {
        // 处理ref对象
        if (value instanceof RefImpl) {
            value.name = key;
            this._refs.set(key, value);
        }

        // 深度代理对象
        if (value && typeof value === 'object') {
            value = deepProxy(this, value);
        }

        // 设置变量
        this._context.setVariable(key, value);

        // 渲染视图
        if (render && this._root) {
            this.render();
        }
    }

    setData(data: any): void {
        for (const key of Object.keys(data)) {
            this.setVariable(key, data[key], false);
        }
        if (this._root) {
            this.render();
        }
    }

    querySelector(selector: string): HTMLElement | undefined {
        if (!this._root) {
            return undefined;
        }
        return this._root.querySelector(selector) as HTMLElement;
    }

    querySelectorAll(selector: string): NodeListOf<HTMLElement> | undefined {
        if (!this._root) {
            return undefined;
        }
        return this._root.querySelectorAll(selector) as NodeListOf<HTMLElement>;
    }

    async use(...urls: string[]): Promise<string> {
        let template = '';
        for (const url of urls) {
            const tpl = await loadTemplate(url);
            template += tpl;
        }
        this._template = template;
        return template;
    }

    mount(root: HTMLElement | string): void {
        if (typeof root === 'string') {
            const element = document.querySelector(root);
            if (!element) {
                throw new Error(`Cannot find element with selector: ${root}`);
            }
            this._root = element as HTMLElement;
        } else {
            this._root = root;
        }

        // 渲染视图
        this.render();
    }

    render(): void {
        if (!this._root || !this._template) {
            return;
        }

        // 清空容器
        while (this._root.firstChild) {
            this._root.removeChild(this._root.firstChild);
        }

        // 解析模板
        const dom = readDOM(this._template);
        if (!dom) {
            return;
        }

        // 创建节点并初始化
        this._node = new HTMLNode(dom);
        const html = this._node.init(this._context);

        // 添加到容器
        if (html) {
            this._root.appendChild(html);
        }
    }

    ref<T>(val: T): Ref<T> {
        return new RefImpl<T>(this, val);
    }

    reactive<T extends Object>(val: T): T {
        return deepProxy(this, val);
    }
}

// 读取DOM内容
function readDOM(template: string): any {
    // 创建临时容器
    const container = document.createElement('div');
    container.innerHTML = template;

    // 递归处理子节点
    function processNode(node: Node): any {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const result: any = {
                name: element.tagName.toLowerCase(),
                attributes: {},
                children: []
            };

            // 处理属性
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                result.attributes[attr.name] = attr.value;
            }

            // 处理子节点
            for (let i = 0; i < element.childNodes.length; i++) {
                const child = processNode(element.childNodes[i]);
                if (child) {
                    result.children.push(child);
                }
            }

            return result;
        } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim() || '';
            if (text) {
                return {
                    type: 'text',
                    content: text
                };
            }
        }
        return null;
    }

    // 处理容器的子节点
    const result: any = {
        name: 'div',
        attributes: {},
        children: []
    };

    for (let i = 0; i < container.childNodes.length; i++) {
        const child = processNode(container.childNodes[i]);
        if (child) {
            result.children.push(child);
        }
    }

    return result;
}

// 注册Web组件
export function registerWebComponents() {
    // 查找所有的template标签
    const templates = document.querySelectorAll('template');

    // 处理每个template
    templates.forEach(template => {
        const id = template.id;
        if (!id) {
            return;
        }

        // 读取模板内容
        const content = template.innerHTML;
        if (!content) {
            return;
        }

        // 定义自定义元素
        customElements.define(`template-${id}`, class extends HTMLElement {
            constructor() {
                super();
                const shadowRoot = this.attachShadow({ mode: 'open' });
                shadowRoot.innerHTML = content;
            }
        });
    });

    // 查找所有的script[type="text/template"]标签
    const scriptTemplates = document.querySelectorAll('script[type="text/template"]');

    // 处理每个script[type="text/template"]
    scriptTemplates.forEach(script => {
        const id = script.id;
        if (!id) {
            return;
        }

        // 读取模板内容
        const content = script.textContent || '';
        if (!content) {
            return;
        }

        // 定义自定义元素
        customElements.define(`template-${id}`, class extends HTMLElement {
            constructor() {
                super();
                const shadowRoot = this.attachShadow({ mode: 'open' });
                shadowRoot.innerHTML = content;
            }
        });
    });
}

// 读取模板
function readTemplate(template: string): { props: any, template: string, style: string, script: string } {
    // 创建临时容器
    const container = document.createElement('div');
    container.innerHTML = template;

    // 查找props
    const propsEl = container.querySelector('props');
    const props = propsEl ? JSON.parse(propsEl.textContent || '{}') : {};

    // 查找template
    const templateEl = container.querySelector('template');
    const templateContent = templateEl ? templateEl.innerHTML : '';

    // 查找style
    const styleEl = container.querySelector('style');
    const styleContent = styleEl ? styleEl.textContent || '' : '';

    // 查找script
    const scriptEl = container.querySelector('script');
    const scriptContent = scriptEl ? scriptEl.textContent || '' : '';

    return {
        props,
        template: templateContent,
        style: styleContent,
        script: scriptContent
    };
}

// 注册Web组件
function registerWebComponent(name: string, template: string) {
    // 读取模板内容
    const { props, template: templateContent, style, script } = readTemplate(template);

    // 创建自定义元素类
    class WebComponent extends HTMLBaseBlockNode {
        static get observedAttributes() {
            return Object.keys(props);
        }

        constructor() {
            super();
            this._template = templateContent;
            this._style = style;
        }

        buildContext() {
            const context = new MapRenderContext();
            
            // 设置props
            for (const [key, value] of Object.entries(props)) {
                context.setVariable(key, value);
            }

            // 执行脚本
            if (script) {
                const fn = new Function('return ' + script)();
                if (fn && typeof fn === 'object') {
                    if (fn.data) {
                        for (const [key, value] of Object.entries(fn.data)) {
                            context.setVariable(key, value);
                        }
                    }
                    if (fn.methods) {
                        for (const [key, value] of Object.entries(fn.methods)) {
                            context.setVariable(key, value.bind(this));
                        }
                    }
                    if (fn.init) {
                        fn.init.bind(this)();
                    }
                }
            }

            return context;
        }
    }

    // 注册自定义元素
    customElements.define(name, WebComponent);

    return WebComponent;
}

// 为了避免编译错误，临时定义HTMLBaseBlockNode
class HTMLBaseBlockNode extends HTMLElement {
    _template: string = '';
    _style: string = '';
    buildContext() { return {}; }
}