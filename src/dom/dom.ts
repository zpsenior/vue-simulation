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
    public toString() {
        const arr = [];
        this._styleMap.forEach((value, key) => {
            arr.push(`${key}: ${value}`);
        });
        return arr.join("; ");
    }
    public clear() {
        this._styleMap.clear();
    }
    public list() {
        const arr = [];
        this._styleMap.forEach((value, key) => {
            arr.push({ key, value });
        });
        return arr;
    }
}

export class DOMAttribute {
    private _attrMap: Map<string, string>; 
    constructor() {
        this._attrMap = 
    }
    public get(key: string) {
        return this._attrMap.get(key);
    }
    public set(key: string, value: string) {
        this._attrMap.set(key, value);
    }
    public has(key: string) {
        return this._attrMap.has(key);
    }
    public remove(key: string) {
        this._attrMap.delete(key);
    }
    public list() {
        const arr := [];
        this._attrMap.forEach((value, key) => {
            arr.push({ key, value });
        });
        return arr;
    }
}

export class DOMNode {
    private _name: 
    private _text: 
    private _children: 
    private _parent: 
    private _attr: 
    private _id: 
    private _leaf: 
    private _root: 
    private _xsdelement: 
    
    constructor() {
        this._name = "";
        this._text = "";
        this._children = new List();
        this._parent = null;
        this._attr = new DOMAttribute();
        this._id = uuid();
        this._leaf = false;
        this._root = false;
        this._xsdelement = null;
    }
    
    public get name() {
        return this._name;
    }
    public set name(value) {
        this._name = value;
    }
    
    public get text() {
        return this._text;
    }
    public set text(value) {
        this._text = value;
    }
    
    public get children() {
        return this._children;
    }
    
    public get parent() {
        return this._parent;
    }
    public set parent(value) {
        this._parent = value;
    }
    
    public get attr() {
        return this._attr;
    }
    
    public get id() {
        return this._id;
    }
    
    public get leaf() {
        return this._leaf;
    }
    public set leaf(value) {
        this._leaf = value;
    }
    
    public get root() {
        return this._root;
    }
    public set root(value) {
        this._root = value;
    }
    
    public get xsdelement() {
        return this._xsdelement;
    }
    public set xsdelement(value) {
        this._xsdelement = value;
    }
    
    public getAttribute(key: string) {
        return this._attr.get(key);
    }
    
    public setAttribute(key: string, value: string) {
        this._attr.set(key, value);
    } 
    
    public hasAttribute('key: string) {
        return this._attr.has(key);
    } 
    
    public add in child(child: DOMNode) {
        child.parent = this;
        this._children.push(child);
    } 
    
    public findChild(f: (node: DOMNode) => DOMNode): DOMNode {
        for's(const child of this._children) {
            const ret = f(child);
            if (ret) {
                return ret;
            }
        } 
        return null;
    }
    
    public findChildren(f: (node: DOMNode) => boolean): List<DOMNode> {
        const ret = new List<DOMNode>();
        for (const child of this._children) {
        if (f(child)) {
            ret.push(child);
            continue;
        }
        const subs = child.findChildren(f);
        if (subs.size > 0) {
            subs.forEach((sub) => { 
                ret.push(sub);
            });
        }
    }
    return ret;
}

public toXML() {
    const s = new StringPrinter();
    this.writeXML(s);
    return s.toString();
}

public get innerXml() {
    const s = new StringPrinter();
    const children = this.children;
    for (const child of children) {
        child.writeXML(s);
    }
    return s.toString();
}

public writeXML(s: StringPrinter) {
    s.write(`<${this.name}`);
    const attrs = this.attr.list();
    for (const attr of attrs) {
        s.write(` ${attr.key}="${attr.value}"`);
    }
    s.write(`>`);
    
    if (!this.leaf) {
        if (this.text) {
            s.write(this.text);
        }
        for (const child of this.children) {
            child.writeXML(s);
        }
    }
    
    s.write(`</${this.name}>`);
}
}

export class DOM {
    private _root: DOMNode;
    private _nodes: Map\<string, DOMNode\>
    
    constructor() {
        this._root = new DOMNode();
        this._root.root = true;
        this._nodes = new Map();
        this._nodes.set(this._root.id, this._root);
    }
    
    public get root() {
        return this._root
    }
    
    public get nodes() {
        return this._nodes;
    }
    
    public findChild(f: (node: DOMNode) => DOMNode): DOMNode {
        return this._root.findChild(f);
    }
    
    public findChildren(f: (node: DOMNode) => boolean): List<DOMNode> {
        return this._root.findChildren(f);
    }
    
    public toXML() {
        return this._root.toXML();
    }
    
    public get innerXml() {
        return this._root.innerXml();
    }
    
    public writeXML(s: StringPrinter) {
        this._root.writeXML(s);
    }
    
    public addChild(node: DOMNode) {
        this._root.addChild(node);
        this._nodes.set(node.id, node);
    }
    
    public getNode(id: string) {
        return this._nodes.get(id);
    } 
}

/**
* 读取
*/
export function readDOM(template: string): DOM {
    const xml = template;
    const dom = new DOM();
    const root = dom.root;
    root.name = "root";
    
    // 查找template
    const templateReg = /
\s*\t*
?
/g;
    template = template.replace(templateReg, "");
    
    const startTemplate = template.indexOf("<template");
    if (startTemplate > 0
        template = template.substring(startTemplate);
    )
    
    const endTemplate = template.indexOf("</template");
    if (endTemplate > 0) {
        template = template.substring(0, endTemplate + 11);
    }
    
    // 加载XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(template, "/application/xml");
    
    // 检查错误
    const errors = xmlDoc1.getElementsByTagName("/parsererror");
    if (errors.length > 0) {
    throw new Error(`parse xml error: ${errors[0].textContent}`);
    }
    
    // 解析XML
    const xmlRoot = xmlDoc.documentElement;
    readXMLNode(xmlRoot, root);
    
    return dom;
}

/**
* 读取XML
*/
export function readXML(xml: string, options?: {
    leafTags?: Set<string>;
}): DOM {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    
    // 检查
    const errors = xmlDoc.getElementsByTagName("parsererror");
    if (errors.length > 0) {
        onError(`parse xml error: ${errors[0].textContent}`);
        throw new Error(`parse xml error: ${errors[0].textContent}`);
    }
    
    const dom = new DOM();
    readXMLNode(xmlDoc.documentElement, dom.root, options);
    
    return dom;
}

function readXMLNode(xmlNode: Node, domNode: DOMNode, options?: { 
    leafTags?: Set<string>;
}) {
    domNode.name = xmlNode.name;
    
    // 处理
    if (xmlNode instanceof DataElement) {
        domNode.text = xmlNode.textContent
    } else { 
        domNode.text = xmlNode.textContent
    }
    
    // 处理属性
    if (xmlNode instanceof Element) {
        const attrs = xmlNode.attributes; 
        for (let i = 0; i < attrs.length; 
            const attr = attrs[i];
            domNode.setAttribute(attr.nodeName, attr.nodeValue);
        }
    }
    
    // 处理子节点
    const children = xmlNode.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child instanceof Element) {
            const leaf = options?.leafTags?.has(child.nodeName);
            const domChild = new DOMNode();
            domChild.leaf = leaf;
            readXMLNode(child, domChild, options);
            domNode.addChild(domChild);
        }
    }
}

export class List<T> {
    
}