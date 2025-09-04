import { OnEvent } from "./expression";
import { App } from "../component/base";

// 渲染上下文接口
export interface RenderContext {
    getVariable(key: string): any;
    setVariable(key: string, value: any): void;
}

// 基于Map实现的渲染上下文
export class MapRenderContext implements RenderContext {
    private _variables: Map<string, any> = new Map();

    getVariable(key: string): any {
        return this._variables.get(key);
    }

    setVariable(key: string, value: any): void {
        this._variables.set(key, value);
    }

    hasVariable(key: string): boolean {
        return this._variables.has(key);
    }

    deleteVariable(key: string): boolean {
        return this._variables.delete(key);
    }

    clearVariables(): void {
        this._variables.clear();
    }

    get variables(): Map<string, any> {
        return this._variables;
    }
}

// HTML节点类
export class HTMLNode {
    private _dom: any;
    private _children: HTMLNode[] = [];
    private _events: OnEvent[] = [];
    private _directives: Map<string, string> = new Map();
    private _context: RenderContext | undefined;
    private _element: HTMLElement | undefined;

    constructor(dom: any) {
        this._dom = dom;
        
        // 初始化子节点
        if (dom.children && Array.isArray(dom.children)) {
            for (const child of dom.children) {
                this._children.push(new HTMLNode(child));
            }
        }

        // 处理指令
        this.processDirectives();
    }

    get dom(): any {
        return this._dom;
    }

    get children(): HTMLNode[] {
        return this._children;
    }

    get element(): HTMLElement | undefined {
        return this._element;
    }

    // 处理指令
    private processDirectives(): void {
        if (!this._dom.attributes) {
            return;
        }

        // 遍历所有属性，检查是否是指令
        for (const [key, value] of Object.entries(this._dom.attributes)) {
            // 处理v-前缀的指令
            if (key.startsWith('v-')) {
                const directiveName = key.substring(2);
                this._directives.set(directiveName, value);
            }
            // 处理@前缀的事件
            else if (key.startsWith('@')) {
                const eventName = key.substring(1);
                this._events.push(new OnEvent(eventName, value));
            }
            // 处理:前缀的绑定
            else if (key.startsWith(':')) {
                const attrName = key.substring(1);
                this._directives.set(`bind:${attrName}`, value);
            }
        }
    }

    // 初始化节点
    init(context: RenderContext): HTMLElement | Text | null {
        this._context = context;

        // 处理文本节点
        if (this._dom.type === 'text') {
            return this.createTextNode();
        }

        // 创建元素
        this._element = this.createElement();
        if (!this._element) {
            return null;
        }

        // 应用指令
        this.applyDirectives();

        // 添加事件监听
        this.addEventListeners();

        // 添加子节点
        this.addChildren();

        return this._element;
    }

    // 创建文本节点
    private createTextNode(): Text {
        const text = this.parseExpression(this._dom.content);
        return document.createTextNode(text);
    }

    // 创建元素
    private createElement(): HTMLElement | null {
        // 处理v-if指令
        if (this._directives.has('if')) {
            const condition = this._directives.get('if') || '';
            const result = this.evaluateExpression(condition);
            if (!result) {
                return null;
            }
        }

        // 创建元素
        const element = document.createElement(this._dom.name);

        // 设置属性
        for (const [key, value] of Object.entries(this._dom.attributes)) {
            // 跳过指令属性
            if (key.startsWith('v-') || key.startsWith('@') || key.startsWith(':')) {
                continue;
            }

            // 设置普通属性
            element.setAttribute(key, value);
        }

        return element;
    }

    // 应用指令
    private applyDirectives(): void {
        if (!this._element || !this._context) {
            return;
        }

        // 处理所有指令
        for (const [directive, value] of this._directives.entries()) {
            const [type, arg] = directive.split(':');

            switch (type) {
                case 'text':
                    this.handleTextDirective(value);
                    break;
                case 'html':
                    this.handleHtmlDirective(value);
                    break;
                case 'bind':
                    this.handleBindDirective(arg, value);
                    break;
                case 'for':
                    this.handleForDirective(value);
                    break;
                case 'model':
                    this.handleModelDirective(value);
                    break;
                case 'show':
                    this.handleShowDirective(value);
                    break;
                case 'class':
                    this.handleClassDirective(value);
                    break;
                case 'style':
                    this.handleStyleDirective(value);
                    break;
            }
        }
    }

    // 处理文本指令
    private handleTextDirective(value: string): void {
        if (!this._element) {
            return;
        }
        const text = this.parseExpression(value);
        this._element.textContent = text;
    }

    // 处理HTML指令
    private handleHtmlDirective(value: string): void {
        if (!this._element) {
            return;
        }
        const html = this.parseExpression(value);
        this._element.innerHTML = html;
    }

    // 处理绑定指令
    private handleBindDirective(arg: string, value: string): void {
        if (!this._element) {
            return;
        }
        const result = this.evaluateExpression(value);
        if (arg) {
            this._element.setAttribute(arg, result);
        }
    }

    // 处理循环指令
    private handleForDirective(value: string): void {
        if (!this._element || !this._context) {
            return;
        }

        // 解析循环表达式
        const match = value.match(/^(\S+)\s+in\s+(\S+)(?:\s+\(|,\s*)(\S+)(?:\)|)?$/);
        if (!match) {
            return;
        }

        const [, item, items, index] = match;
        const itemsValue = this._context.getVariable(items);

        if (!Array.isArray(itemsValue)) {
            return;
        }

        // 保存原始子节点
        const originalChildren = [...this._children];

        // 清空当前子节点
        this._children = [];

        // 为每个数组项创建新的子节点
        for (let i = 0; i < itemsValue.length; i++) {
            // 创建新的上下文
            const childContext = new MapRenderContext();
            
            // 设置变量
            childContext.setVariable(item, itemsValue[i]);
            if (index) {
                childContext.setVariable(index, i);
            }

            // 复制原始子节点
            for (const child of originalChildren) {
                const clone = this.cloneNode(child);
                const element = clone.init(childContext);
                if (element) {
                    this._element!.appendChild(element);
                }
            }
        }
    }

    // 处理模型指令
    private handleModelDirective(value: string): void {
        if (!this._element || !this._context) {
            return;
        }

        const element = this._element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const initialValue = this.evaluateExpression(value);
        element.value = initialValue || '';

        // 添加input事件监听
        element.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            this._context!.setVariable(value, target.value);
        });
    }

    // 处理显示指令
    private handleShowDirective(value: string): void {
        if (!this._element) {
            return;
        }

        const result = this.evaluateExpression(value);
        this._element.style.display = result ? '' : 'none';
    }

    // 处理类指令
    private handleClassDirective(value: string): void {
        if (!this._element) {
            return;
        }

        const classes = this.evaluateExpression(value);
        
        if (typeof classes === 'string') {
            // 字符串形式
            const classList = classes.split(' ');
            classList.forEach(cls => {
                this._element!.classList.add(cls);
            });
        } else if (typeof classes === 'object') {
            // 对象形式
            for (const [cls, condition] of Object.entries(classes)) {
                if (condition) {
                    this._element!.classList.add(cls);
                }
            }
        }
    }

    // 处理样式指令
    private handleStyleDirective(value: string): void {
        if (!this._element) {
            return;
        }

        const styles = this.evaluateExpression(value);
        
        if (typeof styles === 'object') {
            for (const [property, value] of Object.entries(styles)) {
                (this._element!.style as any)[property] = value;
            }
        }
    }

    // 添加事件监听
    private addEventListeners(): void {
        if (!this._element || !this._context) {
            return;
        }

        for (const event of this._events) {
            const handler = this.createEventHandler(event);
            if (handler) {
                this._element.addEventListener(event.name, handler);
            }
        }
    }

    // 创建事件处理函数
    private createEventHandler(event: OnEvent): EventListener | null {
        if (!this._context) {
            return null;
        }

        // 检查是否是方法调用
        if (event.expression.endsWith('()')) {
            const methodName = event.expression.substring(0, event.expression.length - 2);
            const method = this._context.getVariable(methodName);
            if (typeof method === 'function') {
                return (e: Event) => method(e);
            }
        }

        // 处理表达式
        return (e: Event) => {
            this.evaluateExpression(event.expression);
        };
    }

    // 添加子节点
    private addChildren(): void {
        if (!this._element || !this._context) {
            return;
        }

        for (const child of this._children) {
            const element = child.init(this._context);
            if (element) {
                this._element.appendChild(element);
            }
        }
    }

    // 解析表达式
    private parseExpression(expression: string): string {
        if (!this._context || !expression.includes('{{')) {
            return expression;
        }

        let result = expression;
        const regex = /\{\{([^{}]+)\}\}/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(expression)) !== null) {
            const expr = match[1].trim();
            const value = this.evaluateExpression(expr);
            result = result.replace(match[0], value !== undefined ? value.toString() : '');
        }

        return result;
    }

    // 评估表达式
    private evaluateExpression(expression: string): any {
        if (!this._context) {
            return expression;
        }

        // 创建一个函数来评估表达式
        try {
            // 获取上下文中的所有变量
            const variables: { [key: string]: any } = {};
            const context = this._context as MapRenderContext;
            for (const [key, value] of context.variables.entries()) {
                variables[key] = value;
            }

            // 创建一个函数来评估表达式
            const keys = Object.keys(variables);
            const values = Object.values(variables);
            const fn = new Function(...keys, `return ${expression}`);
            return fn(...values);
        } catch (error) {
            console.error('Error evaluating expression:', expression, error);
            return expression;
        }
    }

    // 克隆节点
    private cloneNode(node: HTMLNode): HTMLNode {
        const dom = JSON.parse(JSON.stringify(node.dom));
        return new HTMLNode(dom);
    }

    // 更新节点
    update(): void {
        if (!this._element || !this._context) {
            return;
        }

        // 重新应用指令
        this.applyDirectives();

        // 更新子节点
        for (const child of this._children) {
            child.update();
        }
    }
}

// 模板解析器类
export class TemplateParser {
    private _template: string;

    constructor(template: string) {
        this._template = template;
    }

    // 解析模板
    parse(): HTMLNode | null {
        const dom = this.parseHTML(this._template);
        if (!dom) {
            return null;
        }

        return new HTMLNode(dom);
    }

    // 解析HTML字符串
    private parseHTML(html: string): any {
        // 创建临时容器
        const container = document.createElement('div');
        container.innerHTML = html;

        // 递归处理节点
        return this.processNode(container);
    }

    // 处理节点
    private processNode(node: Node): any {
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
                const child = this.processNode(element.childNodes[i]);
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
}