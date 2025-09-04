export abstract class VDOM {
    readonly id: string;
    constructor(id: string) {
        this.id = id;
    }
    abstract render(): ChildNode;
    abstract update(node: VDOM): HTMLElement | undefined;
    abstract toJson(): string;
}

function removeChild(parent: ChildNode | undefined, node: VDOM): void {
    if (parent && node instanceof VDOMNode) {
        const html = node.html;
        if (html) {
            html.remove();
        }
    }
}

function updateChild(parent: ChildNode | undefined, origin: VDOM, node: VDOM): ChildNode | undefined {
    if (origin instanceof VDOMNode && node instanceof VDOMNode) {
        origin.update(node);
        return origin.html;
    } else if (origin instanceof VDOMText && node instanceof VDOMText) {
        origin.update(node);
        return origin.html;
    }
    //类型不同，删除旧的，插入新的
    removeChild(parent, origin);
    return node.render();
}

function insertAfter(parent: ChildNode | undefined, node: VDOM, after?: ChildNode | undefined | null): ChildNode | undefined {
    if (!parent) {
        return node.render();
    }
    const html = node.render();
    if (html && parent instanceof Element) {
        if (after) {
            if (after.nextSibling) {
                parent.insertBefore(html, after.nextSibling);
            } else {
                parent.appendChild(html);
            }
        } else {
            parent.insertBefore(html, parent.firstChild);
        }
    }
    return html;
}

export class VDOMNode extends VDOM {
    private _name: string;
    private _attributes: Map<string, string> = new Map<string, string>();
    private _listeners: Map<string, EventTrigger> = new Map<string, EventTrigger>();
    private _children: VDOM[] = [];
    private _parent: VDOMNode | undefined;
    private _html?: HTMLElement;
    private _inputChange?: () => void;

    constructor(id: string, name: string, parent?: VDOMNode) {
        super(id);
        this._name = name;
        this._parent = parent;
    }

    get parent(): VDOMNode | undefined {
        return this._parent;
    }

    get children(): VDOM[] {
        return this._children;
    }

    get name(): string {
        return this._name;
    }

    get html(): HTMLElement | undefined {
        return this._html;
    }

    set html(html: HTMLElement | undefined) {
        this._html = html;
    }

    toString() {
        let str = '<' + this._name;
        for (const attr of this._attributes) {
            str += ' ' + attr[0] + '="' + attr[1] + '"';
        }
        str += '>';
        for (const child of this._children) {
            str += child.toString();
        }
        str += '</' + this._name + '>';
        return str;
    }

    get json() {
        const result = {
            id: this.id,
            name: this._name,
            attributes: Object.fromEntries(this._attributes),
            children: this._children.map((child) => child.json)
        };
        return result;
    }

    addAttribute(name: string, value: string | undefined) {
        if (value === undefined) {
            this._attributes.delete(name);
        } else {
            this._attributes.set(name, value);
        }
    }

    addListener(name: string, trigger: EventTrigger) {
        this._listeners.set(name, trigger);
    }

    addChild(child: VDOM) {
        this._children.push(child);
    }

    render(): HTMLElement {
        const html = document.createElement(this._name);
        html.id = this.id;

        //添加属性
        for (const attr of this._attributes) {
            this.setHtmlAttribute(html, attr[0], attr[1]);
        }

        //添加事件
        for (const listener of this._listeners) {
            const event = listener[0];
            const trigger = listener[1];
            html.addEventListener(event, (e) => trigger.invoke(e));
        }

        //添加子元素
        for (const child of this._children) {
            html.appendChild(child.render());
        }

        this._html = html;
        return html;
    }

    update(node: VDOMNode): HTMLElement | undefined {
        //更新属性
        this.updateAttributes(node);

        //更新事件
        this.updateListeners(node);

        //更新子元素
        this.updateChildren(node);

        return this._html;
    }

    updateListeners(node: VDOMNode) {
        const origin = this._listeners;
        const target = node._listeners;

        //移除不存在的事件
        origin.forEach((trigger, name) => {
            if (!target.has(name)) {
                origin.delete(name);
                if (this._html) {
                    //需要重新添加所有事件
                    this._html = undefined;
                    this._children.forEach((child) => {
                        child.update(child);
                    });
                }
            }
        });

        //添加或者更新事件
        target.forEach((trigger, name) => {
            const oldTrigger = origin.get(name);
            if (!oldTrigger || oldTrigger.toString() != trigger.toString()) {
                origin.set(name, trigger);
                if (this._html) {
                    //需要重新添加所有事件
                    this._html = undefined;
                    this._children.forEach((child) => {
                        child.update(child);
                    });
                }
            }
        });
    }

    updateAttributes(node: VDOMNode) {
        const origin = this._attributes;
        const target = node._attributes;

        if (this._html) {
            //删除不存在的属性
            origin.forEach((value, name) => {
                if (!target.has(name)) {
                    origin.delete(name);
                    this._html?.removeAttribute(name);
                }
            });

            //添加或者更新属性
            target.forEach((value, name) => {
                const oldValue = origin.get(name);
                if (oldValue != value) {
                    origin.set(name, value);
                    this.setHtmlAttribute(this._html, name, value);
                }
            });
        }
    }

    setHtmlAttribute(html: HTMLElement, name: string, value: string) {
        if (name == 'class') {
            html.className = value;
        } else if (name == 'style') {
            html.style.cssText = value;
        } else if (name == 'disabled') {
            if (value == 'true' || value == 'disabled') {
                html.setAttribute(name, value);
                html.disabled = true;
            } else {
                html.removeAttribute(name);
                html.disabled = false;
            }
        } else if (name == 'checked') {
            if (value == 'true' || value == 'checked') {
                html.setAttribute(name, value);
                (html as HTMLInputElement).checked = true;
            } else {
                html.removeAttribute(name);
                (html as HTMLInputElement).checked = false;
            }
        } else if (name == 'value') {
            if (html instanceof HTMLInputElement || html instanceof HTMLTextAreaElement) {
                if (html.value != value) {
                    html.value = value;
                }
            } else {
                html.setAttribute(name, value);
            }
        } else {
            html.setAttribute(name, value);
        }
    }

    updateChildren(node: VDOMNode) {
        const origin = this._children;
        const target = node._children;
        const parent = this._html;
        
        if (!parent) {
            //重新渲染
            this._children = target;
            return;
        } else if (!origin || !origin.length) {
            if (target && target.length) {
                for (const child of target) {
                    parent.appendChild(child.render());
                }
            }
            this._children = target;
            return;
        } else if (!target || !target.length) {
            if (origin && origin.length) {
                for (const child of origin) {
                    if (child instanceof VDOMNode && child.html) {
                        child.html.remove();
                    } else if (child instanceof VDOMText && child.html) {
                        child.html.remove();
                    }
                }
            }
            this._children = [];
            return;
        } else if (this._html) {
            //console.log("遍历当前子元素");
            this._children = this._children.filter((child) => {
                const id = child.id;
                if (!this.include(target, id)) {
                    //console.log("   去掉新的中不含有的:"+ id);
                    removeChild(parent, child);
                    return false;
                }
                return true;
            });
            //console.log("遍历新的子元素");
            let after: ChildNode | undefined | null;
            this._children = target.map((child) => {
                const id = child.id;
                const retain = this.include(this._children, id);
                if (retain) {
                    //console.log("   新旧都包含的,合并:" + id);
                    after = updateChild(parent, retain, child);
                    return retain;
                } else {
                    //console.log("  旧的不含有的,插入:" + id);
                    after = insertAfter(parent, child, after);
                    return child;
                }
            });
        }
    }

    private include(children: VDOM[] | undefined, id: string): VDOM | undefined {
        if (!children) {
            return undefined;
        }
        for (const child of children) {
            if (child.id == id) {
                return child;
            }
        }
        return undefined;
    }
}

class NodeEvent {
    readonly name: string;
    readonly invoke: ASTInvoke;
    constructor(name: string, value: string) {
        this.name = name;
        const reader = new SyntaxReader(value);
        try {
            this.invoke = reader.parseEventTrigger();
        } catch (e) {
            console.error('expression:' + value);
            throw e;
        }
    }
    public render(node: VDOMNode, context: RenderContext) {
        const funName = this.invoke.name;
        const paramValues = this.buildParams(context, this.invoke.params);
        //log("bindEvent(" + this.name + "):" + html.className);
        const event = context.getEvent(funName);
        node.addListener(funName, new EventTrigger(this.name, event, funName, paramValues));
    }
    private buildParams(context: RenderContext, params: ASTNode[]): EventParam[] {
        const paramValues: (number | string | Event)[] = [];
        for (const param of params) {
            let value;
            if (param instanceof ASTName && param.name == "$event") {
                value = "$event";
            } else {
                value = param.invoke(context);
            }
            paramValues.push(value);
        }
        return paramValues;
    }
    public toString() {
        const str = ` v-on:${this.name}="${this.invoke.toString()}"`;
        return str;
    }
}

class NodeAttribute {
    readonly name: string;
    readonly value: string | undefined;
    readonly content: Content | undefined;
    constructor(name: string, value: string) {
        if (name.startsWith(":")) {
            let includeSub = undefined;
            this.name = name.substring(1);
            let str = '';
            if (this.name == 'class' && value.indexOf('?') < 0) {
                const array = value.split(' ');
                array.forEach((item) => {
                    if (str.length > 0) {
                        str += '+ " " +';
                    }
                    if (item) {
                        str += item;
                    }
                });
                str = `{{${str}}}`;
                includeSub = ['-'];
            } else {
                str = `{{${value}}}`;
            }
            this.content = new Content(str, { txtInclude: includeSub });
        } else {
            this.name = name;
            this.value = value;
        }
    }
    public toString() {
        let str = " ";
        if (this.content) {
            str += ":" + this.name + "=\"" + this.content.toStr() + "\"";
        } else {
            str += this.name + "=\"" + this.value + "\"";
        }
        return str;
    }
    public render(node: VDOMNode, context: RenderContext) {
        if (this.content) {
            const reval = this.content.render(context);
            node.addAttribute(this.name, reval);
        } else if (this.value) {
            node.addAttribute(this.name, this.value);
        }
    }
}

export class TemplateNode implements RenderNode {
    readonly parent: TemplateNode | undefined;
    readonly id: string;
    readonly name: string;
    private _loop: Loop | undefined;
    private _condition: Condition | undefined;
    private attributes: Map<string, NodeAttribute> | undefined;
    private events: Map<string, NodeEvent> | undefined;
    private _content: Content | { text: string, raw?: boolean } | undefined;
    private _children: TemplateNode[] | undefined;
    constructor(parent: TemplateNode | undefined, name: string, attrs?: Map<string, string>) {
        this.parent = parent;
        this.name = name;
        this.id = attrs?.get('_id_') || uuid();
        if (attrs) {
            const names = new Set();
            for (const attr of attrs) {
                const key = attr[0];
                if (names.has(key)) {
                    throw new Error("duplicate attribute:" + key + " in node:" + name);
                }
                if (key != '_id_') {
                    this.setAttribute(key, attr[1]);
                }
            }
        }
        if (parent) {
            parent.addChild(this);
        }
    }
    public toString() {
        let str = "";
        str += "<" + this.name;
        if (this._loop) {
            str += this._loop.toString();
        }
        if (this._condition) {
            str += this._condition.toString();
        }
        if (this.attributes) {
            for (const attr of this.attributes) {
                //log("attr:" + attr[0]);
                str += attr[1].toString();
            }
        }
        if (this.events) {
            for (const event of this.events) {
                //log("event:" + event[0]);
                str += event[1].toString();
            }
        }
        if (this._content) {
            str += ">";
            str += this._content.toString();
            str += "</" + this.name + ">";
        } else if (this._children) {
            str += ">";
            for (const child of this._children) {
                str += child.toString();
            }
            str += "</" + this.name + ">";
        } else {
            str += " />";
        }
        return str;
    }
    //clone(options: {parent?: TemplateNode, loop?: Loop, condition?: Condition}): TemplateNode {
    clone(parent: TemplateNode | undefined, options?: { loop?: Loop, condition?: Condition }): TemplateNode {
        const node = new TemplateNode(parent, this.name);
        node._loop = options?.loop ? options?.loop : this._loop;
        //node._loop = this._loop;
        node._condition = options?.condition ? options?.condition.clone(this) : this._condition?.clone(this);
        //node._condition = this._condition?.clone(this);
        node.attributes = this.attributes;
        node.events = this.events;
        node._content = this._content;
        node._children = this._children?.map((child) => {
            return child.clone(node);
        });
        return node;
    }

    get condition(): Condition | undefined {
        return this._condition;
    }

    get loop(): Loop | undefined {
        return this._loop;
    }

    setAttribute(name: string, value: string | undefined | null) {
        //log("addAttribute:" + name + ", " + value);
        if (name == "v-if") {
            log('v-if:' + value);
            if (!value) {
                this._condition = undefined;
                return;
            }
            this._condition = new Condition(this, false, value);
            return;
        } else if (name == "v-else-if") {
            log('v-else-if:' + value);
            if (!value) {
                this._condition = undefined;
                return;
            }
            this._condition = new Condition(this, true, value);
            return;
        } else if (name == "v-else") {
            log('v-else:' + value);
            this._condition = new Condition(this, true);
            return;
        } else if (name == "v-html") {
            if (!value) {
                throw new Error("v-html must have value!");
            }
            this._content = new Content(`{{${value}}}`, { raw: true });
            return;
        } else if (name == "v-for") {
            if (!value) {
                this._loop = undefined;
                return;
            }
            this._loop = new Loop(value);
            return;
        } else if (name.startsWith("v-on:")) {
            if (!value) {
                throw new Error("not set event!");
            }
            if (!this.events) {
                this.events = new Map();
            }
            name = name.substring(5);
            this.events.set(name, new NodeEvent(name, value));
            return;
        } else if (name == ":key" || name == "v-bind:key") {
            if (!value) {
                throw new Error("not set key!");
            }
            if (!this._loop) {
                throw new Error("not set loop!");
            }
            this._loop.setKeyName(value);
            return;
        }
        if (!value) {
            this.attributes?.delete(name);
            return;
        }
        if (!this.attributes) {
            this.attributes = new Map();
        }
        this.attributes.set(name, new NodeAttribute(name, value));
    }

    public attributeNames(): string[] {
        return this.attributes ? [...this.attributes.keys()] : [];
    }

    public bindText(text: string, raw: boolean) {
        if (this._children) {
            throw new Error('node has children can not bind text!');
        }
        if (text.indexOf("{{") >= 0 && text.indexOf("}}") > 0) {
            this._content = new Content(text, { raw });
        } else {
            this._content = { text, raw };
        }
    }

    public get content() {
        return this._content;
    }

    addChild(newChild: TemplateNode, pos?: NodePos) {
        if (this.content) {
            throw new Error('can not add child in text node!');
        }
        if (!this._children) {
            this._children = [];
        }
        if (!pos) {
            this._children.push(newChild);
            return;
        }
        if (!pos.afterId && !pos.beforeId) {
            throw new Error("must set before or after!");
        }
        this.find((child, index) => {
            if (pos.beforeId && child.id == pos.beforeId) {
                if (index > 0) {
                    this._children?.splice(index - 1, 0, newChild);
                } else {
                    this._children?.splice(0, 0, newChild);
                }
                return index;
            } else if (pos.afterId && child.id == pos.afterId) {
                this._children?.splice(index, 0, newChild);
                return index;
            }
        });
    }
    public find(fun: (child: TemplateNode, index: number) => any) {
        if (this._children) {
            let idx = 0;
            for (const child of this._children) {
                if (child instanceof TemplateNode) {
                    const res = fun(child, idx);
                    if (res) {
                        return res;
                    }
                }
                idx++;
            }
        }
    }

    public childrenCount(): number {
        return this._children ? this._children.length : 0;
    }

    public get children() {
        return this._children ? this._children : [];
    }

    get prevSibling(): TemplateNode | undefined {

        const children = this.parent?._children;
        if (children) {
            let before: TemplateNode | undefined;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child instanceof TemplateNode) {
                    if (child == this) {
                        if (before) {
                            return before;
                        }
                        break;
                    }
                    before = child;
                }
            }
        }
    }

    public get root() {
        let root: TemplateNode = this;
        while (root.parent) {
            root = root.parent;
        }
        return root;
    }
    public remove() {
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
    public move(pos: NodePos) {
        const parent = this.parent;
        if (!parent) {
            throw new Error('parent is null!');
        }
        if (!pos.beforeId && !pos.afterId) {
            throw new Error('beforeId or afterId is empty!');
        }
        if (!parent.removeChild(this.id)) {
            throw new Error('can not find child: ' + this.id) + ' in parent: ' + parent.id;
        }
        parent.addChild(this, pos);
    }
    private removeChild(id: string) {
        if (this._children) {
            let idx = 0;
            for (const child of this._children) {
                if (child instanceof TemplateNode) {
                    if (child.id == id) {
                        this._children.splice(idx, 1);
                        return true;
                    }
                }
                idx++;
            }
        }
        return false;
    }

    private testCondition(context: RenderContext): boolean {
        const condition = this._condition;
        if (condition) {
            return condition.test(context);
        }
        return true;
    }

    public render(context: RenderContext, index: string, parent?: VDOMNode) {
        if (this.loop) {
            if (!parent) {
                throw new Error("loop element must have parent!");
            }
            this.renderLoop(context, index, parent);
            return
        } else if (this.condition) {
            if (this.testCondition(context)) {
                this.renderElement(context, index, parent);
            }
            return;
        } else {
            this.renderElement(context, index, parent);
        }
    }

    renderLoop(context: RenderContext, index: string, parent: VDOMNode) {
        if (!this._loop) {
            throw new Error("not defined loop!");
        }
        context.bindLoop(this._loop);
        this._loop.bindArray(context);
        while (this._loop.next()) {
            if (!this.testCondition(context)) {
                continue;
            }
            const key = this._loop.key;
            this.renderElement(context, index + "@" + key, parent);
        }
        this._loop.unbindArray();
        context.unbindLoop();
    }

    renderElement(context: RenderContext, index: string, parent?: VDOMNode): VDOMNode {
        const id = parent ? parent.id + "_" + index : index;
        const node = new VDOMNode(id, this.name, parent);
        if (this.attributes) {
            for (const attr of this.attributes) {
                attr[1].render(node, context);
            }
        }
        if (this.events) {
            for (const event of this.events) {
                event[1].render(node, context);
            }
        }
        if (this._content) {
            const content = this._content;
            if (content instanceof Content) {
                const value = content.render(context);
                new VDOMText(node, '1', value, content.raw);
            } else {
                new VDOMText(node, '1', content.text);
            }
        } else if (this._children) {
            let index = 1;
            for (const child of this._children) {
                const idx = index + "";
                child.render(context, idx, node);
                index++;
            }
        }
        return node;
    }

}

export interface TemplateRender {
    renderNode(parent: TemplateNode | undefined, name: string, attrs?: Map<string, string>): TemplateNode | undefined;
    renderNodeText(text: string): string;
}

export function TemplateTransform(template: string, render?: TemplateRender) {
    let _root: TemplateNode | undefined;
    const parser = new SAXParser(true, { trim: true });

    const xpath: string[] = [];
    let entity: TemplateNode | undefined;

    parser.onopentag = (node: any) => {
        const nodeName = node.name;
        xpath.push(nodeName);
        const path = xpath.join("/");
        log("xpath:" + path);
        const attrs = new Map<string, string>();
        if (node.attributes) {
            for (const key of Object.keys(node.attributes)) {
                const value = node.attributes[key];
                log("   " + key + ": " + value);
                attrs.set(key, value);
            }
        }
        const parent = entity;
        entity = render ? render.renderNode(parent, nodeName, attrs) : new TemplateNode(parent, nodeName, attrs);
        if (!entity) {
            //log(`tag: ${nodeName}, attributes: ${attrs ? Array.from(attrs).map((val) => val[0] + '=' + val[1]) : []}`);
            entity = new TemplateNode(parent, nodeName, attrs);
        }
        if (!_root) {
            _root = entity;
        }
    }

    parser.ontext = (text: string) => {
        log("   text: " + text);
        text = text.trim();
        if (entity && text != "") {
            entity.bindText(render ? render.renderNodeText(text) : text, false);
        }
    };

    parser.oncdata = (text: string) => {
        log("   cdata: " + text);
        text = text.trim();
        if (entity && text != "") {
            entity.bindText(render ? render.renderNodeText(text) : text, true);
        }
    };

    parser.onclosetag = (tag: string) => {
        xpath.pop();
        log("closeTag:" + tag);
        if (entity) {
            entity = entity.parent;
        }
    };

    parser.onerror = (e: any) => {
        console.error("error:" + e)
        console.log(template)
    };

    parser.onend = () => {
        log("eof");
    };

    parser.write(template);

    return _root;
}

export type AttributeOptions = {
    template: string,
    params: string[]
}

export class TemplateNodeRender implements TemplateRender {

    private tags: Map<string, AttributeOptions> = new Map();
    constructor(tags?: { name: string, options: { template: string, params?: string[] } }[]) {
        if (tags) {
            tags.forEach((tag) => {
                const options = tag.options;
                this.addTemplate(tag.name, options.template, options.params);
            })
        }
    }

    private nodeAttributeRender?: NodeAttributeRender;

    renderNode(parent: TemplateNode | undefined, name: string, attrs?: Map<string, string>) {
        if (this.tags.has(name)) {
            const options = this.tags.get(name);
            if (options) {
                //console.log(`renderTag: ${name}, attributes: ${attrs ? Array.from(attrs).map((val) => val[0] + '=' + val[1]) : []}`);
                let loop: Loop | undefined;
                let condition: Condition | undefined;
                let loopKey: string | undefined;
                const vars = new Set(options.params);
                const params = new Map();
                if (attrs) {
                    attrs.forEach((val, key) => {
                        if (key == 'v-if' || key == 'v-if-else' || key == 'v-else') {
                            condition = parent ? new Condition(parent, key == 'v-else', val) : undefined;
                            return;
                        }
                        if (key == 'v-for') {
                            loop = new Loop(val);
                            return;
                        }
                        if (key == ':key') {
                            loopKey = val;
                            return;
                        }
                        if (key.startsWith('v-on:')) {
                            throw new Error('not support v-on in template tag!')
                        }
                        if (key.startsWith(":")) {
                            throw new Error('not support : in template tag!')
                        }
                        if (key.startsWith("v-html")) {
                            throw new Error('not support v-html in template tag!')
                        }
                        if (vars.has(key)) {
                            params.set(key, val);
                        }
                    })
                }
                this.nodeAttributeRender = new NodeAttributeRender(params);
                const tn = TemplateTransform(options.template, this.nodeAttributeRender);
                if (loopKey) {
                    loop?.setKeyName(loopKey);
                }
                return tn?.clone(parent, { loop, condition });
            }
        }
        return undefined;
    }
    renderNodeText(text: string): string {
        return text;
    }

    addTemplate(tagName: string, template: string, params?: string[]) {
        this.tags.set(tagName, { template, params: params || [] });
        return this;
    }
}

export class NodeAttributeRender implements TemplateRender {
    private params: Map<string, any> = new Map();
    private loop?: Loop;
    constructor(params: Map<string, string>) {
        this.params = params;
    }

    private getReader(value: string) {
        //console.log(`      getReader: ${value}`);
        return new SyntaxReader(value, { varReplace: this.getParam() });
    }

    private _parent?: TemplateNode;

    private getParam() {
        return (name: string) => {
            if (name == '$event') {
                return name;
            }
            if (this.params.size > 0) {
                if (this.params.has(name)) {
                    return this.params.get(name) || '';
                } else if (this.findForItem(this._parent, name)) {
                    return name;
                }
                throw new Error(`not found param: ${name} in params!`);
            }
            return name;
        }
    }

    private findForItem(parent: TemplateNode | undefined, name: string): boolean {
        if (this.loop && this.loop.itemName == name) {
            return true;
        }
        while (parent) {
            if (parent.loop) {
                const itemName = parent.loop?.itemName;
                if (itemName == name) {
                    return true;
                }
            }
            parent = parent.parent;
        }
        return false;
    }

    renderNodeText(text: string) {
        //console.log(`   renderNodeText: ${text}`);
        if (text.startsWith("{{") && text.endsWith("}}")) {
            const content = new Content(text, { varReplace: this.getParam() });
            text = content.toString();
        }
        return text;
    }

    renderNode(parent: TemplateNode | undefined, name: string, attributes?: Map<string, string>): TemplateNode | undefined {
        this._parent = parent;
        //console.log(`   renderNode: ${name}, attributes: ${attributes ? Array.from(attributes).map((val) => val[0] + '=' + val[1]) : []}`);
        if (attributes) {
            const map = new Map();
            for (const [key, value] of attributes) {
                let val;
                if (key == "v-if" || key == "v-if-else") {
                    const condition = this.getReader(value).parseConditions();
                    val = condition.toString();
                } else if (key == "v-else") {
                    val = '';
                } else if (key == "v-for") {
                    const loop = new Loop(value, this.getParam());
                    this.loop = loop;
                    val = loop.body;
                } else if (key.startsWith("v-on:")) {
                    const invoke = this.getReader(value).parseEventTrigger();
                    val = invoke.toString();
                } else if (key == ":key") {
                    val = this.params.get(value) || value;
                } else if (key == "v-html") {
                    const content = new Content(value, { varReplace: this.getParam() });
                    val = content.toStr();
                } else if (key.startsWith(":")) {
                    const content = new Content(value, { varReplace: this.getParam() });
                    val = content.toStr();
                } else {
                    val = value;
                }
                map.set(key, val);
            }
            return new TemplateNode(parent, name, map);
        }
        return new TemplateNode(parent, name, attributes);
    }

}

export class DOMBlock {
    readonly parent: HTMLElement | undefined;
    private _html: HTMLElement | undefined
    private _eof = false;
    private _vdom: VDOMNode | undefined;
    private _root: TemplateNode | undefined;
    private _context: RenderContext | undefined;

    constructor(parent?: HTMLElement, options?: { template?: string, render?: TemplateRender }) {
        this.parent = parent;
        const template = options?.template;
        if (!template) {
            this._html = parent;
            return;
        }

        this._root = TemplateTransform(template, options?.render);
        this._eof = true;

        log("block:" + this._root?.toString());
    }

    clone(parent: HTMLElement): DOMBlock {
        const block = new DOMBlock(parent);
        block._root = this._root;
        return block;
    }

    public get eof(): boolean {
        return this._eof;
    }

    get root(): TemplateNode | undefined {
        return this._root;
    }

    public get vdom(): VDOMNode | undefined {
        return this._vdom;
    }

    public get html(): HTMLElement | undefined {
        return this._html;
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

    public render(context?: RenderContext): HTMLElement {
        if (!this._root) {
            if (this.parent) {
                return this.parent;
            }
            throw new Error("root element is empty");
        } else if (this._root.loop) {
            throw new Error("root element can not be a loop");
        } else if (this._root.condition) {
            throw new Error("root element can not be a condition");
        }
        if (!context) {
            if (!this._context) {
                throw new Error("context is undefined");
            }
            context = this._context;
        } else {
            this._context = context;
        }
        const vdom = this._root.renderElement(context, "1");
        if (!vdom) {
            throw new Error("root render is empty!");
        }
        if (!this._vdom) {
            this._vdom = vdom;
            if (!this.parent) {
                throw new Error("html parent is empty!");
            }
            this._html = vdom.render();
            //console.log("first  render:" + vdom.toJson())
            this.parent.appendChild(this._html);
        } else {
            //console.log("origin:" + this.vdom.toJson())
            //console.log("update:" + vdom.toJson())
            this._html = this._vdom.update(vdom);
            //console.log("update render:" + this.vdom.toJson())
        }
        return this._html;
    }

    querySelector(selector: string) {
        return this._html?.querySelector(selector);
    }

    querySelectorAll(selector: string) {
        return this._html?.querySelectorAll(selector);
    }
}