import { ASTCompare, ASTInvoke, ASTLogic, ASTName, ASTNode, ASTNot, Context, EventParam, OnEvent, SyntaxReader, VarReplace } from "./expression";
import { DOM, DOMAttributes } from "../dom/dom";
import { DOMRender, readXML } from "../dom/dom-reader";
import { decodeHTML, toSnakeCase } from "../utils/utils";

export interface RenderContext extends Context {
    setVariable(name: string, value: any): void;
    bindLoop(loop: Loop): void;
    unbindLoop(): void;
    get loopKeys(): (string | number)[];
}

export interface RenderNode {
    readonly id: string;
    readonly name: string;
    get prevSibling(): RenderNode | undefined;
    get condition(): Condition | undefined;
    get loop(): Loop | undefined;
    get content(): Content | { text: string, raw?: boolean } | undefined;
}

export class EventTrigger {
    readonly eventName: string;
    readonly funName: string;
    private fun: OnEvent;
    private _params: EventParam[];
    constructor(eventName: string, fun: OnEvent, funName: string, params: EventParam[]) {
        this.eventName = eventName;
        this.funName = funName;
        this.fun = fun;
        this._params = params;
    }

    compare(target: EventTrigger) {
        if (this.eventName != target.eventName) {
            return false;
        }
        if (this.funName != target.funName) {
            return false;
        }
        if (this._params.length != target._params.length) {
            return false;
        }
        return true;
    }

    set params(params: EventParam[]) {
        if (this._params.length != params.length) {
            throw new Error("params length is different!");
        }
        this._params = params;
    }

    get params() {
        return this._params;
    }

    private handleEvent?: (event: Event) => void;

    handle() {
        if (!this.handleEvent) {
            this.handleEvent = (event: Event) => {
                //log("handle event " + this.eventName + "=" + this.toString());
                const paramValues = this.params.map((param) => {
                    return param == "$event" ? event : param;
                })
                const values = paramValues.length > 0 ? paramValues : [event];
                //log(this.name + "(" + values + ")");
                this.fun(...values);
            }
        }
        return this.handleEvent;
    }

    toString() {
        let str = "";
        str += this.funName + "(";
        this._params.filter((param, index) => {
            if (index > 0) {
                str += ", "
            }
            str += param;
        })
        str += ")";
        return str;
    }
}

export class MapRenderContext implements RenderContext {
    private variables: Map<string, any>;
    private events?: Map<string, OnEvent>;
    private loops: Loop[] = [];
    constructor(variables: Map<string, any>, events?: Map<string, OnEvent>) {
        this.variables = variables;
        this.events = events;
    }
    getVariable(name: string): any {
        for (let i = this.loops.length - 1; i >= 0; i--) {
            const loop = this.loops[i];
            if (loop.itemName == name) {
                return loop.item;
            } else if (loop.indexName == name) {
                return loop.index;
            }
        }
        return this.variables.get(name);
    }
    setVariable(name: string, value: any) {
        this.variables.set(name, value);
    }
    getEvent(name: string): OnEvent {
        if (!this.events) {
            throw new Error("not define any event!");
        }
        const event = this.events.get(name);
        if (event) {
            //log("emit " + name + "(" + paramValues + ")");
            return event;
        } else {
            throw new Error("can not find event:" + name);
        }
    }
    bindLoop(loop: Loop) {
        this.loops.push(loop);
    }
    unbindLoop() {
        this.loops.pop();
    }
    get loopKeys(): (string | number)[] {
        return this.loops.map(loop => loop.key);
    }
}

export class Condition {
    readonly node: RenderNode;
    readonly isElse: boolean;
    readonly expr: ASTNot | ASTCompare | ASTLogic | undefined;
    constructor(node: RenderNode, isElse: boolean, content?: string | ASTNot | ASTCompare | ASTLogic) {
        this.node = node;
        this.isElse = isElse;
        if (!isElse && !content) {
            throw new Error("condition is empty");
        }
        if (content) {
            if (content instanceof ASTNode) {
                this.expr = content;
                return;
            }
            let ast;
            try {
                ast = (new SyntaxReader(content as string)).parseConditions();
            } catch (e) {
                console.error(content);
                throw e;
            }
            if (ast instanceof ASTCompare || ast instanceof ASTNot || ast instanceof ASTLogic) {
                this.expr = ast;
            } else {
                throw new Error("error condition expression:" + content);
            }
        }
    }

    clone(node: RenderNode) {
        return new Condition(node, this.isElse, this.expr);
    }

    private get preCondition(): Condition | undefined {
        const sibling = this.node.prevSibling;
        if (sibling) {
            const condition = sibling.condition;
            return condition;
        }
    }

    test(context: RenderContext): boolean {
        if (this.isElse) {
            let preConditon = this.preCondition;
            while (preConditon) {
                const preResult = preConditon.test(context);
                if (preResult) {
                    return false;
                }
                preConditon = preConditon.preCondition;
            }
            if (this.expr) {
                return this.expr.invoke(context);
            }
            return true;
        } else {
            if (this.expr) {
                return this.expr.invoke(context);
            }
            throw new Error("condition is empty");
        }
    }
    public toString() {
        if (this.isElse) {
            let str = " v-else";
            if (this.expr) {
                str += "-if=\"" + this.expr.toString() + "\"";
            }
            return str;
        }
        if (!this.expr) {
            throw new Error("condition is empty");
        }
        return " v-if=\"" + this.expr.toString() + "\"";
    }
}

export class Content {
    private _expressions: (ASTNode | string)[] = [];
    private txtInclude?: string[];
    private varReplace?: VarReplace;
    readonly raw: boolean;
    constructor(content: string, option?: { txtInclude?: string[], varReplace?: VarReplace, raw?: boolean }) {
        this.txtInclude = option?.txtInclude;
        this.varReplace = option?.varReplace;
        this.raw = option?.raw || false;
        while (content.length > 0) {
            const start = content.indexOf("{{");
            if (start < 0) {
                if (content.indexOf("}}") >= 0) {
                    throw new Error("expect {{ in " + content);
                }
                this._expressions.push(content);
                return;
            }
            const prefix = content.substring(0, start).trim();
            if (prefix) {
                this._expressions.push(prefix);
            }
            const end = content.indexOf("}}");
            if (end < 0) {
                throw new Error("expect }} in " + content);
            }
            if (end < start) {
                throw new Error("error expression :" + content);
            }
            const expr = this.buildExpr(content.substring(start + 2, end));
            this._expressions.push(expr);
            content = content.substring(end + 2);
        }
    }
    clone(): Content {
        const content = new Content('');
        content._expressions = this._expressions;
        content.txtInclude = this.txtInclude;
        content.varReplace = this.varReplace;
        return content;
    }
    get expressions() {
        return this._expressions;
    }
    private buildExpr(content: string) {
        try {
            return (new SyntaxReader(content, { txtInclude: this.txtInclude, varReplace: this.varReplace })).parseExpression();
        } catch (e) {
            console.error('expression:' + content);
            throw e;
        }
    }
    render(context: RenderContext): string {
        const array = [];
        for (const item of this._expressions) {
            const val = item instanceof ASTNode ? item.invoke(context) : item;
            array.push(val != undefined && val != null ? decodeHTML(val.toString()) : '');
        }
        if (array.length == 1) {
            return array[0] || '';
        }
        return array.join('');
    }
    public toStr() {
        let str = "";
        for (const item of this._expressions) {
            if (item instanceof ASTNode) {
                str += item.toString();
            } else {
                str += item;
            }
        }
        return str;
    }
    public toString() {
        return "{{" + this.toStr() + "}}";
    }

}

export class Loop {
    readonly itemName: string;
    private keyName: string | null = null;
    readonly indexName: string;
    readonly items: ASTNode;
    private _index: number = -1;
    private _item: any;
    private _key: number | string | null = null;

    constructor(expr: string, fun?: VarReplace) {
        const pos = expr.indexOf(" in ");
        if (pos < 0) {
            throw new Error("error v-for define!");
        }
        const paramStr = expr.substring(0, pos).trim();
        if (paramStr.startsWith("(") && paramStr.endsWith(")")) {
            const params = paramStr.substring(1, paramStr.length - 1).split(",");
            if (params.length == 2) {
                this.itemName = params[0].trim();
                this.indexName = params[1].trim();
            } else {
                throw new Error("error v-for format!");
            }
        } else {
            this.itemName = paramStr;
            this.indexName = "index";
        }
        expr = expr.substring(pos + 4).trim();
        try {
            this.items = (new SyntaxReader(expr, { varReplace: fun })).parseExpression();
        } catch (e) {
            console.error('expression:' + expr);
            throw e;
        }
    }
    public toString() {
        let str = ` v-for="${this.body}"`;
        if (this.keyName) {
            str += ` :key="${this.keyName}"`;
        }
        return str;
    }
    public get body() {
        return this.indexName != "index" ? `(${this.itemName}, ${this.indexName}) in ${this.items}` : `${this.itemName} in ${this.items}`
    }
    private array: any[] | null = null;
    bindArray(context: RenderContext) {
        this._index = -1;
        const items = this.items.invoke(context);
        if (!items) {
            return;
        }
        if (Array.isArray(items)) {
            this.array = items as [];
        } else if (items instanceof Map) {
            this.array = [];
            items.forEach((val, key) => {
                this.array?.push({
                    key,
                    value: val
                })
            })
        } else if (items instanceof Set) {
            this.array = [...items];
        } else {
            this.array = [...new Map(Object.entries(items))];
        }
        return;
    }
    unbindArray() {
        this.array = null;
        this._index = -1;
    }
    next(): boolean {
        if (!this.array || this._index >= this.array.length - 1) {
            return false;
        }
        this._index++;
        this._item = this.array[this._index];
        this._key = this.keyName ? this._item[this.keyName] : this._index;
        return true;
    }
    get key(): number | string {
        return this._key || '';
    }
    get index(): number {
        return this._index;
    }
    get item(): any {
        return this._item;
    }
    setKeyName(keyName: string) {
        this.keyName = keyName;
    }
}
type EventParamValue = (number | string | boolean | [] | Event);

class EventHandle {
    readonly name: string;
    readonly params: ASTNode[];
    private event?: OnEvent;
    private values?: EventParamValue[];
    constructor(ele: HTMLElement, event: string, invoke: ASTInvoke) {
        this.name = invoke.name;
        this.params = invoke.params;
        ele.addEventListener(event, (e) => {
            this.handle(e);
        })
    }
    private handle(e: Event) {
        if (!this.values || !this.event) {
            throw new Error("event params had not been render!");
        }
        const paramValues = this.values.map((val) => {
            if (val instanceof ASTName && val.name == "$event") {
                return e;
            }
            return val;
        });
        if (paramValues.length == 0) {
            paramValues.push(e);
        }
        return this.event(...paramValues);
    }
    renderParams(context: RenderContext) {
        const paramValues: (number | string | boolean | Event)[] = [];
        const params: ASTNode[] = this.params;
        for (const param of params) {
            let value;
            if (param instanceof ASTName && param.name == "$event") {
                value = param;
            } else {
                value = param.invoke(context);
            }
            paramValues.push(value);
        }
        this.event = context.getEvent(this.name);
        this.values = paramValues;
    }
}

class NodeElement {
    readonly ele: HTMLElement;
    readonly handles?: Map<string, EventHandle>;
    readonly id: string;
    constructor(ele: HTMLElement, handles: Map<string, EventHandle> | undefined, id: string) {
        this.ele = ele;
        this.handles = handles;
        this.id = id;
    }
    remove() {
        this.ele.remove();
    }
}

class NodeElementCollection {
    private readonly elements: Map<string, NodeElement>;
    private readonly access: Set<string>;
    constructor() {
        this.elements = new Map();
        this.access = new Set();
    }
    add(element: NodeElement) {
        if (this.elements.has(element.id)) {
            throw new Error("element id had been exists!");
        }
        this.elements.set(element.id, element);
        this.access.add(element.id);
    }
    get(id: string) {
        const ele = this.elements.get(id);
        if (ele) {
            this.access.add(id);
        }
        return ele;
    }
    remove(id: string) {
        const ele = this.elements.get(id);
        if (ele) {
            ele.remove();
        }
        this.elements.delete(id);
    }
    clear() {
        const array: string[] = [];
        this.elements.forEach((ele) => {
            if (!this.access.has(ele.id)) {
                array.push(ele.id);
            }
        });
        array.forEach((id) => {
            this.remove(id);
        });
        this.access.clear();
    }
}

const uuidV4Regex = /@?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class HTMLNode implements RenderNode {
    readonly name: string;
    readonly id: string;
    readonly parent?: HTMLNode;
    readonly loop: Loop | undefined;
    readonly condition: Condition | undefined;
    readonly isHtml: boolean = false;
    readonly content: Content | { text: string, raw?: boolean } | undefined;
    private readonly attrs?: Map<string, ASTNode | string>;
    private readonly events?: Map<string, ASTInvoke>;
    private readonly children?: HTMLNode[];
    readonly elements: NodeElementCollection;
    constructor(dom: DOM, parent?: HTMLNode) {
        this.parent = parent;
        this.elements = parent?.elements || new NodeElementCollection();
        this.name = dom.name;
        this.id = dom.id;
        const attrs = dom.attributes;
        if (attrs) {
            const { loop, condition, events, attributes, isHtml } = this.processAttributes(attrs);
            this.loop = loop;
            this.condition = condition;
            this.events = events;
            this.attrs = attributes;
            this.isHtml = isHtml;
        }
        const classList = dom.styleClass.toString();
        if (classList) {
            if (!this.attrs) {
                this.attrs = new Map();
            }
            this.attrs.set('class', classList);
        }
        const styleStr = dom.style.toString();
        if (styleStr) {
            if (!this.attrs) {
                this.attrs = new Map();
            }
            this.attrs.set('style', styleStr);
        }
        const children = dom.children;
        if (children && children.length > 0) {
            this.children = [];
            children.forEach((child) => {
                const node = new HTMLNode(child, this);
                this.children?.push(node);
            })
        } else {
            const text = dom.text;
            if (text) {
                if (text.indexOf('{{') >= 0) {
                    this.content = new Content(text, { raw: dom.raw });
                } else {
                    this.content = { text, raw: dom.raw };
                }
            }
        }
    }
    private processAttributes(attrs: DOMAttributes) {
        let isHtml: boolean = false;
        let loop: Loop | undefined;
        let condition: Condition | undefined;
        let attributes: Map<string, ASTNode | string> = new Map();
        let events: Map<string, ASTInvoke> | undefined;
        attrs.forEach((val, key) => {
            const eventName = key.startsWith('@') ? key.substring(1) : key.startsWith('v-on:') ? key.substring(5) : undefined;
            if (eventName) {
                try {
                    const invoke = new SyntaxReader(val).parseEventTrigger();
                    if (!events) {
                        events = new Map<string, ASTInvoke>();
                    }
                    events.set(eventName, invoke);
                } catch (e) {
                    console.error(`parse event trigger error, ${key}: ${val}`);
                }
                return;
            }
            const bindAttribute = key.startsWith(':') ? key.substring(1) : key.startsWith('v-bind:') ? key.substring(7) : undefined;
            if (bindAttribute) {
                if (bindAttribute == "key") {
                    if (this.loop) {
                        this.loop.setKeyName(val);
                        return;
                    }
                }
                const strExpr =decodeHTML(val);
                try {
                    const reader = new SyntaxReader(strExpr);
                    const expr = bindAttribute == 'class' ? reader.parseStyleClass() : reader.parseExpression();
                    attributes.set(bindAttribute, expr);
                } catch (e) {
                    console.error(`parse expression error, [${key}]: [${strExpr}]`);
                }
                return;
            }
            if (key == 'v-html') {
                isHtml = true;
                return;
            }
            if (key == 'v-for') {
                try {
                    loop = new Loop(val);
                } catch (e) {
                    console.error(`parse expression ${key} error: ${val}`);
                }
                return;
            }
            if (key == 'v-if') {
                if (condition) {
                    throw new Error("v-if must before v-else-if or v-else!");
                }
                try {
                    condition = new Condition(this, false, val);
                } catch (e) {
                    console.error(`parse expression ${key} error: ${val}`);
                }
                return;
            } else if (key == 'v-else-if') {
                if (condition) {
                    throw new Error("v-else-if must after v-if or v-else-if!");
                }
                try {
                    condition = new Condition(this, true, val);
                } catch (e) {
                    console.error(`parse expression ${key} error: ${val}`);
                }
                return;
            } else if (key == 'v-else') {
                condition = new Condition(this, true);
                return;
            }
            attributes.set(key, val);
        });
        return { loop, condition, events, attributes, isHtml };
    }
    get prevSibling(): RenderNode | undefined {
        if (!this.parent) {
            return undefined;
        }
        const children = this.parent.children;
        if (!children) {
            return undefined;
        }
        let prev = undefined;
        for (const child of children) {
            if (child == this) {
                return prev as RenderNode;
            }
            prev = child;
        }
        return prev as RenderNode;
    }
    private testCondition(context: RenderContext, callback?: () => void) {
        if (this.condition) {
            if (!this.condition.test(context)) {
                if (callback) {
                    callback();
                }
                return false;
            }
        }
        return true;
    }

    init(context: RenderContext): HTMLElement | HTMLElement[] | undefined {
        if (this.loop) {
            return this.renderLoop(context, this.loop);
        }
        //console.log(`init(${this.name}, ${this.id})`);
        if (!this.testCondition(context)) {
            return;
        }
        const id = context.loopKeys.join('-') + '@' + this.id;
        const element = this.createAndInitElement(context, id);
        return element.ele;
    }
    update(context: RenderContext): HTMLElement | HTMLElement[] | undefined {
        if (this.loop) {
            return this.renderLoop(context, this.loop);
        }
        //console.log(`update(${this.name}, ${this.id})`);
        const id = context.loopKeys.join('-') + '@' + this.id;
        let element = this.elements.get(id);
        if (!this.testCondition(context, () => {
            if (element) {
                this.elements.remove(id);
            }
        })) {
            return;
        }
        if (!element) {
            element = this.createAndInitElement(context, id);

        } else {
            this.updateElement(context, element);
        }
        return element.ele;
    }
    private renderLoop(context: RenderContext, loop: Loop) {
        //console.log(`loop(${loop.body}, ${this.id})`);
        const array: NodeElement[] = [];
        const loopIndex = context.loopKeys.join('-');
        context.bindLoop(loop);
        loop.bindArray(context);
        let elements = this.elements;
        while (loop.next()) {
            const id = loopIndex + '-' + loop.index + "@" + this.id;
            //console.log(`   loop id: ${id}`);
            let element = elements.get(id);
            if (!element) {
                if (this.testCondition(context)) {
                    element = this.createAndInitElement(context, id);
                }
            } else {
                if (this.testCondition(context), () => {
                    if (element) {
                        elements.remove(element.id);
                    }
                }) {
                    this.updateElement(context, element);
                }
            }
            if (element) {
                array.push(element);
            }
        }
        loop.unbindArray();
        context.unbindLoop();
        return array.map((val) => val.ele);
    }
    private createAndInitElement(context: RenderContext, id: string) {
        //console.log(`createAndInitElement(${this.name}, ${this.id})`);
        const html = document.createElement(this.name);
        const ele = this.initElement(context, html, id);
        this.elements.add(ele);
        return ele;
    }
    private initElement(context: RenderContext, ele: HTMLElement, id: string) {
        if (!uuidV4Regex.test(this.id)) {
            ele.id = this.id;
        }
        if (this.attrs) {
            this.attrs.forEach((val, key) => {
                if (val instanceof ASTNode) {
                    let value = this.invokeExpr(context, key, val);
                    ele.setAttribute(key, value);
                } else {
                    ele.setAttribute(key, val);
                }
            })
        }
        let handles: Map<string, EventHandle> | undefined;
        if (this.events) {
            handles = new Map();
            this.events.forEach((val, key) => {
                const handle = new EventHandle(ele, key, val);
                handle.renderParams(context);
                handles!.set(key, handle);
            })
        }
        if (this.children && this.children.length > 0) {
            this.children.forEach((child) => {
                const html = child.update(context);
                this.appendChild(ele, html);
            })
        } else if (this.content) {
            if (this.content instanceof Content) {
                ele.textContent = this.content.render(context);
            } else {
                if(this.isHtml) {
                    ele.innerHTML = this.content.text;
                } else {
                    ele.textContent = this.content.text;
                }
            }
        }
        return new NodeElement(ele, handles, id);

    }
    private updateElement(context: RenderContext, element: NodeElement) {
        const ele = element.ele;
        const handles = element.handles;
        if (this.attrs) {
            this.attrs.forEach((val, key) => {
                if (val instanceof ASTNode) {
                    let value = this.invokeExpr(context, key, val);
                    ele.setAttribute(key, value);
                }
            })
        }
        if (handles) {
            handles.forEach((val) => {
                val.renderParams(context);
            })
        }
        if (this.children && this.children.length > 0) {
            this.children.forEach((child) => {
                const html = child.update(context);
                this.appendChild(ele, html);
            })
        } else if (this.content) {
            if (this.content instanceof Content) {
                ele.textContent = this.content.render(context);
            }
        }
        return ele;
    }
    private invokeExpr(context: RenderContext, key: string, expr: ASTNode) {
        let res = expr.invoke(context);
        if (key === 'class') {
            return this.flatten(res);
        } else if (key == 'style' && res instanceof Object) {
            let str = '';
            Object.keys(res).forEach((key) => {
                str += toSnakeCase(key) + ':' + res[key] + ';';
            });
            return str;
        }
        if (res instanceof Array) {
            res = JSON.stringify(res);
        } else if (res instanceof Object) {
            res = JSON.stringify(res);
        }
        return res;
    }
    flatten(res: any): string {
        if (res instanceof Array) {
            let str = '';
            res.forEach((item) => {
                str += this.flatten(item) + ' ';
            })
            return str;
        }
        return res.toString();
    }
    private appendChild(ele: HTMLElement, html: HTMLElement | HTMLElement[] | undefined) {
        if (!html) {
            return;
        }
        if (html instanceof Array) {
            html.forEach((element) => {
                ele.appendChild(element);
            })
        } else if (html) {
            ele.appendChild(html);
        }
    }
    toString() {
        let str = `<${this.name}`;
        if (this.loop) {
            str += ' ' + this.loop.toString();
        }
        if (this.condition) {
            str += ' ' + this.condition.toString();
        }
        this.attrs?.forEach((val, key) => {
            str += typeof val == 'string' ? ` ${key}=\"${val}\"` : ` :${key}=\"${val.toString()}\"`;
        })
        if (this.content) {
            str += '>' + this.content.toString() + `</${this.name}>`;
        } else {
            str += '/>';
        }
        return str;
    }
}
export class HTMLBlock {
    readonly parent: HTMLElement | undefined;
    readonly root: HTMLNode;
    private _context: RenderContext | undefined;

    constructor(options: { template: string, render?: DOMRender, leafTags?: Set<string> }, parent?: HTMLElement) {
        this.parent = parent;
        const dom = readXML(options.template, { render: options.render, leafTags: options.leafTags });
        this.root = new HTMLNode(dom);
    }
    public render(context?: RenderContext) {
        let htmls: HTMLElement | HTMLElement[] | undefined;
        if (context) {
            this._context = context;
            htmls = this.root.init(context);
        } else {
            if (!this._context) {
                throw new Error('undefined context!');
            }
            htmls = this.root.update(this._context);
        }
        if (htmls) {
            if (htmls instanceof Array) {
                htmls.forEach((html) => {
                    if (this.parent) {
                        this.parent.appendChild(html);
                    }
                })
            } else {
                if (this.parent) {
                    this.parent.appendChild(htmls);
                }
            }
        }
    }
    get context() {
        if (this._context) {
            return this._context;
        }
        throw new Error('undefined context!');
    }
    setData(params: any) {
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
    querySelector(selector: string) {
        return this.parent?.querySelector(selector);
    }
    querySelectorAll(selector: string) {
        return this.parent?.querySelectorAll(selector);
    }
}