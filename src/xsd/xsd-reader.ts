import { log } from "../utils/utils";
import { SAXParser } from "../utils/sax";
import { decodeBase64, encodeBase64 } from "../utils/utils";


function debug(prefix: number, _msg: string) {
    let spaces = "";
    for (let i = 0; i < prefix; i++) {
        spaces += "   ";
    }
    //console.debug(spaces + _msg);
}

async function readXSDFile(finder: FileFinder, root: XSDNode, content: string, prefix: string | undefined) {
    const reader = new XSDReader();
    reader.read(content);
    const includeRoot = await reader.analyse(finder);
    if (!includeRoot) {
        return;
    }
    const count = includeRoot.childrenCount();
    console.log("   bind children count:" + count);
    for (let i = 0; i < count; i++) {
        const child = includeRoot.getChild(i);
        root.bindChild(child, prefix);
    }
}

export class XSDNode {
    readonly prefix: string;
    private parent: XSDNode | undefined;
    readonly name: string;
    private attributes: Map<string, string> | undefined;
    private children: XSDNode[] | undefined;
    constructor(parent: XSDNode | undefined, prefix: string | undefined | null, name: string, attrs?: any) {
        this.prefix = prefix || '';
        this.name = name;
        this.parent = parent;
        if (parent) {
            if (this.prefix != parent.prefix) {
                throw new Error("entity has different prefix, entity prefix: " + this.prefix + " parent prefix: " + parent.prefix);
            }
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(this);
        }
        if (attrs) {
            if(attrs instanceof Map) {
                attrs.forEach((value, key) => {
                    this.addAttribute(key, value);
                })
                return;
            }
            for (const key of Object.keys(attrs)) {
                let value = attrs[key];
                if(typeof value === "object"){
                    value = value.value;
                }
                if(value && value.startsWith("base64:")){
                    value = decodeBase64(value);
                }
                //debug("attr is " + key + " = " + JSON.stringify(value));
                this.addAttribute(key, value);
            }
        }
    }
    bindChild(child: XSDNode, prefix?: string) {
        child.parent = this;
        if (!this.children) {
            this.children = [];
        }
        let name = child.getAttribute("name");
        if (name) {
            const pos = name.indexOf(':');
            if (pos > 0) {
                prefix = name.substring(0, pos);
                name = name.substring(pos + 1);
            }
            child.addAttribute("name", prefix ? prefix + ":" + name : name);
            log("   schema bind child:" + child.name + "[" + child.getAttribute("name") + "]");
            this.children.push(child);
        }

    }
    removeChild(eleInclude: XSDNode) {
        if (!this.children) {
            return;
        }
        for (let i = 0; i < this.children.length; i++) {
            const ch = this.children[i];
            if (ch === eleInclude) {
                this.children.splice(i, 1);
                log("   remove child:" + eleInclude.name + "[" + eleInclude.getAttribute("schemaLocation") + "]");
            }
        }
    }
    getParent(): XSDNode | undefined {
        return this.parent;
    }
    childrenCount(): number {
        return this.children ? this.children.length : 0;
    }
    getChild(index: number): XSDNode {
        if (!this.children) {
            throw new Error("enetity [" + this.toString() + "] has empty children!");
        }
        if (index < this.children.length && index >= 0) {
            return this.children[index];
        }
        throw new Error("out of array length!");
    }
    getChildByName(name: string): XSDNode | undefined {
        const count = this.childrenCount();
        for (let i = 0; i < count; i++) {
            const child = this.getChild(i);
            console.log("getChildByName " + name + " -> " + child.name);
            if (child.name == name) {
                return child;
            }
        }
        return undefined;
    }
    private addAttribute(name: string, value: string) {
        if (!this.attributes) {
            this.attributes = new Map();
        }
        this.attributes.set(name, value);
    }
    getAttribute(name: string): string | undefined {
        if (this.attributes) {
            return this.attributes.get(name);
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        if(this.prefix) {
            array.push(`"prefix": "${this.prefix}"`);
        }
        array.push(`"name": "${this.name}"`);
        if (this.attributes) {
            const attrs: string[] = [];
            for (const attr of this.attributes) {
                const key = attr[0];
                let value = attr[1];
                if(value && value.startsWith("^") && value.endsWith("$")){
                    value = encodeBase64(value);
                }
                attrs.push(`"${key}": "${value}"`);
            }
            array.push(`"attributes": {${attrs.join(",")}}`);
        }
        if (this.children) {
            const children: string[] = [];
            for (const child of this.children) {
                children.push(child.toString());
            }
            array.push(`"children": [${children.join(",")}]`);
        }
        return `{${array.join(",")}}`;
    }
    toStr(): string {
        const array: string[] = [];
        const name = this.prefix ? `${this.prefix}:${this.name}` : this.name;
        array.push(`"name": "${name}"`);
        if (this.parent) {
            array.push(`"parent": "${this.parent.name}"`);
        }
        if (this.attributes) {
            const attrs: string[] = [];
            for (const attr of this.attributes) {
                attrs.push(`"${attr[0]}": "${attr[1]}"`);
            }
            array.push(`"attributes": {${attrs.join(",")}}`);
        }
        return `{${array.join(",")}}`;
    }
}

export class XSDRoot extends XSDNode {
    private namespaces = new Map<string, string>();
    constructor(prefix: string | undefined | null, name: string, attrs: any) {
        super(undefined, prefix, name);
        if (this.name != "schema") {
            throw new Error("root name is " + name + ", not a xsd schema root");
        }
        if (attrs) {
            for (const key in attrs) {
                if (key.startsWith("xmlns:")) {
                    const url = attrs[key].value;
                    const xmlns = key.substring(6);
                    log("   url[" + url + "] -> namespace[" + xmlns + "]");
                    this.namespaces.set(url, xmlns);
                }
            }
        }
    }
    findPrefix(url: string) {
        return this.namespaces.get(url);
    }

    toString(){
        const array: string[] = [];
        if(this.prefix) {
            array.push(`"prefix": "${this.prefix}"`);
        }
        array.push(`"name": "${this.name}"`);
        if (this.namespaces) {
            const namespaces: string[] = [];
            for (const attr of this.namespaces) {
                namespaces.push(`"${attr[0]}": "${attr[1]}"`);
            }
            array.push(`"namespaces": {${namespaces.join(",")}}`);
        }
        if(this.childrenCount() > 0){
            const children: string[] = []; 
            for (let i = 0; i < this.childrenCount(); i++) {
                const child = this.getChild(i);
                children.push(child.toString());
            }
            array.push(`"children": [${children.join(",")}]`);
        }
        return `{${array.join(",")}}`;
    }
}

export function parseXsd(xsd: any) {
    if(typeof xsd == 'string'){
        console.log(`xsd: ${xsd}`);
        xsd = JSON.parse(xsd);
    }
    const root = new XSDRoot("xs", "schema", xsd['attributes']);
    const children = xsd['children'];
    if(children){
        for(const child of children){
            const xsdChild = parseNode(root, child);
            root.bindChild(xsdChild);
        } 
    }
    return root;
}

function parseNode(parent: XSDNode, obj: any){
    const xsdNode = new XSDNode(parent, obj['prefix'], obj['name'], obj['attributes']);
    const children = obj['children'];
    if(children){
        for(const child of children){
            const xsdChild = parseNode(xsdNode, child);
            xsdChild.bindChild(xsdChild);
        } 
    }
    return xsdNode;
}

export class XSDReader {
    private root: XSDRoot | undefined;
    private parser: SAXParser;
    readonly errors: string[] = [];
    private eof = false;

    constructor() {
        this.parser = new SAXParser(true, { xmlns: true });
    }

    getRoot(): XSDRoot | undefined {
        return this.root;
    }

    async analyse(finder: FileFinder) {
        log("analyse...");
        const root = this.root;
        if (!this.eof || !root) {
            throw new Error('can not rebuild util root is ready!');
        }
        const count = root.childrenCount();
        const files: Map<string, string | undefined> = new Map();
        const removeChildren: XSDNode[] = [];
        log("analyse node count:" + count);
        for (let i = 0; i < count; i++) {
            const child = root.getChild(i);
            if (child.name == "include") {
                const fileName = this.getFileName(child);
                log("include " + fileName);
                removeChildren.push(child);
                files.set(fileName, undefined);
            } else if (child.name == "import") {
                const fileName = this.getFileName(child);
                const prefix = this.getPrefix(child);
                log("import " + fileName);
                removeChildren.push(child);
                files.set(fileName, prefix);
            }
        }
        for (const item of removeChildren) {
            root.removeChild(item);
        }
        for (const item of files) {
            const rootNode = root;
            const fileName = item[0];
            const prefix = item[1];
            log("analyse " + fileName + "...");
            const content = await finder(fileName);
            await readXSDFile(finder, rootNode, content, prefix);
        }

        return this.root;
    }

    private getFileName(child: XSDNode) {
        const fileName = child.getAttribute("schemaLocation");
        if (!fileName) {
            throw new Error('not find attribute[schemaLocation]');
        }
        //log("open xsd file:" + fileName);
        return fileName;
    }

    private getPrefix(child: XSDNode) {
        const namespace = child.getAttribute("namespace");
        if (!namespace) {
            throw new Error('not find attribute[namespace] in node:' + child.toString());
        }
        //log("namespace:" + namespace);
        const root = child.getParent() as XSDRoot;
        const prefix = root.findPrefix(namespace);
        if (!prefix) {
            throw new Error('not find namespace[' + namespace + ']');
        }
        return prefix;
    }

    read(xsdContent: string) {

        const that = this;
        const errors = this.errors;
        let entity: XSDNode | undefined;
        const xpath: string[] = [];

        this.parser.onopentag = function (node: any) {

            const tagName = node.name;
            const names = tagName.split(':');
            const prefix = names.length > 1 ? names[0] : '';
            const name = names.length > 1 ? names[1] : names[0];
            const attrs = node.attributes;
            xpath.push(tagName);
            if (entity) {
                entity = new XSDNode(entity, prefix, name, attrs);
            } else {
                that.root = new XSDRoot(prefix, name, attrs);
                entity = that.root;
            }
            debug(xpath.length, "start:" + xpath.join("/"));
        };

        this.parser.onclosetag = function (tag: any) {
            debug(xpath.length, "endTag(" + tag + ")")
            if (entity) {
                const parent = entity.getParent();
                if (parent) {
                    entity = parent;
                }
            }
            xpath.pop();
        };

        this.parser.onerror = function (e: Error) {
            console.error("error:" + e.message);
            errors.push(e.message);
        };

        this.parser.onend = function () {
            log("xsd is eof");
            that.eof = true;
        };

        this.parser.write(xsdContent).close();

    }

    public isEof(): boolean {
        return this.eof;
    }
}