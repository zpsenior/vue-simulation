export class Position {
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
    public inc() {
        this._col++;
        this._pos++;
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

export enum WordType {
    WORD = 1,
    NUMBER,
    DELIM,
    QUOTE1,
    QUOTE2,
    PUNCTUATOR,
    UNKNOWN
};

export class Word {
    readonly type: WordType;
    readonly text: string;
    readonly pos: Position;
    constructor(type: WordType, text: string, pos: any) {
        this.type = type;
        this.text = text;
        this.pos = new Position(pos);
    }
}

export abstract class TextParser {
    private _eof: boolean = false;
    private index: number = 0;
    readonly pos: Position = new Position();
    private save: string | undefined;
    private str: string = '';
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
        this.save = undefined;
        this.pos.reset();
        const array = [];
        while (!this.eof) {
            this.str = '';
            const word = this.readWord();
            if (word) {
                array.push(word);
            }
        }
        this.process(new WordQueue(array));
        return this;
    }

    abstract get tokens(): Token[];
    abstract process(queue: WordQueue): void;

    private readWord() {
        let status = null;
        const pos = this.pos;
        while (true) {
            let c = this.save ? this.save : this.readChar();
            if (!c) {
                this._eof = true;
                break;
            }
            const s = this.getType(c);
            if (c == '\n') {
                this.pos.newLine();
            }
            //console.log(`read char: ${c}, s: ${s}, status: ${status}`);
            if (status == null) {
                this.append(c);
                status = s;
            } else if (status == s) {
                if (s == WordType.PUNCTUATOR) {
                    this.save = c;
                    break;
                }
                this.append(c);
                if (s == WordType.QUOTE1) {
                    break;
                }
                if (s == WordType.QUOTE2) {
                    break;
                }
            } else {
                if (status == WordType.WORD && s == WordType.NUMBER) {
                    this.append(c);
                } else if (status == WordType.NUMBER && c == '.') {
                    this.append(c);
                } else if (status == WordType.QUOTE1) {
                    this.append(c);
                } else if (status == WordType.QUOTE2) {
                    this.append(c);
                } else {
                    this.save = c;
                    break;
                }
            }
        }
        const content = (this.str || '').trim();
        this.index++;
        if (status == null) {
            if (this._eof) {
                return;
            }
            throw new Error('not support word type: ' + content);
        }
        //console.log(`read word: ${content}, index: ${this.index}`);
        return new Word(status, content, { index: this.index, pos: pos.pos, row: pos.row, col: pos.col });
    }
    private append(ch: string) {
        this.str += ch;
        this.save = undefined;
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
    private getType(c: string): WordType {
        if (this.isLetter(c) || c == '_') {
            return WordType.WORD;
        } else if (this.isDigit(c)) {
            return WordType.NUMBER;
        } else if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            return WordType.DELIM;
        } else if (c == '"') {
            return WordType.QUOTE1;
        } else if (c == "'") {
            return WordType.QUOTE2;
        } else if (this.isSymbol(c)) {
            return WordType.PUNCTUATOR;
        }
        return WordType.UNKNOWN;
    }
    private isLetter(c: string) {
        return /^[a-zA-Z]+$/.test(c);
    }
    private isDigit(c: string) {
        return /^[0-9]+$/.test(c);
    }
    private isSymbol(c: string) {
        const code = c.charCodeAt(0);
        if (code >= 32 && code <= 47) {
            return true;
        }
        if (code >= 58 && code <= 64) {
            return true;
        }
        if (code >= 91 && code <= 96) {
            return true;
        }
        if (code >= 123 && code <= 126) {
            return true;
        }
        return false;
    }
}

export class WordQueue {
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
    forward(step: number) {
        const pos = this.currentPos + step;
        if (pos >= this.words.length || pos < -1) {
            return;
        }
        this.currentPos = pos;
    }
    checkWord() {
        const t = this.next();
        if (WordType.WORD == t.type) {
            logout("checkWord: " + t.text);
            return t.text;
        }
        this.forward(-1);
        return null;
    }
    checkNumber() {
        const t = this.next();
        if (WordType.NUMBER == t.type) {
            logout("checkNumber: " + t.text);
            return t.text;
        }
        this.forward(-1);
        return null;
    }
    public checkPunctuators(symbols: string[]) {
        const current = this.currentPos;
        for (const symbol of symbols) {
            if (!this.checkPunctuator(symbol)) {
                this.currentPos = current;
                return false;
            }
        }
        return true;
    }
    public checkPunctuator(symbol: string) {
        const t = this.next();
        if (t.text == symbol && WordType.PUNCTUATOR == t.type) {
            logout("checkPunctuator: " + t.text);
            return true;
        }
        this.forward(-1);
        return false;
    }
    public readWord() {
        const t = this.next();
        if (WordType.WORD == t.type) {
            logout("readWord: " + t.text);
            return;
        }
        throw new Error("expect word, but token[" + t.text + "]");
    }
    public readPunctuator(symbol: string) {
        const t = this.next();
        if (t.text == symbol && WordType.PUNCTUATOR == t.type) {
            logout("readPunctuator: " + t.text);
            return;
        }
        throw new Error("expect " + symbol + ", but token[" + t.text + "]");
    }
    public readPunctuators(symbols: string[]) {
        for (const symbol in symbols) {
            if (!this.checkPunctuator(symbol)) {
                const t = this.current;
                throw new Error("expect " + symbol + ", but token[" + t?.text + "]");
            }
        }
    }
}

export enum TokenType {
    TOKEN_TYPE_PUNCTUATOR = 1,
    TOKEN_TYPE_NAME,
    TOKEN_TYPE_QUOTE,
    TOKEN_TYPE_KEYWORD,
    TOKEN_TYPE_NUMBER,
    TOKEN_TYPE_COMMENT,
    TOKEN_TYPE_UNKNOWN,
    TOKEN_TYPE_END,
}

export class Token {
    readonly content: string;
    readonly type: TokenType;
    readonly pos: Position;
    constructor(content: string, type: TokenType, pos?: Position) {
        this.content = content;
        this.type = type;
        this.pos = pos || new Position();
    }
    toString() {
        return `{type: ${this.type}, content: ${this.content}, pos: ${this.pos.toString()}}`;
    }
}

function logout(_str: string) {
    //console.log(str);
}

const END = new Token("", TokenType.TOKEN_TYPE_END);

export class TokenQueue {
    readonly text: string;
    private _currentPos: number = -1;
    private tokens: Token[];
    constructor(parser: TextParser, filter?: (token: Token) => boolean) {
        this.text = parser.text;
        parser.parse();
        const tokens: Token[] = [];
        if (filter) {
            parser.tokens.forEach((token) => {
                if (filter(token)) {
                    tokens.push(token);
                    return;
                }
                logout('token: ' + token.toString());
            });
        }
        this.tokens = tokens.length > 0 ? tokens : parser.tokens;
    }
    private printTokens(pos: number) {
        const start = pos - 10;
        const end = pos + 10;
        let msg = '';
        for (let i = start; i < end; i++) {
            if (i < 0 || i >= this.tokens.length) {
                continue;
            }
            const token = this.tokens[i];
            msg += '\n' + token.pos.pos + ': ' + token.content;
            if (i == pos) {
                msg += ' <-- error';
            }
        }
        return msg;
    }
    public get currentPos() {
        return this._currentPos;
    }
    protected read() {
        const t = this.lookahead(1);
        if (t) {
            this._currentPos++;
        }
        return t;
    }

    public readToken() {
        const token = this.read();
        if (token == null) {
            return END;
        }
        return token;
    }

    forward(step: number) {
        const pos = this._currentPos + step;
        if (pos >= this.tokens.length || pos < -1) {
            return;
        }
        this._currentPos = pos;
    }

    public lookahead(step: number) {
        const pos = this._currentPos + step;
        if (pos >= this.tokens.length || pos < 0) {
            return null;
        }
        return this.tokens[pos];
    }
    public get current() {
        if (this._currentPos >= 0) {
            return this.tokens[this._currentPos];
        }
        return null;
    }
    public readPunctuator(symbol: string) {
        const t = this.readToken();
        if (t.content == symbol && TokenType.TOKEN_TYPE_PUNCTUATOR == t.type) {
            logout("readPunctuator: " + t.content);
            return;
        }
        throw new Error("expect " + symbol + ", but token" + t.toString() + " in txt: " + this.printTokens(this._currentPos));
    }
    public readPunctuators(symbols: string[]) {
        const current = this._currentPos;
        for (const symbol in symbols) {
            if (!this.checkPunctuator(symbol)) {
                this._currentPos = current;
                throw new Error("expect " + symbol + ", but token" + this.current?.toString() + " in txt: " + this.printTokens(this._currentPos));
            }
        }
    }
    public readQuote() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_QUOTE == t.type) {
            logout("readQuote: " + t.content);
            return t.content;
        }
        throw new Error("expect quote type, but token" + t.toString() + " in txt: " + this.printTokens(this._currentPos));
    }

    public readName() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_NAME == t.type) {
            logout("readName: " + t.content);
            return t.content;
        }
        throw new Error("expect name type, but token" + t.toString() + " in txt: " + this.printTokens(this._currentPos));
    }

    public readKeyword(word: string) {
        const t = this.readToken();
        if (t.content == word && TokenType.TOKEN_TYPE_KEYWORD == t.type) {
            logout("readKeyword: " + t.content);
            return;
        }
        throw new Error("expect keyword: " + word + ", but token" + t.toString() + " in txt: " + this.printTokens(this._currentPos));
    }

    public readNumber() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_NUMBER == t.type) {
            logout("readNumber: " + t.content);
            return t.content;
        }
        throw new Error("expect number type, but token" + t.toString() + " in txt: " + this.printTokens(this._currentPos));
    }

    public checkComment() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_COMMENT == t.type) {
            logout("checkComment: " + t.content);
            return true;
        }
        this.forward(-1);
        return false;
    }

    public checkPunctuators(symbols: string[]) {
        const current = this._currentPos;
        for (const symbol of symbols) {
            if (!this.checkPunctuator(symbol)) {
                this._currentPos = current;
                return false;
            }
        }
        return true;
    }

    public checkPunctuator(symbol: string) {
        const t = this.readToken();
        if (t.content == symbol && TokenType.TOKEN_TYPE_PUNCTUATOR == t.type) {
            logout("checkPunctuator: " + t.content);
            return true;
        }
        this.forward(-1);
        return false;
    }

    public checkKeyword(word: string) {
        const t = this.readToken();
        if (t.content == word && TokenType.TOKEN_TYPE_KEYWORD == t.type) {
            logout("checkKeyword: " + t.content);
            return true;
        }
        this.forward(-1);
        return false;
    }

    public checkQuote() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_QUOTE == t.type) {
            logout("checkQuote: " + t.content);
            return t.content;
        }
        this.forward(-1);
        return null;
    }

    public checkName() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_NAME == t.type) {
            logout("checkName: " + t.content);
            return t.content;
        }
        this.forward(-1);
        return null;
    }

    public checkNumber() {
        const t = this.readToken();
        if (TokenType.TOKEN_TYPE_NUMBER == t.type) {
            logout("readNumber: " + t.content);
            return t.content;
        }
        this.forward(-1);
        return null;
    }
    public check(words: string[]) {
        const current = this._currentPos;
        for (const word of words) {
            const t = this.readToken();
            if (t.content != word) {
                this._currentPos = current;
                return false;
            }
        }
        return true;
    }

    public adjacentNext() {
        const cur = this.current;
        if (!cur) {
            throw new Error('cannot get current token');
        }
        if (this._currentPos + 1 <= this.tokens.length - 1) {
            const next = this.tokens[this._currentPos + 1];
            return cur.pos.pos + cur.content.length == next.pos.pos;
        }
        return false;
    }

    public get eof() {
        return this._currentPos >= this.tokens.length - 2;
    }
}