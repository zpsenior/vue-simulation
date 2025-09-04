import { log } from '../utils/utils';
import { XMLObserver, XMLReader } from '../dom/xml-parser';
import { SAXParser } from '../utils/sax';
import { XSDElement, XSDSchema } from '../xsd/xsd';
import { DefaultDOM, DOM } from './dom';

export interface DOMRender {
    render(xpath: string, parent: DOM | null, name: string, attrs?: any): DOM | undefined;
    renderText(text: string): string;
}

export class XSDRender implements DOMRender {
    readonly schema: XSDSchema;
    constructor(schema: XSDSchema) {
        this.schema = schema;
    }
    render(xpath: string, parent: DOM | null, name: string, attrs?: any): DOM | undefined {
        let dom: DefaultDOM;
        if (!parent) {
            const xsd = this.schema.lookup(xpath.split('/')) as XSDElement;
            if (!xsd) {
                throw new Error(`can not find element${name}] whose xpath is ${xpath} in schema!`);
            }
            dom = new DefaultDOM(xsd, name, attrs);
        } else {
            dom = new DefaultDOM(parent, name, attrs);
            if (dom.xsd) {
                const errors: string[] = [];
                dom.attributes?.validate(dom.xsd, xpath, errors);
                if(errors.length > 0) {
                    throw new Error(errors.join('\n'));
                }
            }
        }
        return dom;
    }
    renderText(text: string): string {
        return text;
    }
}

export class DOMReader {
    private _xml: string | undefined;
    private readonly parser: SAXParser;
    private _root: DOM | null = null;
    constructor(render?: DOMRender) {
        const xpath: string[] = [];
        const parser = new SAXParser(true, { trim: true });
        const that = this;
        let parent: DOM | null = null;

        parser.onerror = function (e: any) {
            console.error("error:" + e);
            console.error("xml:" + that._xml);
        };

        parser.onopentag = function (node: any) {
            const nodeName = node.name;
            const attributes = node.attributes;
            xpath.push(nodeName);
            const path = xpath.join("/");
            log("xpath: " + path);
            let entity = render ? render.render(path, parent, nodeName, attributes) : new DefaultDOM(parent, nodeName, attributes);
            if (!entity) {
                entity = new DefaultDOM(parent, nodeName, attributes);
            }
            if (parent) {
                parent.addChild(entity);
            }
            parent = entity;
            if (!that._root) {
                that._root = parent;
            }
        }

        parser.onclosetag = function (tag: string) {
            xpath.pop();
            log("closeTag: " + tag);
            if (parent) {
                parent = parent.parent;
            }
        }

        parser.ontext = function (text: string) {
            log("text: " + text);
            if (parent && text) {
                text = text.trim();
                parent.setText(render ? render.renderText(text) : text);
            }
        }

        parser.oncdata = function (cdata: string) {
            log("cdata: " + cdata);
            if (parent && cdata) {
                cdata = cdata.trim();
                parent.modifyText(render ? render.renderText(cdata) : cdata, true);
            }
        }

        parser.onend = function () {
            log("eof");
        };

        this.parser = parser;
    }

    public read(xml: string) {
        this._xml = xml;
        this.parser.write(xml);
        if (!this._root) {
            throw new Error('not build root dom!');
        }
        return this._root;
    }
}

export class DefaultXMLObserver extends XMLObserver {
    private _root: DOM | null = null;
    private parent: DOM | null = null;
    readonly xpath: string[] = [];
    readonly render?: DOMRender;
    constructor(render?: DOMRender) {
        super();
        this.render = render;
    }
    onopentag(nodeName: string, attributes: Map<string, string | undefined>) {
        this.xpath.push(nodeName);
        const path = this.xpath.join("/");
        this.log("xpath: " + path);
        attributes.forEach((value, key) => {
            this.log("attribute: " + key + '=' + value);
        })
        let entity = this.render ? this.render.render(path, this.parent, nodeName, attributes) : new DefaultDOM(this.parent, nodeName, attributes);
        if (!entity) {
            entity = new DefaultDOM(this.parent, nodeName, attributes);
        }
        if (this.parent) {
            this.parent.addChild(entity);
        }
        this.parent = entity;
        if (!this._root) {
            this._root = this.parent;
        }
    }
    ontext(text: string) {
        this.log("text: " + text);
        if (this.parent && text) {
            text = text.trim();
            this.parent.setText(this.render ? this.render.renderText(text) : text);
        }
    }
    oncdata(cdata: string) {
        this.log("cdata: " + cdata);
        if (this.parent && cdata) {
            cdata = cdata.trim();
            this.parent.setText(this.render ? this.render.renderText(cdata) : cdata, true);
        }
    }
    onclosetag(nodeName: string) {
        this.log("closeTag: " + nodeName);
        this.xpath.pop();
        if (this.parent) {
            this.parent = this.parent.parent;
        }
    }
    onend() {
        this.log("end");
    }
    public get root() {
        if (!this._root) {
            throw new Error('not found root node');
        }
        return this._root;
    }
    private log(_msg: string) {
        //console.log(_msg);
    }
}

export function readXML(xml: string, option?:{ render?: DOMRender, leafTags?: Set<string> }) {
    const observer = new DefaultXMLObserver(option?.render);
    new XMLReader(observer, option?.leafTags).read(xml);
    return observer.root;
}