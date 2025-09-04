/* eslint-disable no-constant-condition */
import { decodeHTML, log } from "../utils/utils";

export type EventParam = (number | string | boolean | [] | Event);

export type OnEvent = (...params: EventParam[]) => void;

export interface Context {
    getVariable(name: string): any;
    getEvent(name: string): OnEvent;
}

enum TokenType {
    NONE = 1,
    NUMBER,
    NAME,
    QUOTA,
    SYMBOL
}

type Token = { type: TokenType, content: string }

const symbols = new Set(['+', '-', '*', '/', '=', '<', '>', '!', '(', ')', '[', ']', '{', '}', '.', '?', ':', ',', '|', '&']);

class TokenReader {

    readonly tokens: Token[] = [];

    private txtInclude: Set<string>;

    constructor(chars?: string[]) {
        this.txtInclude = new Set(chars || []);
    }

    read(content: string): Token[] {
        let quotation = "";
        let str = "";
        let ctype: TokenType = TokenType.NONE;

        const on = (type: TokenType, content: string) => {
            if (type != TokenType.NONE && content != "") {
                this.tokens.push({ type, content });
            }
            str = "";
        }

        for (let i = 0; i < content.length; i++) {
            const c = content[i];
            //log("c=" + c);
            if (c == '"' || c == "'") {
                if (ctype != TokenType.QUOTA) {
                    if (str) {
                        on(ctype, str);
                    }
                    quotation = c;
                    ctype = TokenType.QUOTA;
                } else if (quotation == c) {
                    on(ctype, str);
                    ctype = TokenType.NONE;
                } else {
                    str += c;
                }
                continue;
            } else if (ctype == TokenType.QUOTA) {
                str += c;
                continue;
            } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '$') {
                if (ctype == TokenType.NONE) {
                    ctype = TokenType.NAME;
                } else if (ctype == TokenType.NAME) {
                    //do nothing
                } else {
                    on(ctype, str);
                    ctype = TokenType.NAME;
                }
                str += c;
            } else if ((ctype == TokenType.NAME && this.txtInclude.has(c))) {
                str += c;
            } else if ((c >= '0' && c <= '9')) {
                if (ctype == TokenType.NONE) {
                    ctype = TokenType.NUMBER;
                } else if (ctype == TokenType.NUMBER || ctype == TokenType.NAME) {
                    //do nothing
                } else {
                    on(ctype, str);
                    ctype = TokenType.NUMBER;
                }
                str += c;
            } else if ((symbols.has(c))) {
                on(ctype, str);
                ctype = TokenType.SYMBOL;
                str += c;
            } else if (c == ' ' || c == '\t') {
                //do nothing
            } else {
                throw new Error("error token:" + c)
            }
        }
        on(ctype, str);
        return this.tokens;
    }
}

export abstract class ASTNode {
    abstract invoke(context: Context): any;
    abstract toString(): string;
}

enum Operation {
    ADD = 1,
    SUB,
    MUL,
    DIV
}

enum Compare {
    GT = 1,
    GE,
    EQ,
    NE,
    LT,
    LE
}

enum LogicType {
    AND,
    OR
}

export class ASTLogic extends ASTNode {
    readonly left: ASTNode;
    readonly opt: LogicType;
    readonly right: ASTNode;
    constructor(left: ASTNode, opt: LogicType, right: ASTNode) {
        super();
        this.left = left;
        this.opt = opt;
        this.right = right;
    }
    invoke(context: Context) {
        if (this.opt == LogicType.AND) {
            const lValue = this.left.invoke(context);
            if (!lValue) {
                return false;
            }
            const rValue = this.right.invoke(context);
            return lValue && rValue;

        } else if (this.opt == LogicType.OR) {
            const lValue = this.left.invoke(context);
            if (lValue) {
                return true;
            }
            const rValue = this.right.invoke(context);
            return lValue || rValue;
        }
    }
    toString() {
        let str = this.left.toString();
        switch (this.opt) {
            case LogicType.AND:
                str += " && ";
                break;
            case LogicType.OR:
                str += " || ";
                break;
        }
        str += this.right.toString();
        return str;
    }
}

export class ASTNot extends ASTNode {
    readonly ast: ASTNode;
    constructor(ast: ASTNode) {
        super();
        this.ast = ast;
    }
    invoke(context: Context) {
        return !this.ast.invoke(context);
    }
    toString() {
        let str = "!";
        str += this.ast.toString();
        return str;
    }
}

export class ASTCompare extends ASTNode {
    readonly left: ASTNode;
    readonly opt: Compare;
    readonly right: ASTNode;
    constructor(left: ASTNode, opt: string, right: ASTNode) {
        super();
        this.left = left;
        if (opt == ">") {
            this.opt = Compare.GT;
        } else if (opt == ">=") {
            this.opt = Compare.GE;
        } else if (opt == "<") {
            this.opt = Compare.LT;
        } else if (opt == "<=") {
            this.opt = Compare.LE;
        } else if (opt == "==") {
            this.opt = Compare.EQ;
        } else if (opt == "!=") {
            this.opt = Compare.NE;
        } else {
            throw new Error("error compare symbol[" + opt + "]");
        }
        this.right = right;
    }
    invoke(context: Context) {
        const lValue = this.left.invoke(context);
        const rValue = this.right.invoke(context);
        //log(lValue + '(' + this.opt + ')' + rValue);
        switch (this.opt) {
            case Compare.GT:
                return lValue > rValue;
            case Compare.GE:
                return lValue >= rValue;
            case Compare.EQ:
                return lValue == rValue;
            case Compare.NE:
                return lValue != rValue;
            case Compare.LT:
                return lValue < rValue;
            case Compare.LE:
                return lValue <= rValue;
        }
    }
    toString() {
        let str = this.left.toString();
        switch (this.opt) {
            case Compare.GT:
                str += " > ";
                break;
            case Compare.GE:
                str += " >= ";
                break;
            case Compare.EQ:
                str += " == ";
                break;
            case Compare.NE:
                str += " != ";
                break;
            case Compare.LT:
                str += " < ";
                break;
            case Compare.LE:
                str += " <= ";
                break;
        }

        str += this.right.toString();
        return str;
    }
}

export class ASTOperation extends ASTNode {
    readonly left: ASTNode;
    readonly opt: Operation;
    readonly right: ASTNode;
    constructor(left: ASTNode, opt: string, right: ASTNode) {
        super();
        this.left = left;
        if (opt == "+") {
            this.opt = Operation.ADD;
        } else if (opt == "-") {
            this.opt = Operation.SUB;
        } else if (opt == "*") {
            this.opt = Operation.MUL;
        } else if (opt == "/") {
            this.opt = Operation.DIV;
        } else {
            throw new Error("error math symbol:" + opt);
        }
        this.right = right;
    }
    invoke(context: Context) {
        const lValue = this.left.invoke(context);
        const rValue = this.right.invoke(context);
        switch (this.opt) {
            case Operation.ADD:
                return lValue + rValue;
            case Operation.SUB:
                return lValue - rValue;
            case Operation.MUL:
                return lValue * rValue;
            case Operation.DIV:
                return lValue / rValue;
        }
    }
    toString() {
        let str = this.left.toString();
        switch (this.opt) {
            case Operation.ADD:
                str += " + ";
                break;
            case Operation.SUB:
                str += " - ";
                break;
            case Operation.MUL:
                str += " * ";
                break;
            case Operation.DIV:
                str += " / ";
                break;
        }
        str += this.right.toString();
        return str;
    }
}

export class ASTJudgment extends ASTNode {
    readonly condition: ASTNode;
    readonly trueAst: ASTNode;
    readonly failAst: ASTNode;
    constructor(condition: ASTNode, trueAst: ASTNode, failAst: ASTNode) {
        super();
        this.condition = condition;
        this.trueAst = trueAst;
        this.failAst = failAst;
    }
    invoke(context: Context) {
        return this.condition.invoke(context) ? this.trueAst.invoke(context) : this.failAst.invoke(context);
    }
    toString() {
        let str = this.condition.toString();
        str += " ? " + this.trueAst.toString();
        str += " : " + this.failAst.toString();
        return str;
    }
}

export class ASTName extends ASTNode {
    readonly name: string;
    constructor(name: string) {
        super();
        this.name = name;
    }
    invoke(context: Context) {
        if (this.name == 'null') {
            return null;
        } else if (this.name == 'undefined') {
            return undefined;
        }
        return context.getVariable(this.name);
    }
    toString() {
        return this.name;
    }
}

export class ASTNumber extends ASTNode {
    readonly value: number;
    constructor(value: number) {
        super();
        this.value = value;
    }
    invoke(_context: Context) {
        return this.value;
    }
    toString() {
        return this.value + "";
    }
}

export class ASTBoolean extends ASTNode {
    readonly value: boolean;
    constructor(value: boolean) {
        super();
        this.value = value;
    }
    invoke(_context: Context) {
        return this.value;
    }
    toString() {
        return this.value == true ? "true" : "false";
    }
}

export class ASTText extends ASTNode {
    readonly text: string;
    constructor(text: string) {
        super();
        this.text = text;
    }
    invoke(_context: Context) {
        return this.text;
    }
    toString() {
        return "'" + this.text + "'";
    }
}

export class ASTPropertyGet extends ASTNode {
    readonly parent: ASTNode;
    readonly name: string | number | ASTNode;
    constructor(parent: ASTNode, name: string | number | ASTNode) {
        super();
        this.parent = parent;
        this.name = name;
    }
    invoke(context: Context) {
        const value = this.parent.invoke(context);
        if (!value) {
            throw new Error(this.toString() + ":" + this.parent.toString() + "'s value is empty");
        }
        if (this.name instanceof ASTNode) {
            const idx = this.name.invoke(context);
            return value[idx];
        } else {
            return value[this.name];
        }
    }
    toString() {
        let str = this.parent.toString();
        if (typeof this.name == "string") {
            str += "." + this.name;
        } else {
            str += "[" + this.name + "]";
        }
        return str;
    }
}

export class ASTInvoke extends ASTNode {
    readonly name: string;
    readonly params: ASTNode[];
    constructor(name: string, params: ASTNode[]) {
        super();
        this.name = name;
        this.params = params;
    }
    invoke(context: Context) {
        const paramValues = [];
        for (const param of this.params) {
            const value = param.invoke(context);
            paramValues.push(value);
        }
        const event = context.getEvent(this.name);
        return event(...paramValues);
    }
    toString() {
        let str = this.name;
        if (this.params.length > 0) {
            str += "(";
            let first = true;
            for (const param of this.params) {
                if (!first) {
                    str += ", ";
                }
                str += param.toString();
                first = false;
            }
            str += ")";
        }
        return str;
    }
}

export class ASTArray extends ASTNode {
    readonly items: ASTNode[];
    constructor(items: ASTNode[]) {
        super();
        this.items = items;
    }
    invoke(context: Context) {
        const values = [];
        for (const item of this.items) {
            const value = item.invoke(context);
            values.push(value);
        }
        return values;
    }
    toString() {
        let str = "[";
        let first = true;
        for (const item of this.items) {
            if (!first) {
                str += ", ";
            }
            str += item.toString();
            first = false;
        }
        str += "]";
        return str;
    }
}

export class ASTStyleClassItem extends ASTNode {
    readonly key: ASTNode;
    readonly value: ASTNode;
    constructor(key: ASTNode, value: ASTNode) {
        super();
        this.key = key;
        this.value = value;
    }
    invoke(context: Context) {
        return this.value.invoke(context) ? this.key.toString() : "";
    }
    toString() {
        return this.key.toString() + ":" + this.value.toString();
    }
}

export type VarReplace = (name: string) => string;

export class SyntaxReader {
    readonly tokens: Token[] = [];
    private pos: number = -1;
    private eof: boolean = false;
    private varReplace?: VarReplace;

    constructor(content: string, option?: { txtInclude?: string[], varReplace?: VarReplace }) {
        //log("syntax:" + content);
        content = decodeHTML(content);
        this.tokens = (new TokenReader(option?.txtInclude)).read(content);
        this.varReplace = option?.varReplace;
        log("tokens:" + JSON.stringify(this.tokens));
    }

    private hasNext(): boolean {
        return !this.eof;
    }

    private next(): Token {
        if (this.pos + 1 < this.tokens.length) {
            this.pos++;
        } else {
            this.eof = true;
        }
        const token = this.tokens[this.pos];
        //log("next:" + JSON.stringify(token));
        return token;
    }
    private decr(count: number = 1) {
        //log("decr pos:" + this.pos + ", count:" + count);
        if (this.pos - count >= -1) {
            this.pos -= count;
        }
    }

    readName(): string {
        //log("readName");
        if (!this.hasNext()) {
            throw new Error("expression is eof");
        }
        const token = this.next();
        if (token.type != TokenType.NAME) {
            throw new Error("token{type:" + token.type + ", content:" + token.content + "} type is not [name]");
        }
        return token.content;
    }

    readText(): string {
        //log("readText");
        if (!this.hasNext()) {
            throw new Error("expression is eof");
        }
        const token = this.next();
        if (token.type != TokenType.QUOTA) {
            throw new Error("token type is not [string]");
        }
        return token.content;
    }

    isBoolean(): boolean {
        //log("isBoolean");
        if (!this.hasNext()) {
            return false;
        }
        const token = this.next();
        if (token.type != TokenType.NAME) {
            this.decr();
            return false;
        }
        this.decr();
        const value = token.content.toLowerCase();
        if (value == "true" || value == "false") {
            return true;
        }
        return false;
    }

    isNumber(): boolean {
        if (!this.hasNext()) {
            return false;
        }
        const token = this.next();
        if (token.type != TokenType.NUMBER) {
            this.decr();
            return false;
        }
        this.decr();
        return true;
    }

    isText(): boolean {
        if (!this.hasNext()) {
            return false;
        }
        const token = this.next();
        if (token.type != TokenType.QUOTA) {
            this.decr();
            return false;
        }
        this.decr();
        return true;
    }

    readBoolean() {
        //log("readBoolean");
        if (!this.hasNext()) {
            throw new Error("expression is eof");
        }
        const token = this.next();
        if (token.type != TokenType.NAME) {
            throw new Error("{type:" + token.type + ", content:" + token.content + "} type is not [bool]");
        }
        if (token.content.toLowerCase() == "true") {
            return true;
        } else if (token.content.toLowerCase() == "false") {
            return false;
        }
        throw new Error(token.content + " is not bool type!");
    }

    readNumber(): number {
        //log("readNumber");
        if (!this.hasNext()) {
            throw new Error("expression is eof");
        }
        const token = this.next();
        if (token.type != TokenType.NUMBER) {
            throw new Error("{type:" + token.type + ", content:" + token.content + "} type is not [number]");
        }
        return parseFloat(token.content);
    }

    readSymbol(): string {
        //log("readSymbol");
        if (!this.hasNext()) {
            throw new Error("expression is eof");
        }
        const token = this.next();
        if (token.type != TokenType.SYMBOL) {
            throw new Error("token type is not [symbol]");
        }
        return token.content;
    }

    checkSymbol(symbol: string) {
        //log("checkSymbol");
        if (!this.hasNext()) {
            throw new Error("expression is eof");
        }
        const token = this.next();
        if (token.type != TokenType.SYMBOL) {
            throw new Error("token is not symbol");
        }
        if (symbol != token.content) {
            throw new Error("expect symbol:" + symbol + ", but '" + token.content + "'");
        }
        return;
    }

    mtachSymbol(symbol: string): boolean {
        //log("mtachSymbol:" + symbol);
        if (!this.hasNext()) {
            return false;
        }
        const token = this.next();
        if (token.type != TokenType.SYMBOL || symbol != token.content) {
            this.decr();
            return false;
        }
        return true;
    }

    mtachSymbols(...symbols: string[]): boolean {
        //log("mtachSymbols");
        for (const symbol of symbols) {
            const rel = this.mtachSymbol(symbol);
            if (rel) {
                return true;
            }
        }
        return false;
    }
    readSymbols(...symbols: string[]): string | undefined {
        //log("readSymbols");
        for (const symbol of symbols) {
            const rel = this.mtachSymbol(symbol);
            if (rel) {
                return symbol;
            }
        }
        return undefined;
    }

    parseName(name: string) {
        if (this.varReplace) {
            name = this.varReplace(name);
        }
        return new ASTName(name);
    }

    parseVar(): ASTNode {
        const match = this.mtachSymbol("!");
        let name = this.readName();
        let opt = this.readSymbols("(");
        if (opt) {
            return this.parseCall(name);
        }
        let ast: ASTNode = this.parseName(name);
        while (true) {
            opt = this.readSymbols(".", "[");
            if (!opt) {
                break;
            }
            if (opt == ".") {
                name = this.readName();
                ast = new ASTPropertyGet(ast, name);
            } else if (opt == "[") {
                if (this.isNumber()) {
                    const num = this.readNumber();
                    ast = new ASTPropertyGet(ast, num);
                } else if (this.isText()) {
                    name = this.readName();
                    ast = new ASTPropertyGet(ast, name);
                } else {
                    name = this.readName();
                    let param: ASTNode = this.parseName(name);
                    while (this.mtachSymbol('.')) {
                        name = this.readName();
                        param = new ASTPropertyGet(param, name);
                    }
                    ast = new ASTPropertyGet(ast, param);
                }
                this.checkSymbol("]");
            }
        }
        if (match) {
            ast = new ASTNot(ast);
        }
        return ast;
    }

    parseTerm(): ASTNode {
        if (this.isText()) {
            const txt = this.readText();
            return new ASTText(txt);
        } else if (this.isNumber()) {
            const num = this.readNumber();
            return new ASTNumber(num);
        } else if (this.isBoolean()) {
            const bool = this.readBoolean();
            return new ASTBoolean(bool);
        }
        return this.parseVar();
    }

    parseBracket(): ASTNode {
        if (this.readSymbols("(")) {
            const expr = this.parseExpression();
            this.checkSymbol(")");
            return expr;
        }
        return this.parseTerm();
    }

    parseMult(): ASTNode {
        let opt;
        let expr = this.parseBracket();
        while ((opt = this.readSymbols("*", "/"))) {
            const right = this.parseBracket();
            expr = new ASTOperation(expr, opt, right);
        }
        return expr;
    }

    parseExpression(): ASTNode {
        let opt;
        let expr = this.parseMult();
        while ((opt = this.readSymbols("+", "-"))) {
            const right = this.parseMult();
            expr = new ASTOperation(expr, opt, right);
        }

        opt = this.readSymbols("<", ">", "=", "!");
        if (opt) {
            expr = this.parseConditionRight(expr, opt);
        }
        expr = this.parseAndOr(expr);
        if (this.mtachSymbol("?")) {
            const success = this.parseExpression();
            this.checkSymbol(":");
            const fail = this.parseExpression();
            return new ASTJudgment(expr, success, fail);
        }
        return expr;
    }

    parseEventTrigger(): ASTInvoke {
        const name = this.readName();
        if (this.readSymbols("(")) {
            return this.parseCall(name);
        }
        return new ASTInvoke(name, []);
    }

    parseCall(name: string): ASTInvoke {
        const params: ASTNode[] = [];
        do {
            const param = this.parseExpression();
            params.push(param);
        } while (this.mtachSymbol(","))
        this.checkSymbol(")");
        return new ASTInvoke(name, params);
    }

    parseConditionRight(left: ASTNode, opt1: string): ASTNode {
        const opt2 = this.readSymbols("=");
        if(this.readSymbols("=")) {
            if(opt1 != '=') {
                throw new Error('not support: ' + opt1 + opt2 + '=');
            }
        }
        const opt = opt2 ? opt1 + opt2 : opt1;
        const right = this.parseExpression();
        const condition = new ASTCompare(left, opt, right);
        return condition;
    }

    parseAndOr(left: ASTNode) {
        let expr = left;
        while (true) {
            let opt = this.readSymbols("|", "&");
            if (!opt) {
                break;
            }
            let type;
            if (opt == "|") {
                this.checkSymbol("|");
                type = LogicType.OR;
            } else if (opt == "&") {
                this.checkSymbol("&");
                type = LogicType.AND;
            } else {
                throw new Error("error logic type!");
            }
            let right = this.parseTerm();
            opt = this.readSymbols("<", ">", "=", "!");
            if (opt) {
                right = this.parseConditionRight(right, opt);
            }
            expr = new ASTLogic(expr, type, right);
        }
        return expr;
    }

    parseConditions(): ASTNode {
        let opt;
        let expr = this.parseMult();
        while ((opt = this.readSymbols("+", "-"))) {
            const right = this.parseMult();
            expr = new ASTOperation(expr, opt, right);
        }
        opt = this.readSymbols("<", ">", "=", "!");
        if (opt) {
            expr = this.parseConditionRight(expr, opt);
        }
        expr = this.parseAndOr(expr);
        return expr;
    }

    parseStyleClass(): ASTNode {
        const symbol = this.readSymbols("[", "{");
        if (symbol == '[') {
            return this.parseStyleClassArray();
        } else if (symbol == '{') {
            return this.parseStyleClassObject();
        }
        return this.parseExpression();
    }

    private parseStyleClassArray(): ASTArray {
        const items: ASTNode[] = [];
        do {
            const item = this.parseStyleClassItem();
            items.push(item);
        } while (this.mtachSymbol(","))
        this.checkSymbol("]");
        return new ASTArray(items);
    }

    private parseStyleClassItem(): ASTNode {
        if(this.mtachSymbol('{')) {
            const item = this.parseStyleClassProp();
            this.checkSymbol('}');
            return item;
        }
        let key: ASTNode;
        const expr = this.parseExpression();
        if (expr instanceof ASTText) {
            key = expr;
        } else if (expr instanceof ASTName) {
            key = new ASTInvoke(expr.name, []);
        } else if (expr instanceof ASTJudgment) {
            key = expr;
        } else {
            throw new Error('style class key must be text, name or judgment, but ' + expr.toString());
        }
        return key;
    }

    private parseStyleClassObject(): ASTArray {
        const items: ASTNode[] = [];
        do {
            const item = this.parseStyleClassProp();
            items.push(item);
        } while (this.mtachSymbol(","))
        this.checkSymbol("}");
        return new ASTArray(items);
    }

    parseStyleClassProp(): ASTNode {
        let key: ASTNode;
        if(this.isText()) {
            const txt = this.readText();
            key = new ASTText(txt);
        } else {
            const name = this.readName();
            key = new ASTText(name);
        }
        this.checkSymbol(':');
        const condition = this.parseConditions();
        return new ASTJudgment(condition, key, new ASTText(""));
    }
}