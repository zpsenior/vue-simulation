import { JDOM, NodePos } from "../utils/base";
import { StringPrinter, uuid } from "../utils/utils";
import { EVENT_HTML_NODE_CLICK, EVENT_TREE_NODE_RIGHT_CLICK } from "../utils/base";
import { MatchElement, XSDAttribute, XSDElement } from "../xsd/xsd";

export class DOMStyleClass {

    private _classArray: string[];
    constructor(styleClass?: string) {
        if (!styleClass) {
            this._classArray = [];
            return;
        }
        this._classArray = styleClass.split(" ").map((item) => {
            return item.trim();
        });
    }

    public add(styleClass: string) {
        for (const item of this._classArray) {
            if (item == styleClass) {
                return;
            }
        }
        this._classArray.push(styleClass);
    }

    public remove(styleClass: string) {
        for (let i = 0; i < this._classArray.length; i++) {
            const item = this._classArray[i];
            if (item == styleClass) {
                this._classArray.splice(i, 1);
                return;
            }
        }
    }
    public get size() {
        return this._classArray.length;
    }
    public toggle(styleClass: string) {
        if (this.has(styleClass)) {
            this.remove(styleClass);
        } else {
            this.add(styleClass);
        }
    }
    public list() {
        return [...this._classArray];
    }
    public has(styleClass: string) {
        for (const item of this._classArray) {
            if (item == styleClass) {
                return true;
            }
        }
        return false;
    }
    public clear() {
        this._classArray = [];
    }
    public toString() {
        return this._classArray.join(" ");
    }
}

export class DOMStyle {
    private _styleMap: Map<string, string>;

    constructor(style?: string) {
        this._styleMap = new Map();
        if (!style) {
            return;
        }
        style.split(";").forEach((item) => {
            const arr = item.split(":");
            if (arr.length == 2) {
                const key = arr[0].trim();
                const value = arr[1].trim();
                this._styleMap.set(key, value);
            }
        });
    }
    public get(key: string) {
        return this._styleMap.get(key);
    }
    public has(key: string) {
        return this._styleMap.has(key);
    }
    public get size() {
        return this._styleMap.size;
    }
    public set(key: string, value: string | null | undefined) {
        if (!value) {
            this._styleMap.delete(key);
            return;
        }
        this._styleMap.set(key, value);
    }
    public remove(key: string) {
        this._styleMap.delete(key);
    }
    public clear() {
        this._styleMap.clear();
    }

    public forEach(call: (value: string, key: string) => void) {
        this._styleMap.forEach(call);
    }
    public toString() {
        let style = "";
        for (const [key, value] of this._styleMap) {
            if (value) {
                style += key + ":" + value + ";";
            }
        }
        return style;
    }
}

export class DOMAttributes {
    private _attributeMap: Map<string, string>;
    private _attributeNames?: Set<string>;
    private _defaultValues?: Map<string, string>;
    private _fixed: Set<string>;

    constructor(xsd?: XSDElement, maps?: Map<string, string>) {
        this._fixed = new Set();
        if (xsd) {
            this._attributeNames = new Set(xsd.attributeNames());
            if (this._attributeNames.size > 0) {
                const defaultValues = new Map();
                this._attributeNames.forEach((key) => {
                    const attr = xsd.findAttribute(key);
                    if (attr instanceof XSDAttribute) {
                        defaultValues.set(key, attr.defaultValue || attr.fixed);
                        if (attr.fixed != undefined) {
                            this._fixed.add(key);
                        }
                    }
                });
                this._defaultValues = defaultValues;
            }
        }
        this._attributeMap = new Map();
        if (maps) {
            maps.forEach((value, key) => {
                this._attributeMap.set(key, value);
            });
        }
    }
    public get(key: string) {
        return this._attributeMap.get(key) || this._defaultValues?.get(key);
    }

    public set(key: string, value: string | null | undefined) {
        if (this._attributeNames) {
            if (!this._attributeNames.has(key)) {
                throw new Error(`not support attribute[${key}] in this node`);
            }
        }
        if (this._fixed.has(key)) {
            throw new Error(`attribute[${key}] in this node is fixed`);
        }
        if (!value) {
            this._attributeMap.delete(key);
            return;
        }
        this._attributeMap.set(key, value);
    }
    has(name: string) {
        return this._attributeMap.has(name);
    }
    get size() {
        return this._attributeMap.size;
    }
    defaultValue(name: string) {
        return this._defaultValues?.get(name);
    }
    public forEach(call: (value: string, key: string) => void) {
        this._attributeMap.forEach(call);
    }
    public find(call: (value: string, key: string) => string | undefined) {
        for (const item of this._attributeMap) {
            const res = call(item[1], item[0]);
            if (res) {
                return item[0];
            }
        }
    }
    public validate(xsd: MatchElement, xpath: string, errors: string[]) {
        this._attributeMap.forEach((value, key) => {
            const error = xsd.matchAttribute(xpath, key, value)
            if (error) {
                errors.push(`attribute[${key}] not match xsd element[${xpath}]`);
                return;
            }
        });
    }
    names() {
        return this._attributeNames ? [...this._attributeNames] : undefined;
    }
    hasName(name: string) {
        return this._attributeNames ? this._attributeNames.has(name) : true;
    }
}

export abstract class DOM {
    private _xsd?: XSDElement;
    readonly parent: DOM | null;
    readonly name: string;
    readonly id: string;
    private _text?: string;
    private _raw: boolean = false;
    private _attributes?: DOMAttributes;
    private _styleClass?: DOMStyleClass;
    private _style?: DOMStyle;
    private _children?: DOM[];
    private _merged: boolean = false;

    public abstract get node(): HTMLElement;

    constructor(parent: XSDElement | DOM | null | undefined, name: string, attrs: any, id?: string) {
        if (!parent) {
            this.parent = null;
        } else if (parent instanceof XSDElement) {
            if (parent.name != name) {
                throw new Error(`${name} not match xsd element[${parent.name}]`);
            }
            this._xsd = parent;
            this.parent = null;
        } else {
            this.parent = parent;
            if (parent.xsd) {
                const xsd = parent.xsd.findElement(name);
                if (!xsd) {
                    throw new Error(`not find xsd element: ${name}`);
                }
                this._xsd = xsd as XSDElement;
            }
        }
        this.name = name;
        this.id = id || this.getId(attrs) || uuid();
        this.buildAttributes(this.xsd, attrs);
    }

    private getId(attrs: any) {
        if (attrs) {
            if (attrs instanceof Map) {
                return attrs.get('id');
            }
            return attrs.id;
        }
    }

    private buildAttributes(xsd: XSDElement | undefined, attrs: any) {
        const attributes = new Map();
        if (attrs && attrs instanceof Map) {
            for (const [key, value] of attrs) {
                if (key == 'id') {
                    continue;
                }
                if (key == 'class' && value) {
                    this._styleClass = new DOMStyleClass(value);
                    continue;
                }
                if (key == 'style' && value) {
                    this._style = new DOMStyle(value);
                    continue;
                }
                attributes.set(key, value);
            }
        } else if (attrs) {
            for (const key of Object.keys(attrs)) {
                if (key == 'id') {
                    continue;
                }
                const value = attrs[key];
                if (key == 'class' && value) {
                    this._styleClass = new DOMStyleClass(value);
                    continue;
                }
                if (key == 'style' && value) {
                    this._style = new DOMStyle(value);
                    continue;
                }
                //console.log("   " + key + ": " + value);
                attributes.set(key, value);
            }
        }
        if (xsd && attributes.size > 0) {
            const errors: string[] = [];
            attributes.forEach((value, key) => {
                const error = xsd.matchAttribute(this.xpath, key, value);
                if (error) {
                    errors.push(error);
                }
            });
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
        }
        if (xsd || attributes.size > 0) {
            this._attributes = new DOMAttributes(xsd, attributes);
        }
    }

    public get xsd() {
        return this._xsd;
    }
    get attributes() {
        return this._attributes;
    }
    get styleClass() {
        if (!this._styleClass) {
            this._styleClass = new DOMStyleClass();
        }
        return this._styleClass;
    }
    get style() {
        if (!this._style) {
            this._style = new DOMStyle();
        }
        return this._style;
    }
    get children() {
        return this._children;
    }
    get text() {
        if (this._text) {
            return this._text;
        }
    }
    get raw() {
        return this._raw;
    }
    get xpath(): string {
        return this.parent ? this.parent.xpath + '/' + this.name : this.name;
    }
    get merged() {
        return this._merged;
    }

    public validateAll(errors: string[]) {
        this.validate(errors);
        if (this._children) {
            const count = this._children.length;
            for (let i = 0; i < count; i++) {
                const child = this._children[i];
                if (child && child instanceof DOM) {
                    child.validate(errors);
                }
            }
        }
    }
    public validate(errors: string[]) {
        if (!this._xsd) {
            return;
        }
        this._attributes?.validate(this._xsd, this.xpath, errors);
        this.validateChildren(this._xsd, errors);
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }
    private validateChildren(xsd: MatchElement, errors: string[]) {
        if (!this._children) {
            return;
        }
        let childNames: string[] = [];
        this._children.forEach((child) => {
            if (child instanceof DOM) {
                childNames.push(child.name);
            }
        })
        const childMatchers = xsd.childList();
        for (const matcher of childMatchers) {
            const { status, msg, names } = matcher.match(childNames, 0);
            if (!status) {
                errors.push(`${this.xpath}: ${msg}`);
                return;
            }
            childNames = names as string[];
        }
        if (childNames.length > 0) {
            errors.push(`节点【${this.xpath}】的子节点【${childNames.join(',')}】未能匹配`);
            return false;
        }
        return true;
    }
    public getChild(name: string): DOM {
        if (this._children) {
            for (const child of this._children) {
                if (child.name == name) {
                    return child;
                }
            }
        }
        throw new Error('not find child: ' + name);
    }
    public mergeChild(merge: boolean) {
        const children = this.children;
        if (children) {
            for (const child of children) {
                child.merge(merge);
            }
        }
    }
    private merge(merge: boolean) {
        this._merged = merge;
        const children = this.children;
        if (children) {
            for (const child of children) {
                child.merge(merge);
            }
        }
    }
    public get root() {
        let root: DOM = this;
        while (root.parent) {
            root = root.parent;
        }
        return root;
    }
    public setText(text: string, raw?: boolean) {
        if (this.children) {
            throw new Error('dom has children can not bind text!');
        }
        if (text) {
            this._text = text;
            this._raw = raw == true || text.startsWith('<![CDATA[') && text.endsWith(']]>');
        }
    }
    public modifyText(text: string, raw?: boolean) {
        this.setText(text, raw);
        if (text && this.node) {
            if (raw) {
                this.node.innerHTML = text;
            } else {
                this.node.innerText = text;
            }
        }
    }
    public hasAttribute(name: string) {
        if (this._attributes) {
            return this._attributes.has(name);
        }
        return false;
    }
    public getAttribute(name: string) {
        if (this._attributes) {
            return this._attributes.get(name);
        }
    }
    public modifyAttribute(name: string, value: string | null | undefined) {
        this.setAttribute(name, value);
        if (this.node) {
            if (!value) {
                this.node.removeAttribute(name);
                return;
            }
            this.node.setAttribute(name, value);
        }
    }
    public setAttribute(name: string, value: string | null | undefined) {
        if (name == 'id') {
            throw new Error('can not set attribute[id]!');
        }
        if (name == 'class') {
            if (value) {
                this._styleClass = new DOMStyleClass(value);
            } else {
                this._styleClass?.clear();
            }
        } else if (name == 'style') {
            if (value) {
                this._style = new DOMStyle(value);
            } else {
                this._style?.clear();
            }
        } else {
            if (!this._attributes) {
                this._attributes = new DOMAttributes(this.xsd);
            }
            this._attributes.set(name, value);
        }
    }
    protected bindNodeEvent(element: HTMLElement) {
        if (!element.onclick) {
            element.onclick = (e) => {
                if (this.merged) {
                    return;
                }
                const ele = e.target as HTMLElement;
                const event = new CustomEvent(EVENT_HTML_NODE_CLICK, {
                    bubbles: true, // 是否冒泡
                    cancelable: true, // 是否可取消
                    detail: {
                        domId: this.id,
                        ctrlKey: e.ctrlKey,
                        altKey: e.altKey,
                        shiftKey: e.shiftKey,
                    }
                });
                console.log(`click: ${this.id}`)
                ele.dispatchEvent(event);
                e.stopPropagation();
            };
        }
        if (!element.oncontextmenu) {
            element.oncontextmenu = (e) => {
                if (this.merged) {
                    return;
                }
                const ele = e.target as HTMLElement;
                const event = new CustomEvent(EVENT_TREE_NODE_RIGHT_CLICK, {
                    bubbles: true, // 是否冒泡
                    cancelable: true, // 是否可取消
                    detail: {
                        x: e.clientX,
                        y: e.clientY,
                        domId: this.id
                    }
                });
                console.log(`right click: ${this.id}`)
                ele.dispatchEvent(event);
                e.stopPropagation();
                e.preventDefault();
            };
        }
    }
    public move(pos: NodePos) {
        const parent = this.parent;
        if (!parent) {
            throw new Error('parent is null!');
        }
        /*console.log('move before');
        parent.children?.forEach((child, index)=> {
            console.log(`${index}: ${child.id}`);
        });*/
        if (!pos.beforeId && !pos.afterId) {
            throw new Error('beforeId or afterId is empty!');
        }
        const before = !pos.beforeId ? undefined : parent.findChild((dom) => {
            if (dom.id == pos.beforeId) {
                return dom;
            }
        });
        const after = !pos.afterId ? undefined : parent.findChild((dom) => {
            if (dom.id == pos.afterId) {
                return dom;
            }
        });
        this.moveNode({ before: before?.node, after: after?.node });
        parent.moveChild(this, pos);
        /*console.log('move after');
        parent.children?.forEach((child, index)=> {
            console.log(`${index}: ${child.id}`);
        });*/
    }
    private moveNode(pos: { before?: HTMLElement, after?: HTMLElement }) {
        const parent = this.node.parentElement;
        if (!parent) {
            throw new Error('parent html is null!');
        }
        if (pos.before) {
            parent.insertBefore(this.node, pos.before);
        } else if (pos.after) {
            const nextSibling = pos.after.nextElementSibling;
            if (nextSibling) {
                parent.insertBefore(this.node, nextSibling);
            } else {
                parent.appendChild(this.node);
            }
        } else {
            throw new Error(`can not find before or after element`);
        }
    }
    private moveChild(newChild: DOM, pos: NodePos) {
        const oldIndex = this.findChild((child, index) => {
            if (child.id == newChild.id) {
                return index;
            }
        })
        if (oldIndex == undefined) {
            throw new Error(`can not find child[${newChild.id}] in parent[${this.id}]`);
        }
        const idx = this.findChild((child, index) => {
            if (pos.beforeId && child.id == pos.beforeId) {
                this._children?.splice(index, 0, newChild);
                return index;
            } else if (pos.afterId && child.id == pos.afterId) {
                this._children?.splice(index + 1, 0, newChild);
                return index;
            }
        });
        //console.log(`oldIndex: ${oldIndex}, idx: ${idx}, pos: { before: ${pos.beforeId}, after: ${pos.afterId} }`);
        if (idx != undefined) {
            if (idx > oldIndex) {
                this._children?.splice(oldIndex, 1);
            } else if (idx < oldIndex) {
                this._children?.splice(oldIndex + 1, 1);
            }
        }
    }
    public addChild(newChild: DOM, pos?: NodePos) {
        if (!newChild) {
            console.error('newChild is null!');
            return;
        }
        if (this.text) {
            throw new Error('can not add child in text node!');
        }
        if (!this._children) {
            this._children = [];
        }
        if (!pos) {
            this._children.forEach((child) => {
                if (child.id == newChild.id) {
                    console.error(`new: ${newChild.toString()}, xpath: ${newChild.xpath}`);
                    console.error(`old: ${child.toString()}, xpath: ${child.xpath}`);
                    throw new Error('id is duplicate!');
                }
            })
            this._children.push(newChild);
            return;
        }
        this.findChild((child, index) => {
            if (pos.beforeId && child.id == pos.beforeId) {
                this._children?.splice(index, 0, newChild);
                return index;
            } else if (pos.afterId && child.id == pos.afterId) {
                this._children?.splice(index + 1, 0, newChild);
                return index;
            }
        });
    }
    private removeChild(id: string) {
        if (this._children) {
            let idx = 0;
            for (const child of this._children) {
                if (child.id == id) {
                    this._children.splice(idx, 1);
                    return true;
                }
                idx++;
            }
        }
        return false;
    }
    public findChild(fun: (child: DOM, index: number) => any) {
        if (this._children) {
            let idx = 0;
            for (const child of this._children) {
                const res = fun(child, idx);
                if (res != undefined && res != null) {
                    return res;
                }
                idx++;
            }
        }
    }
    public findById(id: string): DOM | undefined {
        if (this.id == id) {
            return this;
        }
        if (this._children) {
            for (const child of this._children) {
                const res = child.findById(id);
                if (res) {
                    return res;
                }
            }
        }
    }
    public remove() {
        if (this.node) {
            this.node.remove();
        }
        if (this.parent) {
            const parent = this.parent;
            const children = parent._children;
            if (children) {
                children.find((child) => {
                    if (child == this) {
                        parent.removeChild(child.id);
                        return this;
                    }
                })
            }
        }
    }
    get index(): number {
        if (!this.parent) {
            return -2;
        }
        const parent = this.parent;
        const index = parent.findChild((child, index) => {
            if (child.id == this.id) {
                return index;
            }
        });
        if (index != undefined) {
            return index;
        }
        return -1;
    }
    get nextSibling(): DOM | undefined {
        const index = this.index;
        const children = this.parent?.children || [];
        if (index >= 0 && index < children.length - 1) {
            return children[index + 1];
        }
    }
    get prevSibling(): DOM | undefined {
        const index = this.index;
        const children = this.parent?.children || [];
        if (index > 0 && index <= children.length - 1) {
            return children[index - 1];
        }
    }
    get afterSiblings(): DOM[] | undefined {
        const index = this.index;
        const children = this.parent?.children || [];
        if (index >= 0 && index < children.length - 1) {
            const array = [];
            for (let i = index + 1; i < children.length; i++) {
                array.push(children[i]);
            }
            return array;
        }
    }
    get beforeSiblings(): DOM[] | undefined {
        const index = this.index;
        const children = this.parent?.children || [];
        if (index > 0 && index < children.length - 1) {
            const array = [];
            for (let i = 0; i < index; i++) {
                array.push(children[i]);
            }
            return array;
        }
    }
    get xml() {
        const sw = new StringPrinter();
        this.buildXml(sw, 0);
        return sw.toString();
    }
    get innerXml(): string {
        const sw = new StringPrinter();
        if (this._children && this._children.length > 0) {
            for (const child of this._children) {
                child.buildXml(sw, 0);
            }
        } else if (this.text) {
            if (this.raw) {
                sw.append('<![CDATA[').println();
                sw.append(this.text);
                sw.print(0, `]]>`).println();
            } else {
                sw.append(`${this.text}`).println();
            }
        }
        return sw.toString();
    }
    private buildXml(sw: StringPrinter, deep: number, printChildren: boolean = true) {
        sw.print(deep, `<${this.name} id="${this.id}"`);
        if (this._attributes) {
            this._attributes.forEach((value, key) => {
                if (value) {
                    sw.append(` ${key}="${value}"`);
                } else {
                    sw.append(` ${key}=""`);
                }
            })
        }
        if (this._styleClass && this._styleClass.size > 0) {
            sw.append(` class="${this._styleClass.toString()}"`);
        }
        if (this._style && this._style.size > 0) {
            sw.append(` style="${this._style.toString()}"`);
        }
        if (this._children && this._children.length > 0) {
            sw.append(`>`).println();
            if (printChildren) {
                for (const child of this._children) {
                    child.buildXml(sw, deep + 1);
                }
            }
            sw.print(deep, `</${this.name}>`).println();
        } else if (this.text) {
            sw.append(`>`);
            if (this.raw) {
                sw.append('<![CDATA[').println();
                sw.append(this.text);
                sw.print(deep, `]]></${this.name}>`).println();
            } else {
                sw.append(`${this.text}</${this.name}>`).println();
            }
        } else {
            sw.append(`/>`).println();
        }
    }
    get json(): JDOM {
        let attrs: any;
        if (this._attributes && this._attributes.size > 0) {
            attrs = {};
            this._attributes.forEach((value, key) => {
                attrs[key] = value;
            })
        }
        if (this._styleClass && this._styleClass.size > 0) {
            if (!attrs) {
                attrs = {};
            }
            attrs['class'] = this._styleClass.toString();
        }
        if (this._style && this._style.size > 0) {
            if (!attrs) {
                attrs = {};
            }
            attrs['style'] = this._style.toString();
        }
        let children: JDOM[] | undefined;
        if (this._children && this._children.length > 0) {
            children = [];
            for (const child of this._children) {
                children.push(child.json);
            }
        }
        return {
            name: this.name,
            id: this.id,
            raw: this.raw,
            text: this.text,
            attributes: attrs,
            children,
        };
    }
    get jsonWithNewId(): JDOM {
        const json = this.json;
        this.genId(json);
        return json;
    }
    private genId(obj: any) {
        obj.id = uuid();
        const children = obj['children'];
        if (children) {
            for (const child of children) {
                this.genId(child);
            }
        }
    }
    toString() {
        const sw = new StringPrinter();
        this.buildXml(sw, 0, false);
        return sw.toString();
    }
}

export class DefaultDOM extends DOM {
    public get node(): HTMLElement {
        throw new Error('not support');
    }
}
export function buildDOMTree(json: any, parent?: XSDElement | DOM | undefined | null, build?: (parent: XSDElement | DOM | undefined | null, name: string, attributes: any, id?: string) => DOM): DOM {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    const name = obj['name'];
    const attributes = obj['attributes'];
    const id = obj['id'];
    const dom = build ? build(parent ? parent : null, name, attributes, id) : new DefaultDOM(parent ? parent : null, name, attributes, id);
    const text = obj['text'];
    if (text) {
        const raw = obj['raw'];
        dom.modifyText(text, raw);
        return dom;
    }
    const children = obj['children'];
    if (children) {
        for (const child of children) {
            const chd = buildDOMTree(child, dom, build);
            dom.addChild(chd);
        }
    }
    return dom;
}
export function createHtmlNode(dom: DOM): HTMLElement {
    const html = document.createElement(dom.name);
    html.id = dom.id;
    const attributes = dom.attributes;
    attributes?.forEach((value, key) => {
        html.setAttribute(key, value);
    });
    if (dom.style && dom.style.size > 0) {
        html.setAttribute('style', dom.style.toString());
    }
    if (dom.styleClass && dom.styleClass.size > 0) {
        html.setAttribute('class', dom.styleClass.toString());
    }
    const children = dom.children;
    if (children) {
        for (const child of children) {
            const childNode = createHtmlNode(child);
            html.appendChild(childNode);
        }
    } else {
        const text = dom.text;
        if (text) {
            html.append(text);
        }
    }
    return html;
}
export function getAttribute(dom: DOM, name: string | string[], defaultValue?: string) {
    let value: string | undefined;
    if (name instanceof Array) {
        for (const item of name) {
            value = dom.getAttribute(item);
            if (value) {
                break;
            }
        }
    } else {
        value = dom.getAttribute(name);
    }
    if (value) {
        return value;
    }
    if (defaultValue != undefined) {
        return defaultValue;
    }
    throw new Error(`missing attribute: ${name} in dom: ${dom.xml}`);
}
export function printNode(sw: StringPrinter, deep: number, node: DOM, level: number = Number.MAX_VALUE) {
    const tageName = node.name;
    sw.print(deep, `<${tageName}`);
    if (node.attributes) {
        node.attributes.forEach((value, key) => {
            if (value) {
                sw.append(` ${key}="${value}"`);
            } else {
                sw.append(` ${key}=""`);
            }
        });
    }
    if (node.styleClass && node.styleClass.size > 0) {
        sw.append(` class="${node.styleClass.toString()}"`);
    }
    if (node.style && node.style.size > 0) {
        sw.append(` style="${node.style.toString()}"`);
    }
    if (node.children && node.children.length > 0 && level - 1 > 0) {
        sw.append(`>`).println();
        for (const child of node.children) {
            printNode(sw, deep + 1, child, level - 1);
        }
        sw.print(deep, `</${tageName}>`).println();
    } else if (node.text) {
        sw.append(`>`);
        if (node.raw) {
            sw.append('<![CDATA[').println();
            sw.append(node.text);
            sw.print(deep, `]]></${tageName}>`).println();
        } else {
            sw.append(`${node.text}</${tageName}>`).println();
        }
    } else {
        sw.append(`/>`).println();
    }
}
export function printXMLTree(...nodes: DOM[]) {
    const sw = new StringPrinter();
    nodes.forEach((node) => {
        printNode(sw, 0, node);
    });
    return sw.toString();
}
export function printXML(node: DOM | undefined, level: number = Number.MAX_VALUE) {
    if (!node) {
        return '';
    }
    const sw = new StringPrinter();
    printNode(sw, 0, node, level);
    return sw.toString();
}
