class Position {
    readonly index: number;
    private _col: number;
    private _row: number;
    private _pos: number;
    constructor(params?: { index?: number, pos?: number, row?: number, col?: number }) {
        this.index = params?.index || 0;
        this._col = params?.col || 0;
        this._row = params?.row || 0;
        this._pos = params?.pos || 0;
    }
    public get col() {
        return this._col;
    }
    public get row() {
        return this._row;
    }
    public get pos() {
        return this._pos;
    }
    public inc(step: number = 1) {
        this._col += step;
        this._pos += step;
    }
    public dec() {
        this._col--;
        this._pos--;
    }
    public newLine() {
        this._col = 0;
        this._row++;
    }
    public reset() {
        this._col = 0;
        this._row = 0;
        this._pos = 0;
    }
    public toString() {
        return `{pos: ${this._pos}, row: ${this._row}, col: ${this._col}}`;
    }
}

enum WordType {
    TAG = 1,
    TAG_START = 2,
    TAG_END = 3,
    COMMENT = 4,
    TEXT = 5,
    CDATA = 6
};

class Word {
    readonly type: WordType;
    readonly text: string;
    readonly pos: Position;
    constructor(type: WordType, text: string, pos: any) {
        this.type = type;
        this.text = text;
        this.pos = new Position(pos);
    }
}

class WordQueue {
    private readonly words: Word[];
    private currentPos: number = 0;
    constructor(words: Word[]) {
        this.words = words;
    }
    public next() {
        const len = this.words.length;
        if (this.currentPos <= len - 1) {
            const word = this.words[this.currentPos];
            this.currentPos++;
            return word;
        }
        throw new Error('no more word');
    }
    public get eof() {
        return this.currentPos >= this.words.length;
    }
    public get current() {
        if (this.currentPos >= 0) {
            return this.words[this.currentPos];
        }
        return null;
    }
}

export class WordParser {
    private _eof: boolean = false;
    private index: number = 0;
    readonly pos: Position = new Position();
    private readonly _text: string;
    constructor(text: string) {
        this._text = text;
    }

    public get eof() {
        return this._eof;
    }

    public get text() {
        return this._text;
    }

    public parse() {
        this._eof = false;
        this.pos.reset();
        const array = this.readWords();
        return new WordQueue(array);
    }

    private readWords() {
        const pos = this.pos;
        const words: Word[] = [];
        while (true) {
            let c = this.readChar();
            if (!c) {
                this._eof = true;
                break;
            }
            if (c == '\n') {
                this.pos.newLine();
                continue;
            }
            if (c == '<') {
                const cdata = this.readCDATA();
                if (cdata) {
                    const word = new Word(WordType.CDATA, cdata, { index: this.index, pos: pos.pos, row: pos.row, col: pos.col });
                    words.push(word);
                    continue;
                }
                let content = this.readTag();
                if (!content) {
                    throw new Error('tag  is empty');
                }
                let type = WordType.TAG_START;
                if (content.startsWith('/')) {
                    content = content.substring(1);
                    type = WordType.TAG_END;
                } else if (content.endsWith('/')) {
                    content = content.substring(0, content.length - 1);
                    type = WordType.TAG;
                } else if (content.startsWith('!--')) {
                    if (!content.endsWith('--')) {
                        throw new Error('comment is not end');
                    }
                    content = content.substring(3, content.length - 2);
                    type = WordType.COMMENT;
                }
                const word = new Word(type, content, { index: this.index, pos: pos.pos, row: pos.row, col: pos.col });
                words.push(word);
                continue;
            }
            const content = this.readText(c);
            if (!content) {
                continue;
            }
            const word = new Word(WordType.TEXT, content, { index: this.index, pos: pos.pos, row: pos.row, col: pos.col });
            words.push(word);
        }
        return words;
    }
    private readCDATA() {
        if (this._text.startsWith('![CDATA[', this.pos.pos)) {
            const start = this.pos.pos + 8;
            const end = this._text.indexOf(']]>', start);
            if (end == -1) {
                throw new Error('cdata is not end');
            }
            const content = this._text.substring(start, end);
            this.pos.inc(8 + content.length + 3);
            return content;
        }
        return;
    }
    private readTag() {
        let tag = '';
        while (true) {
            const c = this.readChar();
            if (!c) {
                throw new Error('not tag end');
            }
            if (c == '\t') {
                tag += ' ';
                continue;
            }
            if (c == '\n') {
                this.pos.newLine();
                tag += ' ';
                continue;
            }
            if (c == '>') {
                break;
            }
            tag += c;
        }
        return tag;
    }
    private readText(startChar: string) {
        let text = startChar;
        while (true) {
            const c = this.readChar();
            if (!c) {
                // 如果到达文本末尾，返回已读取的文本
                break;
            }
            if (c == '\t') {
                text += ' ';
                continue;
            }
            if (c == '\n') {
                this.pos.newLine();
                text += ' ';
                continue;
            }
            if (c == '<') {
                this.pos.dec();
                break;
            }
            text += c;
        }
        return text.trim();
    }
    private readChar() {
        const index = this.pos.pos;
        if (index >= this._text.length) {
            return undefined;
        }
        this.pos.inc();
        const c = this._text[index];
        return c;
    }
}

export abstract class XMLObserver {
    onopentag(_name: string, _attrs: Map<string, string | undefined>) { }
    ontext(_text: string) { }
    oncdata(_text: string) { }
    onclosetag(_name: string) { }
    oncomment(_text: string) { }
    onend() { }
}

export class XMLReader {
    private readonly observer: XMLObserver;
    private readonly leafTags?: Set<string>;
    constructor(observer: XMLObserver, leafTags?: Set<string>) {
        this.observer = observer;
        this.leafTags = leafTags;
    }
    read(text: string) {
        const parser = new WordParser(text);
        const queue = parser.parse();
        this.process(queue);
    }
    private process(queue: WordQueue): void {
        const tags: string[] = [];
        let currentTag: string | null = null;
        while (!queue.eof) {
            const word = queue.next();
            if (word.type == WordType.COMMENT) {
                this.observer.oncomment(word.text);
                continue;
            }
            if (word.type == WordType.CDATA) {
                this.observer.oncdata(word.text);
                continue;
            }
            if (word.type == WordType.TEXT) {
                this.observer.ontext(word.text);
                continue;
            }
            if (word.type == WordType.TAG) {
                if (currentTag && this.leafTags && this.leafTags.has(currentTag)) {
                    this.observer.onclosetag(currentTag);
                    tags.pop();
                    currentTag = tags[tags.length - 1] || null;
                }
                const { tagName, attributes } = this.parseTag(word);
                this.observer.onopentag(tagName, attributes);
                this.observer.onclosetag(tagName);
                continue;
            }
            if (word.type == WordType.TAG_START) {
                if (currentTag && this.leafTags && this.leafTags.has(currentTag)) {
                    this.observer.onclosetag(currentTag);
                    tags.pop();
                    currentTag = tags[tags.length - 1] || null;
                }
                const { tagName, attributes } = this.parseTagStart(word);
                this.observer.onopentag(tagName, attributes);
                tags.push(tagName);
                currentTag = tagName;
                continue;
            }
            if (word.type == WordType.TAG_END) {
                const tagName = this.parseTagEnd(word);
                if (tagName != currentTag) {
                    throw new Error('tag end not match');
                }
                this.observer.onclosetag(tagName);
                tags.pop();
                currentTag = tags[tags.length - 1] || null;
                continue;
            }
        }
    }
    private parseTagEnd(word: Word) {
        const text = word.text;
        return text.trim();
    }
    private parseTag(word: Word) {
        const text = word.text;
        const pos = text.indexOf(' ');
        if (pos < 0) {
            return { tagName: text, attributes: new Map() };
        }
        const tagName = text.substring(0, pos);
        const attributes = this.buildAttributes(text.substring(pos + 1));
        return { tagName, attributes };
    }
    private parseTagStart(word: Word) {     
        const text = word.text;
        const pos = text.indexOf(' ');
        if (pos < 0) {
            return { tagName: text, attributes: new Map() };
        }
        const tagName = text.substring(0, pos);
        const attributes = this.buildAttributes(text.substring(pos + 1));
        return { tagName, attributes };
    }
    private buildAttributes(text: string) {
        const attributes = new Map();
        while (text) {
            const { key, hasValue, left } = this.readKey(text);
            if (hasValue) {
                const { value, next } = this.readValue(left.trimStart());
                attributes.set(key, value);
                text = next.trim();
            } else {
                attributes.set(key, undefined);
                text = left.trim();
            }
        };
        return attributes;
    }
    private readKey(text: string) {
        let pos = text.indexOf('=');
        if (pos > 0) {
            const key = text.substring(0, pos).trim();
            return { key, hasValue: true, left: text.substring(pos + 1) };
        }
        pos = text.indexOf(' ');
        if (pos < 0) {
            const key = text.trim();
            return { key, hasValue: false, left: '' };
        }
        const key = text.substring(0, pos).trim();
        return { key, hasValue: false, left: text.substring(pos + 1) };
    }
    private readValue(text: string) {
        if (text.startsWith('"')) {
            text = text.substring(1);
            const pos = text.indexOf('"');
            if (pos < 0) {
                throw new Error('value is not end with "');
            }
            const value = text.substring(0, pos);
            return { value: value, next: text.substring(pos + 1) };
        }
        if (text.startsWith('\'')) {
            text = text.substring(1);
            const pos = text.indexOf('\'');
            if (pos < 0) {
                throw new Error('value is not end with \'');
            }
            const value = text.substring(0, pos);
            return { value: value, next: text.substring(pos + 1) };
        }
        throw new Error('value is not start with " or \'');
    }
}