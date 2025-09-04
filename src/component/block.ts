import { readXML } from "../dom/dom-reader";
import { OnEvent } from "../parser/expression";
import { HTMLNode, MapRenderContext, RenderContext } from "../parser/template";
import { leafHtmlTag } from "../utils/base";
import { deepProxy, ProxyCache, Ref, RefImpl, VariableContainer } from "./base";

export const COM_BLOCK_NODE = 'vs-block';

export abstract class HTMLBaseBlockNode extends HTMLElement implements VariableContainer, ProxyCache {
    readonly cache: WeakMap<any, any> = new WeakMap();
    private _shadowRoot: ShadowRoot;
    private _style: HTMLStyleElement;
    private _context: RenderContext;
    private _events: Map<string, OnEvent> = new Map();
    private _vars: Map<string, any> = new Map();
    private _html: HTMLElement | undefined;
    private init?: (self: HTMLElement) => void;
    private props?: { name: string, type: string }[] = [];
    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
        this._shadowRoot.innerHTML = '<style></style><slot/>';
        this._style = this._shadowRoot.querySelector('style') as HTMLStyleElement;
        this._context = new MapRenderContext(this._vars, this._events);
    }
    protected bindTemplate(params: { template: string, style?: string, script?: string, props?: { name: string, type: string }[] }) {
        const { template, style, script, props } = params;
        this.props = props;
        if (style) {
            this._style.innerText = style;
        }
        if (script) {
            this._vars.clear();
            this._events.clear();
            let content = script;
            content = content.replace(/\bthis\b/g, '_this')
            const obj = (new Function('_this', content))(this);
            if (obj) {
                this.bind(obj);
            }
        }
        //console.log('template:' + template);
        const dom = readXML(template, { leafTags: new Set(leafHtmlTag) });
        this._root = new HTMLNode(dom);
        this._html = undefined;
    }
    private bind(script: any) {
        Object.keys(script).forEach((key) => {
            const val = script[key];
            if (typeof val == 'function') {
                if (key == 'init') {
                    this.init = val;
                } else {
                    this.setEvent(key, val);
                }
            } else {
                if (val instanceof RefImpl) {
                    val.name = key;
                    this.setVariable(key, val.value);
                    return;
                }
                this.setVariable(key, val);
            }
        })
    }
    private setEvent(name: string, val: OnEvent) {
        this._events.set(name, val);
    }
    setVariable(name: string, val: any) {
        this._context.setVariable(name, val);
    }
    getVariable(name: string) {
        return this._context.getVariable(name);
    }
    findSelector(selector: string) {
        return this._shadowRoot.querySelector(selector);
    }
    findSelectorAll(selector: string) {
        return this._shadowRoot.querySelectorAll(selector);
    }
    reactive(val: any) {
        if (!val || typeof val !== 'object') {
            throw new Error('reactive must be an object');
        }
        return deepProxy(this, val);
    }
    ref<T>(val: T): Ref<T> {
        return new RefImpl(this, val);
    }
    private _root: HTMLNode | undefined;
    render() {
        this.getAttributeNames().forEach((name) => {
            if (name == 'template') {
                return;
            }
            const val = this.getAttribute(name);
            this.setVariable(name, this.parseValue(val, name));
        });
        const root = this._root;
        if (!root) {
            return;
        }
        if (root.loop) {
            throw new Error("root element can not be a loop");
        } else if (root.condition) {
            throw new Error("root element can not be a condition");
        }
        if (!this._html) {
            this._html = root.init(this._context) as HTMLElement;
            //console.log("init  render:" + this._html)
            this._shadowRoot.insertBefore(this._html, this._style.nextSibling);
            if (this.init) {
                this.init(this);
            }
        } else {
            root.update(this._context);
            const elements = root.elements;
            elements.clear();
            //console.log("update render:", html);
        }
        return this._html;
    }
    protected parseValue(val: string | null, name: string): any {
        const type = this.props?.find((item) => item.name == name)?.type || 'string';
        if (!val || type == 'string') {
            return val;
        }
        if (type == 'number') {
            const num = Number(val);
            if (Number.isFinite(num)) {
                return num;
            }
            throw new Error(`value[${val}] is not a number for prop[${name}]`);
        } else if (type == 'json') {
            val = JSON.parse(val);
        } else {
            throw new Error(`type[${type}] is not supported for prop[${name}]`);
        }
        return val;
    }
    connectedCallback() {
        this.render();
    }
}

export class HTMLBlockNode extends HTMLBaseBlockNode {
    static get observedAttributes() { return ['template'] };
    attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
        if (attrName == 'template' && oldValue != newValue) {
            const ele = document.querySelector(`xml[id="${newValue}"]`) as HTMLTemplateElement;
            if (!ele) {
                console.error(`can not find xml[${newValue}]`);
                return;
            }
            this.bindTemplateNode(ele);
        }
    }
    private observer: MutationObserver;
    constructor() {
        super();
        this.observer = new MutationObserver((mutations) => {
            // 遍历所有属性变化记录
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    const attrName = mutation.attributeName!;
                    if (attrName == 'template') {
                        return;
                    }
                    const oldValue = mutation.oldValue;
                    const newValue = this.getAttribute(attrName);
                    if (oldValue != newValue) {
                        this.setVariable(attrName, this.parseValue(newValue, attrName));
                    }
                }
            });
        });
    }
    protected bindTemplateNode(root: HTMLElement) {
        const eleStyle = root.querySelector('style');
        const style = eleStyle?.innerText || '';
        const eleScript = root.querySelector('script');
        let script = eleScript?.textContent || '';
        let template = '';
        if (eleStyle || eleScript) {
            const eleTemplate = root.querySelector('template');
            if (!eleTemplate) {
                throw new Error(`can not find sub template in template[${root.id}]`);
            }
            template = eleTemplate.innerHTML;
        } else {
            template = root.textContent || '';
        }
        this.bindTemplate({ template, style, script });
    }
    appendChild<T extends Node>(node: T): T {
        if ((node instanceof HTMLElement) && node.tagName == 'XML') {
            this.bindTemplateNode(node);
        }
        return super.appendChild(node);
    }
    connectedCallback() {
        this.observer.observe(this, { attributes: true });
        super.connectedCallback();
    }
    disconnectedCallback() {
        // 停止观察，避免内存泄漏
        this.observer.disconnect();
    }
}

if (customElements.get(COM_BLOCK_NODE) == null) {
    customElements.define(COM_BLOCK_NODE, HTMLBlockNode);
}