import { TextParser, Token, TokenQueue, TokenType, Word, WordQueue, WordType } from "../parser/parser";
import { FileFinder } from "../utils/base";

export type StyleClass = {
    selector: Selector;
    items: {
        name: string;
        value: string;
    }[]
}
export function style2Json(styleClassList: StyleClass[]) {
    return styleClassList.map((styleClass) => {
        return {
            selector: styleClass.selector.toString(),
            items: styleClass.items
        }
    });
}

export type SelectorProcessor = (selector: Selector) => string;

export function style2Str(styleClassList: StyleClass[], prefix?: SelectorProcessor) {
    let str = '';
    for (const styleClass of styleClassList) {
        const selector = styleClass.selector;
        const stylesheets = styleClass.items;
        const className = prefix ? prefix(selector) : selector.toString();
        str += `${className} {\n`;
        for (const style of stylesheets) {
            if (style.value) {
                str += `${style.name}: ${style.value};\n`;
            }
        }
        str += `}\n`;
    }
    return str;
}

export async function str2StyleAsync(cssStr: string, finder?: FileFinder) {
    const reader = new StyleReader(finder);
    const styleClassList: StyleClass[] = await reader.readAsync(cssStr);
    return styleClassList;
}
export function str2Style(cssStr: string, finder?: FileFinder) {
    const reader = new StyleReader(finder);
    const styleClassList: StyleClass[] = reader.read(cssStr);
    return styleClassList;
}

export function parseSelector(selectStr: string) {
    const queue = new TokenQueue(new StyleParser(selectStr.trim(), {
        punctuators: punctuators,
    }));
    const reader = new StyleReader();
    const selector = reader.readSelector(queue);
    if (!selector) {
        throw new Error("can not parse selector:" + selectStr);
    }
    return selector;
}

export enum AttributeOpt {
    startsWith = 1,
    endsWith = 2,
    contains = 3,
    equal = 4,
}

export type SelectorAttribute = {
    name: string;
    opt: AttributeOpt;
    value: string;
}

export enum SelectorRelationship {
    ancestor = 1,
    parent = 2,
    nextSibling = 3,
    sibling = 4,
}

export type SelectorOption = {
    name: string;
    pseudoElement?: string;
    pseudoClass?: string;
    attributes?: Map<string, SelectorAttribute | undefined>;
    preSelector?: Selector
}

export class Selector {
    readonly preSelector?: Selector;
    private _name: string;
    private _attributes?: Map<string, SelectorAttribute | undefined>;
    readonly pseudoElement: string | undefined;
    readonly pseudoClass: string | undefined;
    private _relationship: SelectorRelationship = SelectorRelationship.ancestor;

    constructor(option: SelectorOption) {
        this._name = option.name;
        this.pseudoElement = option.pseudoElement;
        this.pseudoClass = option.pseudoClass;
        this.preSelector = option.preSelector;
        this._attributes = option.attributes;
    }

    clone() {
        const preSelector: Selector | undefined = this.preSelector ? this.preSelector.clone() : undefined;
        const selector: Selector = new Selector({ name: this._name, pseudoClass: this.pseudoClass, pseudoElement: this.pseudoElement, preSelector: preSelector });
        if (this._attributes && this._attributes.size > 0) {
            selector._attributes = new Map();
            this._attributes.forEach((val, key) => {
                selector._attributes?.set(key, val);
            })
        }
        return selector;
    }

    toString() {
        let str = '';
        const preSelector = this.preSelector;
        if (preSelector) {
            str += preSelector.toString();
            switch (preSelector.relationship) {
                case SelectorRelationship.ancestor:
                    str += ' ';
                    break;
                case SelectorRelationship.parent:
                    str += ' > ';
                    break;
                case SelectorRelationship.nextSibling:
                    str += ' + ';
                    break;
                case SelectorRelationship.sibling:
                    str += ' ~ ';
            }
        }
        str += this._name;
        if (this._attributes && this._attributes.size > 0) {
            for (const item of this._attributes) {
                const attrName = item[0];
                const attrValue = item[1];
                str += "[" + attrName;
                if (attrValue) {
                    if (attrValue.opt == AttributeOpt.startsWith) {
                        str += '^=';
                    } else if (attrValue.opt == AttributeOpt.endsWith) {
                        str += '$=';
                    } else if (attrValue.opt == AttributeOpt.contains) {
                        str += '*=';
                    } else {
                        str += '=';
                    }
                    str += '"' + attrValue.value + '"';
                }
                str += "]";
            }
        }
        if (this.pseudoClass) {
            str += ':' + this.pseudoClass;
        }
        if (this.pseudoElement) {
            str += '::' + this.pseudoElement;
        }
        return str;
    }

    set relationship(relationship: SelectorRelationship) {
        this._relationship = relationship;
    }
    get relationship() {
        return this._relationship;
    }

    get name() {
        return this._name;
    }

    get attributes() {
        return this._attributes;
    }

    setAttribute(attrName: string, attrValue: string | undefined) {
        if (!this._attributes) {
            this._attributes = new Map();
        }
        this._attributes.set(attrName, { name: attrName, opt: AttributeOpt.equal, value: attrValue || '' });
    }
}

const punctuators = ['*', '#', '.', '[', '^', '$', '=', ']', ':', '(', ')', '+', '>', ',', '{', ';', '}'];

class StyleParser extends TextParser {
    private readonly keywords;
    private readonly punctuators;
    private _tokens: Token[] = [];
    constructor(text: string, option: { keywords?: string[], punctuators?: string[] }) {
        super(text);
        this.keywords = new Set(option.keywords);
        this.punctuators = new Set(option.punctuators);
    }

    process(queue: WordQueue) {
        while (!queue.eof) {
            const word = queue.next();
            const token = this.processOne(word, queue);
            if(token){
                this._tokens.push(token);
            }
        }
    }
    private processOne(word: Word, queue: WordQueue) {
        let type: TokenType;
        let content = word.text;
        switch (word.type) {
            case WordType.WORD:
                while (queue.checkPunctuator('-')) {
                    const text = queue.checkWord();
                    if (text) {
                        content += '-' + text;
                        continue;
                    }
                    const num = queue.checkNumber();
                    if (num) {
                        content += '-' + num;
                        continue;
                    }
                    throw new Error('not support word type:' + queue.current?.text);
                }
                if (this.keywords.has(content)) {
                    type = TokenType.TOKEN_TYPE_KEYWORD;
                } else {
                    type = TokenType.TOKEN_TYPE_NAME;
                }
                break;
            case WordType.PUNCTUATOR:
                if (content == '/' && queue.checkPunctuator('*')) {
                    content = '';
                    while (!queue.checkPunctuators(['*', '/'])) {
                        const word = queue.next();
                        content += word.text;
                    }
                    type = TokenType.TOKEN_TYPE_COMMENT;
                    break;
                }
                if (!this.punctuators.has(content)) {
                    type = TokenType.TOKEN_TYPE_UNKNOWN;
                    break;
                }
                type = TokenType.TOKEN_TYPE_PUNCTUATOR;
                break;
            case WordType.NUMBER:
                type = TokenType.TOKEN_TYPE_NUMBER;
                break;
            case WordType.QUOTE1:
            case WordType.QUOTE2:
                type = TokenType.TOKEN_TYPE_QUOTE;
                content = content.substring(1, content.length - 1);
                break;
            case WordType.DELIM:
                return;
            default:
                type = TokenType.TOKEN_TYPE_UNKNOWN;
                break;
        }
        const token = new Token(content, type, word.pos);
        return token;
    }
    public get tokens() {
        return this._tokens;
    }
}

export class StyleReader {

    private readonly fileFinder?: FileFinder;

    constructor(fileFinder?: FileFinder) {
        this.fileFinder = fileFinder;
    }

    public async readAsync(css: string) {
        const queue = new TokenQueue(new StyleParser(css, {
            punctuators: punctuators,
            keywords: ['import']
        }), (token) => {
            return token.type != TokenType.TOKEN_TYPE_COMMENT;
        });
        const array: StyleClass[] = [];
        while (!queue.eof) {
            if (queue.checkPunctuator('@')) {
                await this.readImport(queue, array);
                this.readMedia(queue);
                this.readCharset(queue);
                this.readNamespace(queue);
                this.readFontFace(queue, array);
                this.readKeyframes(queue);
            }
            this.readStyleClass(queue, array);
        }
        return array;
    }
    public read(css: string) {
        const queue = new TokenQueue(new StyleParser(css, {
            punctuators: punctuators,
            keywords: ['import']
        }), (token) => {
            return token.type != TokenType.TOKEN_TYPE_COMMENT;
        });
        const array: StyleClass[] = [];
        while (!queue.eof) {
            if (queue.checkPunctuator('@')) {
                this.readMedia(queue);
                this.readCharset(queue);
                this.readNamespace(queue);
                this.readFontFace(queue, array);
                this.readKeyframes(queue);
            }
            this.readStyleClass(queue, array);
        }
        return array;
    }

    private async readImport(queue: TokenQueue, array: StyleClass[]) {
        if (!queue.checkKeyword('import')) {
            return;
        }
        const fileName = queue.readQuote();
        if (!this.fileFinder) {
            throw new Error('not define file reader!');
        }
        const reader = new StyleReader(this.fileFinder);
        const cssStr = await this.fileFinder(fileName);
        const styleClassList = await reader.readAsync(cssStr);
        array.push(...styleClassList);
    }
    private readFontFace(queue: TokenQueue, array: StyleClass[]) {
        if (!queue.checkKeyword('font-face')) {
            return;
        }
        array.push({
            selector: new Selector({ name: '@font-face' }),
            items: this.readSheets(queue)
        });
    }
    private readMedia(queue: TokenQueue) {
        if (!queue.checkKeyword('media')) {
            return;
        }
        const mediaType = queue.checkName();
        if (mediaType) {

        }
        const features = [];
        while (true) {
            queue.readPunctuator('(');
            const name = queue.readName();
            if (queue.checkPunctuator(':')) {

            } else if (queue.checkPunctuators(['>', '='])) {
            } else if (queue.checkPunctuator('>')) {
            } else if (queue.checkPunctuators(['<', '='])) {
            } else if (queue.checkPunctuator('<')) {

            }
            const value = this.readValue(queue, ')');
            queue.readPunctuator(')');
            if (queue.checkPunctuator('{')) {
                queue.forward(-1);
                break;
            }
            features.push({ name, value });
        }
        const array: StyleClass[] = [];
        queue.readPunctuator('{');
        while (true) {
            this.readStyleClass(queue, array);
            if (queue.checkPunctuator('}')) {
                break;
            }
        }
        return {
            mediaType,
            features,
            styleClassList: array
        }
    }
    private readCharset(queue: TokenQueue) {
        if (!queue.checkKeyword('charset')) {
            return;
        }
        const content = queue.readQuote();
        return {
            name: '@charset',
            content
        }
    }
    private readNamespace(queue: TokenQueue) {
        if (!queue.checkKeyword('namespace')) {
            return;
        }
        const content = queue.readQuote();
        return {
            name: '@namespace',
            content
        }
    }
    private readKeyframes(queue: TokenQueue) {
        if (!queue.checkKeyword('keyframes')) {
            return;
        }
        const keyName = queue.readName();
        queue.readPunctuator('{');
        const frames = [];
        while (true) {
            if (queue.checkPunctuator('}')) {
                break;
            }
            let selector = queue.checkNumber();
            if (selector) {
                queue.checkPunctuator('%');
                selector = selector + '%';
            } else {
                selector = queue.readName();
                if (selector != 'from' && selector != 'to') {
                    throw new Error('keyframes name must be from or to!');
                }
            }
            const sheets = this.readSheets(queue);
            frames.forEach((frame) => {
                if (frame.selector == selector) {
                    throw new Error(`selector[${selector}] in keyframes[${keyName}] must be unique!`);
                }
            });
            frames.push({ selector, sheets });
        }
        return {
            keyName,
            frames
        }
    }
    private readSheets(queue: TokenQueue) {
        const sheets: { name: string; value: string }[] = [];
        queue.readPunctuator('{');
        while (true) {
            if (queue.checkPunctuator('}')) {
                break;
            }
            const name = queue.readName();
            queue.checkPunctuator(':');
            const value = this.readValue(queue);
            sheets.push({ name, value });
            queue.readPunctuator(';');
        }
        return sheets
    }

    private readStyleClass(queue: TokenQueue, array: StyleClass[]) {
        const selectors = this.readSelectors(queue);
        const sheets: { name: string; value: string }[] = [];
        queue.readPunctuator('{');
        while (true) {
            if (queue.checkPunctuator('}')) {
                break;
            }
            if (queue.checkPunctuator('.') || queue.checkPunctuator('#') || queue.checkPunctuator('*')) {
                queue.forward(-1);
                this.readChildClass(queue, array, selectors[0]);
                continue;
            }
            const name = queue.readName();
            if (queue.checkPunctuator('{')) {
                queue.forward(-2);
                this.readChildClass(queue, array, selectors[0]);
                continue;
            }
            queue.checkPunctuator(':');
            const value = this.readValue(queue);
            sheets.push({ name, value });
            queue.readPunctuator(';');
        };
        selectors.forEach((selector) => {
            array.push({
                selector,
                items: sheets
            });
        });
    }
    private readChildClass(queue: TokenQueue, array: StyleClass[], preSelector: Selector) {
        const selector = this.readSelector(queue, preSelector);
        if (!selector) {
            return;
        }
        const sheets: { name: string; value: string }[] = [];
        queue.readPunctuator('{');
        while (true) {
            if (queue.checkPunctuator('}')) {
                break;
            }
            if (queue.checkPunctuator('.') || queue.checkPunctuator('#') || queue.checkPunctuator('*')) {
                queue.forward(-1);
                this.readChildClass(queue, array, selector);
                continue;
            }
            const name = queue.readName();
            if (queue.checkPunctuator('{')) {
                queue.forward(-1);
                this.readChildClass(queue, array, selector);
                continue;
            }
            queue.checkPunctuator(':');
            const value = this.readValue(queue);
            sheets.push({ name, value });
            queue.readPunctuator(';');
        }
        array.push({
            selector,
            items: sheets
        });
    }
    private readValue(queue: TokenQueue, end: string = ';') {
        let str = '';
        let index = -1;
        while (true) {
            const token = queue.readToken();
            if (token.type == TokenType.TOKEN_TYPE_PUNCTUATOR && token.content == end) {
                queue.forward(-1);
                break;
            }
            const pos = token.pos;
            if (index >= 0) {
                if (pos.index - index > 1) {
                    str += ' ';
                }
            }
            index = pos.index;
            str += token.content;
        }
        return str;
    }

    private readSelectors(queue: TokenQueue) {
        const array: Selector[] = [];
        let preSelector: Selector | undefined;
        while (true) {
            const selector = this.readSelector(queue, preSelector);
            if (!selector) {
                if (preSelector) {
                    array.push(preSelector);
                }
                break;
            }
            preSelector = selector;
            if (queue.checkPunctuator('>')) {
                selector.relationship = SelectorRelationship.parent;
                continue;
            }
            if (queue.checkPunctuator('+')) {
                selector.relationship = SelectorRelationship.nextSibling;
                continue;
            }
            if (queue.checkPunctuator('~')) {
                selector.relationship = SelectorRelationship.sibling;
                continue;
            }
            if (queue.checkPunctuator(',')) {
                preSelector = undefined;
                array.push(selector);
            }
        }
        return array;
    }

    private getSelectorName(queue: TokenQueue) {
        let name = queue.checkName();
        if (name) {
            if (queue.adjacentNext() && queue.checkPunctuator('.')) {
                return name + '.' + queue.readName();
            }
            return name;
        }
    }

    public readSelector(queue: TokenQueue, preSelector?: Selector) {
        let name = undefined, pseudoClass = undefined, pseudoElement = undefined;
        if (queue.checkPunctuator('.')) {
            name = '.' + queue.readName();
        } else if (queue.checkPunctuator('#')) {
            name = '#' + queue.readName();
        } else if (queue.checkPunctuator('*')) {
            name = '*';
        } else {
            name = this.getSelectorName(queue);
            if (!name) {
                return undefined;
            }
        }
        const attrs = new Map<string, SelectorAttribute | undefined>();
        while (queue.checkPunctuator('[')) {
            const attrName = queue.readName();
            let attrValue = undefined;
            if (queue.checkPunctuator('=')) {
                attrValue = {
                    name: attrName,
                    opt: AttributeOpt.equal,
                    value: queue.readQuote(),
                }
            } else if (queue.checkPunctuators(['^', '='])) {
                attrValue = {
                    name: attrName,
                    opt: AttributeOpt.startsWith,
                    value: queue.readQuote(),
                }
            } else if (queue.checkPunctuators(['$', '='])) {
                attrValue = {
                    name: attrName,
                    opt: AttributeOpt.endsWith,
                    value: queue.readQuote(),
                }
            } else if (queue.checkPunctuators(['*', '='])) {
                attrValue = {
                    name: attrName,
                    opt: AttributeOpt.contains,
                    value: queue.readQuote(),
                }
            }
            attrs.set(attrName, attrValue);
            queue.readPunctuator(']');
        }
        if (queue.checkPunctuator(':')) {
            if (queue.checkPunctuator(':')) {
                pseudoElement = queue.readName();
            } else {
                pseudoClass = queue.readName();
                if (queue.checkPunctuator('(')) {
                    let content = queue.checkNumber();
                    if (!content) {
                        content = queue.checkName();
                    } else {
                        const nameContent = queue.checkName();
                        if(nameContent){
                            content += nameContent;
                        }
                    }
                    pseudoClass = `${pseudoClass}(${content})`;
                    queue.readPunctuator(')');
                }
                if (queue.checkPunctuators([':', ':'])) {
                    pseudoElement = queue.readName();
                }
            }
        }
        const params = {
            name,
            pseudoClass,
            pseudoElement,
            attributes: attrs.size > 0 ? attrs : undefined,
            preSelector: preSelector,
        };
        return new Selector(params);
    }
}