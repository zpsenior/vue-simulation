import { readXML } from "../dom/dom-reader";
import { OnEvent } from "../parser/expression";
import { HTMLNode, MapRenderContext, RenderContext } from "../parser/template";
import { leafHtmlTag } from "../utils/base";
import { loadTemplate } from "../utils/utils";
import { App, deepProxy, Ref, RefImpl } from "./base";
import { HTMLBaseBlockNode } from "./block";

interface DOM {
    name: string;
    id?: string;
    innerXml: string;
    text?: string;
    children?: DOM[];
    getAttribute(name: string): string | undefined;
    findChild(callback: (node: DOM) => DOM | undefined): DOM | undefined;
}

type AppConfig = {
    createComponents?: string[];
    template?: string;
    data?: () => any;
    methods?: Record<string, Function>;
    setup?: (app: App) => any;
}

export function createApp(cfg: AppConfig): App {
    const app = new AppImpl();
    app.bind(cfg);
    return app;
}

class AppImpl implements App {
    private readonly data: Map<string, any> = new Map();
    private readonly methods: Map<string, OnEvent> = new Map();
    private readonly context: RenderContext;
    private onLoad?: (context: RenderContext) => void;
    private container?: HTMLElement;
    private template?: string;
    private node?: HTMLNode;
    private createComponents: string[] | undefined;
    constructor() {
        this.context = new MapRenderContext(this.data, this.methods);
    }
    getVariable(key: string) {
        return this.data.get(key);
    }
    setVariable(key: string, value: any, render?: boolean) {
        this.data.set(key, value);
        if (render) {
            this.render();
        }
    }
    setData(data: any) {
        Object.keys(data).forEach(key => {
            const val = data[key];
            this.setVariable(key, val);
        });
        this.render();
    }
    querySelector(selector: string) {
        return this.container?.querySelector(selector) as HTMLElement;
    }
    querySelectorAll(selector: string) {
        return this.container?.querySelectorAll(selector) as NodeListOf<HTMLElement>;
    }
    bind(cfg: AppConfig) {
        this.createComponents = cfg.createComponents;
        this.template = cfg.template;
        if (cfg.setup) {
            this.setup(cfg.setup(this));
            return;
        }
        const data = cfg.data?.();
        if (data) {
            this.bindData(data);
        }
        if (cfg.methods) {
            this.bindMethods(cfg.methods);
        }
    }
    private setup(data: any) {
        Object.keys(data).forEach(key => {
            let val = data[key];
            if (typeof val === 'function') {
                const func = val;
                if (key === 'onLoad') {
                    this.onLoad = func;
                    return;
                }
                this.methods.set(key, (...params: any[]) => {
                    if (params) {
                        func.call(this, ...params);
                    } else {
                        func.call(this);
                    }
                });
                return;
            }
            if (val instanceof RefImpl) {
                val.name = key;
                this.data.set(key, val.value);
                return;
            }
            this.data.set(key, val);
        });
    }
    private bindData(data: any) {
        Object.keys(data).forEach(key => {
            let val = data[key];
            if (typeof val === 'function') {
                throw new Error('data can not be a function');
            }
            this.data.set(key, val);
        });
    }
    private bindMethods(methods: Record<string, Function>) {
        Object.keys(methods).forEach(key => {
            const func = methods[key];
            if (key === 'onLoad') {
                this.onLoad = (content: RenderContext) => func.call(this, content);
                return;
            }
            this.methods.set(key, (...params: any[]) => {
                if (params) {
                    func.call(this, ...params);
                } else {
                    func.call(this);
                }
            });
        });
    }
    async use(...urls: string[]) {
        let template = '';
        for (const url of urls) {
            template += await loadTemplate(url);
        }
        const dom = readDOM(template);
        dom.children?.forEach(child => {
            if (child.name == 'template') {
                const html = document.createElement('xml');
                html.id = child.id;
                html.innerHTML = child.innerXml;
                document.body.appendChild(html);
            }
        });
        if (this.createComponents) {
            await registerWebComponents(this.createComponents, template);
        }
        return template;
    }
    mount(root: HTMLElement | string) {
        if (typeof root === 'string') {
            root = document.querySelector(root) as HTMLElement;
        }
        this.container = root;
        let template = this.template ? this.template : root.innerHTML;
        const node = new HTMLNode(readDOM(template));
        this.node = node;
        if(this.onLoad) {
            this.onLoad(this.context);
        }
        const html = node.init(this.context) as HTMLElement;
        root.innerHTML = '';
        const children: HTMLElement[] = [];
        html.childNodes.forEach(node => {
            if (node instanceof HTMLElement) {
                children.push(node);
            }
        });
        children.forEach(node => {
            root.appendChild(node);
        });
    }
    /**
     * 渲染或更新应用视图
     * @throws {Error} 当应用未挂载时抛出错误
     */
    render() {
        if (!this.node || !this.container) {
            throw new Error('app not mounted');
        }
        const container = this.container;
        const html = this.node.update(this.context) as HTMLElement;
        const children: HTMLElement[] = [];
        html.childNodes.forEach(node => {
            if (node instanceof HTMLElement) {
                children.push(node);
            }
        });
        children.forEach(node => {
            container.appendChild(node);
        });
    }
    ref<T>(val: T): Ref<T> {
        return new RefImpl(this, val);
    }
    reactive(val: any) {
        if (!val || typeof val !== 'object') {
            throw new Error('reactive must be an object');
        }
        return deepProxy(this, val);
    }
    readonly cache: WeakMap<any, any> = new WeakMap();
}

function readDOM(template: string) {
    template = template.trim();
    if (!template.startsWith('<template>') || !template.endsWith('</template>')) {
        template = `<template>${template}</template>`;
    }
    const dom = readXML(template, { leafTags: new Set(leafHtmlTag) });
    return dom;
}

export async function registerWebComponents(componentNames: string[], template: string | (() => Promise<string>)) {
    const dom = readDOM(typeof template === 'function' ? await template() : template);
    componentNames.forEach(componentName => {
        const child = dom.findChild((node) => {
            if (node.name == 'template' && node.id == componentName) {
                return node;
            }
        })
        if (!child) {
            throw new Error(`can not find template[${componentName}]`);
        }
        const component = registerWebComponent(child);
        customElements.define('vs-' + componentName, component);
    });
}

function readTemplate(dom: DOM) {
    const props: { name: string, type: string }[] = [];
    const domProps: DOM | undefined = dom.findChild((node) => {
        if (node.name == 'props') {
            return node;
        }
    });
    if (domProps) {
        domProps.children?.forEach((node) => {
            if (node.name != 'prop') {
                return;
            }
            const name = node.getAttribute('name');
            const type = node.getAttribute('type') || 'string';
            if (name) {
                if (!['string', 'number', 'json'].includes(type)) {
                    throw new Error(`type[${type}] is not supported for prop[${name}]`);
                }
                props.push({ name, type });
            }
        })
    }
    const domTemplate: DOM | undefined = dom.findChild((node) => {
        if (node.name == 'template') {
            return node;
        }
    });
    if (!domTemplate) {
        throw new Error('can not find template');
    }
    const template = domTemplate.innerXml;
    const domStyle: DOM | undefined = dom.findChild((node) => {
        if (node.name == 'style') {
            return node;
        }
    });
    const style = domStyle?.text;
    const domScript: DOM | undefined = dom.findChild((node) => {
        if (node.name == 'script') {
            return node;
        }
    });
    const script = domScript?.text;
    return {
        props,
        template,
        style,
        script,
    }
}

function registerWebComponent(dom: DOM) {
    const { props, template, style, script } = readTemplate(dom);
    const component = class extends HTMLBaseBlockNode {
        static get observedAttributes() { return props.map((item) => item.name); };
        attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
            if (oldValue != newValue) {
                this.setVariable(attrName, this.parseValue(newValue, attrName));
            }
        }
        constructor() {
            super();
            this.bindTemplate({ template, style, script, props });
        }
    }
    return component;
}