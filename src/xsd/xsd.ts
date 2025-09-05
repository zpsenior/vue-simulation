import { FileFinder } from "../utils/base";
import { log, uuid } from "../utils/utils";
import { BaseType, getBaseTypeName, inferType, isBaseType, Limitation, parseBaseType, validateValue, WhiteSpace } from "./xsd-base";
import { XSDNode, XSDReader, XSDRoot } from "./xsd-reader";
import { afterList, AllMatcher, beforeList, ChoiceMatcher, ElementMatcher, SequenceMatcher, siblingList, UnionMatcher, IndicatorMatcher } from "./xsd-validate";

interface Content {
    getAttributeNames(names: string[]): void;
    findAttribute(name: string, prefix: string): MatchAttribute | undefined;
}

export abstract class MatchAttribute {
    readonly prefix: string;
    readonly name: string;
    constructor(name: string | undefined, prefix: string) {
        if (!name) {
            throw new Error("atrribute`s name can not be empty!");
        }
        this.name = name;
        this.prefix = prefix;
    }
    abstract getType(): SimpleType;
    abstract validateValue(value: string | undefined): string | undefined;
}

export interface MatchElement {
    readonly prefix: string;
    readonly name: string;
    match(xpath: string, name: string): MatchElement;
    matchAttribute(xpath: string, attrName: string, attrValue: string | undefined): string | undefined;
    matchText(xpath: string, text: string): string | undefined;
    getChild(index?: number): ElementMatcher | undefined;
    childList(lastChild?: string): UnionMatcher[];
    siblingList(last?: string): UnionMatcher[];
    beforeList(sibling?: string): UnionMatcher[];
    afterList(sibling?: string): UnionMatcher[];
    findElement(name: string, prefix?: string): MatchElement | undefined;
    attributeNames(): string[];
    findAttribute(key: string, prefix?: string): MatchAttribute | undefined;
}

abstract class OccursTime {
    readonly maxOccurs: number;
    readonly minOccurs: number;
    readonly typeName: string;
    readonly node: XSDNode;
    constructor(typeName: string, node: XSDNode) {
        this.typeName = typeName;
        this.node = node;
        let str = node.getAttribute("maxOccurs");

        if (str == "unbounded") {
            this.maxOccurs = Number.MAX_SAFE_INTEGER;
        } else if (str && /(^[1-9]\d*$)/.test(str)) {
            this.maxOccurs = parseInt(str);
        } else {
            this.maxOccurs = 1;
        }

        str = node.getAttribute("minOccurs");
        if (str && /(^[1-9]\d*$)/.test(str)) {
            this.minOccurs = parseInt(str);
        } else {
            this.minOccurs = 1;
        }
    }
    buildStr(array: string[]) {
        array.push(`"type": "${this.typeName}"`);
        if (this.maxOccurs != 1) {
            array.push(`"maxOccurs": "${this.maxOccurs}"`);
        }
        if (this.minOccurs != 1) {
            array.push(`"minOccurs": "${this.minOccurs}"`);
        }
    }
}

export abstract class Restriction {
    readonly base: XSDType;
    constructor(schema: XSDSchema, node: XSDNode) {
        const base = node.getAttribute("base");
        if (base) {
            this.base = schema.findType(base);
            return;
        }
        throw new Error("lack base attribute");
    }

    abstract validateValue(value: string): string | undefined;
}

export class SimpleTypeRestriction extends Restriction {
    readonly limit: Limitation;
    getBase(): BaseType {
        return (this.base as SimpleType).base;
    }
    constructor(schema: XSDSchema, node: XSDNode) {
        super(schema, node);
        const limit = new Limitation((this.base as SimpleType).base);
        const count = node.childrenCount();
        for (let i = 0; i < count; i++) {
            const child = node.getChild(i);
            const name = child.name;
            let value = child.getAttribute("value");
            if (!value) {
                value = "";
            }
            if (name == "pattern") {
                /*if (value.startsWith('base64:')) {
                    value = decodeBase64(value);
                }*/
                limit.pattern = value;
            } else if (name == "length") {
                limit.length = parseInt(value);
            } else if (name == "maxLength") {
                limit.maxLength = parseInt(value);
            } else if (name == "minLength") {
                limit.minLength = parseInt(value);
            } else if (name == "enumeration") {
                if (!limit.enumeration) {
                    limit.enumeration = [];
                }
                limit.addEnum(value);
            } else if (name == "maxInclusive") {
                limit.maxInclusive = parseFloat(value);
            } else if (name == "minInclusive") {
                limit.minInclusive = parseFloat(value);
            } else if (name == "maxExclusive") {
                limit.maxExclusive = parseFloat(value);
            } else if (name == "minExclusive") {
                limit.minExclusive = parseFloat(value);
            } else if (name == "totalDigits") {
                limit.totalDigits = parseFloat(value);
            } else if (name == "fractionDigits") {
                limit.fractionDigits = parseFloat(value);
            } else if (name == "whiteSpace") {
                value = value.trim();
                limit.whiteSpace = value == "collapse" ? WhiteSpace.collapse : (value == "replace" ? WhiteSpace.replace : WhiteSpace.preserve);
            }
        }
        this.limit = limit;
    }
    toString(): string {
        const array: string[] = [];
        this.buildProps(array);
        return `{${array.join(', ')}}`;
    }
    protected buildProps(array: string[]) {
        array.push(`"base": ${this.base.toString()}`);
        this.limit.buildStr(array);
    }

    validateValue(value: string): string | undefined {
        return this.limit.validateValue(value);
    }
}

export abstract class XSDType {
    readonly name: string;
    constructor(name: string) {
        this.name = name;
    }
}

export class SimpleType extends XSDType {
    readonly base: BaseType;
    constructor(name: string, base?: BaseType) {
        super(name);
        this.base = base ? base : parseBaseType(name);
    }
    validateValue(value: string): string | undefined {
        return this.base ? validateValue(this.base, value) : undefined;
    }
    toString(): string {
        return `{"name": "${this.name}", "type": "simple", "base": "${this.base.toString()}"}`;
    }
}

export class ExtSimpleType extends SimpleType {
    readonly restriction: SimpleTypeRestriction;
    constructor(name: string, restriction: SimpleTypeRestriction) {
        super(name, restriction.getBase());
        this.restriction = restriction;
    }
    static build(name: string, schema: XSDSchema, node: XSDNode): SimpleType {
        const restriction = new SimpleTypeRestriction(schema, node);
        const type = new ExtSimpleType(name, restriction);
        schema.types.set(name, type);
        return type;
    }
    validateValue(value: string): string | undefined {
        const ret = super.validateValue(value);
        if (ret) {
            return ret;
        }
        return this.restriction.validateValue(value);
    }
    toString(): string {
        return `{"name": "${this.name}", "type": "extSimple", "base": "${this.base.toString()}", "restriction": ${this.restriction.toString()}}`;
    }
}

export class ListType extends SimpleType {
    readonly type: SimpleType;
    getBaseType(): SimpleType {
        return this.type;
    }
    private constructor(name: string, type: SimpleType) {
        super(name, type.base);
        this.type = type;
    }
    static build(name: string, schema: XSDSchema, node: XSDNode): ListType {
        const typeName = node.getAttribute("itemType");
        let stype: SimpleType;
        if (typeName) {
            stype = schema.findSimpleType(typeName);
        } else {
            const child = node.getChild(0);
            stype = schema.buildSimpleExtend(child);
        }
        const ltype = new ListType(name, stype);
        schema.types.set(name, ltype);
        return ltype;
    }
    validateValue(strValue: string): string | undefined {
        const values: string[] = strValue.split(" ");
        for (let i = 0; i < values.length; i++) {
            const ret = this.type.validateValue(values[i]);
            if (ret) {
                return ret;
            }
        }
        return;
    }
    toString(): string {
        return `{"name": "${this.name}", "type": "list", "base": "${this.type.toString()}"}`;
    }
}

export class UnionType extends SimpleType {
    readonly types: Map<string, SimpleType>;
    constructor(name: string, types: Map<string, SimpleType>) {
        super(name, BaseType.ANY);
        this.types = types;
    }
    static build(name: string, schema: XSDSchema, node: XSDNode): UnionType {
        const types: Map<string, SimpleType> = new Map();
        const typeNames = node.getAttribute("memberTypes");
        if (typeNames) {
            const names: string[] = typeNames.split(" ");
            names.forEach((name) => {
                const type = schema.findSimpleType(name);
                types.set(name, type);
            });
        } else {
            const count = node.childrenCount();
            for (let i = 0; i < count; i++) {
                const child = node.getChild(i);
                const type = schema.buildSimpleExtend(child);
                types.set(type.name, type);
            }
        }
        const utype = new UnionType(name, types);
        schema.types.set(name, utype);
        return utype;
    }
    validateValue(value: string): string | undefined {
        for (const item of this.types) {
            const type = item[1];
            const ret = type.validateValue(value);
            if (!ret) {
                return;
            }
        }
        return "not match any union type";
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        array.push(`"type": "union"`);
        const str: string[] = [];
        for (const item of this.types) {
            str.push(item[1].toString());
        }
        array.push(`"member": [${str.join(",")}]`);
        return `{${array.join(', ')}}`;
    }
}

export class ComplexType extends XSDType {

    readonly content: Content;
    constructor(schema: XSDSchema, node: XSDNode) {
        super(getName(node))
        schema.types.set(this.name, this);
        const child = node.getChild(0);
        if (child.name == "simpleContent") {
            this.content = new SimpleContent(schema, child);
        } else if (child.name == "complexContent") {
            this.content = new ComplexContent(schema, child);
        } else {
            this.content = new BaseContent(schema, node);//必须是node
        }

        function getName(node: XSDNode): string {
            const name = node.getAttribute("name");
            return name ? name : "ctype" + uuid();
        }
    }
    findElement(name: string, prefix: string): MatchElement | undefined {
        if (this.content instanceof ComplexContent) {
            return (this.content as ComplexContent).findElement(name, prefix);
        } else if (this.content instanceof BaseContent) {
            return (this.content as BaseContent).findElement(name, prefix);
        }
        return undefined;
    }
    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.content) {
            return this.content.findAttribute(name, prefix);
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        array.push(`"type": "complex"`);
        array.push(`"content": ${this.content.toString()}`);
        return `{${array.join(', ')}}`;
    }
}

export class SimpleContentRestriction extends SimpleTypeRestriction {
    readonly attributes: Map<string, XSDAttribute | AttributeGroup> | undefined;
    readonly anyAttribute: AnyAttribute | undefined;

    constructor(schema: XSDSchema, node: XSDNode) {
        super(schema, node);
        this.attributes = AttributeGroup.buildAttributes(schema, node);
        this.anyAttribute = AnyAttribute.buildAnyAttribute(node);

    }

    getAttributeNames(names: string[]) {
        if (!this.attributes) {
            return;
        }
        for (const item of this.attributes) {
            const attr = item[1];
            if (attr instanceof XSDAttribute) {
                names.push(item[0]);
            } else if (attr instanceof AttributeGroup) {
                attr.getAttributeNames(names);
            }
        }
    }

    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.attributes) {
            const attr = AttributeGroup.lookupAttribute(this.attributes, name, prefix);
            if (attr) {
                return attr;
            }
        }
        if (this.anyAttribute) {
            return this.anyAttribute;
        }
        return undefined;
    }

    toString(): string {
        const array: string[] = [];
        this.buildProps(array);
        if (this.attributes) {
            const attrs: string[] = [];
            this.attributes.forEach((value) => {
                attrs.push(value.toString());
            });
            if (attrs.length > 0) {
                array.push(`"attributes": [${attrs.join(",")}]`);
            }
        }
        if (this.anyAttribute) {
            array.push(`"anyAttribute": ${this.anyAttribute.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

export class ComplexContentRestriction extends Restriction {
    readonly elements: Group | All | Choice | Sequence | undefined;
    readonly attributes: Map<string, XSDAttribute | AttributeGroup> | undefined;
    readonly anyAttribute: AnyAttribute | undefined;

    constructor(schema: XSDSchema, node: XSDNode) {
        super(schema, node);
        const count = node.childrenCount();
        for (let i = 0; i < count; i++) {
            const child = node.getChild(i);
            if (child.name == "group") {
                this.elements = new Group(schema, undefined, child);
            } else if (child.name == "all") {
                this.elements = new All(schema, undefined, child);
            } else if (child.name == "choice") {
                this.elements = new Choice(schema, undefined, child);
            } else if (child.name == "sequence") {
                this.elements = new Sequence(schema, undefined, child);
            }
            if (this.elements) {
                break;
            }
        }
        this.attributes = AttributeGroup.buildAttributes(schema, node);
        this.anyAttribute = AnyAttribute.buildAnyAttribute(node);

    }
    getAttributeNames(names: string[]) {
        if (!this.attributes) {
            return;
        }
        for (const item of this.attributes) {
            const attr = item[1];
            if (attr instanceof XSDAttribute) {
                names.push(item[0]);
            } else if (attr instanceof AttributeGroup) {
                attr.getAttributeNames(names);
            }
        }
    }

    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.attributes) {
            const attr = AttributeGroup.lookupAttribute(this.attributes, name, prefix);
            if (attr) {
                return attr;
            }
        }
        if (this.anyAttribute) {
            return this.anyAttribute;
        }
        return undefined;
    }

    getElements(unions: UnionMatcher[]) {
        if (this.elements) {
            this.elements.getElements(unions);
        }
    }

    findElement(name: string, prefix: string): MatchElement | undefined {
        if (this.elements) {
            return this.elements.findElement(name, prefix);
        }
        return undefined;
    }
    validateValue(_value: string): string {
        return "not support this method";
    }

    toString(): string {
        const array: string[] = [];
        array.push(`"base": ${this.base.toString()}`);
        if (this.elements) {
            array.push(`"elements": ${this.elements.toString()}`);
        }
        if (this.attributes) {
            const attrs: string[] = [];
            this.attributes.forEach((value) => {
                attrs.push(value.toString());
            });
            if (attrs.length > 0) {
                array.push(`"attributes": [${attrs.join(",")}]`);
            }
        }
        if (this.anyAttribute) {
            array.push(`"anyAttribute": ${this.anyAttribute.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

class SimpleExtension {
    readonly base: SimpleType;
    readonly attributes: Map<string, XSDAttribute | AttributeGroup> | undefined;
    readonly anyAttribute: AnyAttribute | undefined;
    constructor(schema: XSDSchema, node: XSDNode) {
        const base = node.getAttribute("base");
        if (!base) {
            throw new Error("lack base attribute");
        }
        this.base = schema.findSimpleType(base);
        this.attributes = AttributeGroup.buildAttributes(schema, node);
        this.anyAttribute = AnyAttribute.buildAnyAttribute(node);

    }
    getAttributeNames(names: string[]) {
        if (!this.attributes) {
            return;
        }
        for (const item of this.attributes) {
            const attr = item[1];
            if (attr instanceof XSDAttribute) {
                names.push(item[0]);
            } else if (attr instanceof AttributeGroup) {
                attr.getAttributeNames(names);
            }
        }
    }
    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.attributes) {
            const attr = AttributeGroup.lookupAttribute(this.attributes, name, prefix);
            if (attr) {
                return attr;
            }
        }
        if (this.anyAttribute) {
            return this.anyAttribute;
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"base": ${this.base.toString()}`);
        if (this.attributes) {
            const attrs: string[] = [];
            this.attributes.forEach((value) => {
                attrs.push(value.toString());
            });
            if (attrs.length > 0) {
                array.push(`"attributes": [${attrs.join(",")}]`);
            }
        }
        if (this.anyAttribute) {
            array.push(`"anyAttribute": ${this.anyAttribute.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

class ComplexExtension {
    readonly base: XSDType;
    readonly elements: Group | All | Choice | Sequence | undefined;
    readonly attributes: Map<string, XSDAttribute | AttributeGroup> | undefined;
    readonly anyAttribute: AnyAttribute | undefined;
    constructor(schema: XSDSchema, node: XSDNode) {
        const base = node.getAttribute("base");
        if (!base) {
            throw new Error("lack base attribute");
        }
        this.base = schema.findType(base);
        const count = node.childrenCount();
        for (let i = 0; i < count; i++) {
            const child = node.getChild(i);
            if (child.name == "group") {
                this.elements = new Group(schema, undefined, child);
            } else if (child.name == "all") {
                this.elements = new All(schema, undefined, child);
            } else if (child.name == "choice") {
                this.elements = new Choice(schema, undefined, child);
            } else if (child.name == "sequence") {
                this.elements = new Sequence(schema, undefined, child);
            }
            if (this.elements) {
                break;
            }
        }
        this.attributes = AttributeGroup.buildAttributes(schema, node);
        this.anyAttribute = AnyAttribute.buildAnyAttribute(node);

    }
    getAttributeNames(names: string[]) {
        if (!this.attributes) {
            return;
        }
        for (const item of this.attributes) {
            const attr = item[1];
            if (attr instanceof XSDAttribute) {
                names.push(item[0]);
            } else if (attr instanceof AttributeGroup) {
                attr.getAttributeNames(names);
            }
        }
    }
    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.attributes) {
            const attr = AttributeGroup.lookupAttribute(this.attributes, name, prefix);
            if (attr) {
                return attr;
            }
        }
        if (this.anyAttribute) {
            return this.anyAttribute;
        }
        return undefined;
    }
    getElements(unions: UnionMatcher[]) {
        if (this.elements) {
            this.elements.getElements(unions);
        }
    }
    findElement(name: string, prefix: string): MatchElement | undefined {
        if (this.base instanceof ComplexType) {
            const ele = (this.base as ComplexType).findElement(name, prefix);
            if (ele) {
                return ele;
            }
        }
        if (this.elements) {
            return this.elements.findElement(name, prefix);
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"base": "${this.base.toString()}"`);
        if (this.elements) {
            array.push(`"elements": ${this.elements.toString()}`);
        }
        if (this.attributes) {
            const attrs: string[] = [];
            this.attributes.forEach((value) => {
                attrs.push(value.toString());
            });
            if (attrs.length > 0) {
                array.push(`"attributes": [${attrs.join(",")}]`);
            }
        }
        if (this.anyAttribute) {
            array.push(`"anyAttribute": ${this.anyAttribute.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

export class SimpleContent implements Content {
    readonly restriction: SimpleContentRestriction | undefined;
    readonly extension: SimpleExtension | undefined;
    constructor(schema: XSDSchema, node: XSDNode) {
        const child = node.getChild(0);
        if (child.name == "restriction") {
            this.restriction = new SimpleContentRestriction(schema, child);
        } else if (child.name == "extension") {
            this.extension = new SimpleExtension(schema, child);
        }
    }
    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.extension) {
            return this.extension.findAttribute(name, prefix);
        }
        return undefined;
    }
    getAttributeNames(names: string[]) {
        if (this.extension) {
            this.extension.getAttributeNames(names);
        }
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"type": "simpleContent"`);
        if (this.restriction) {
            array.push(`"restriction": ${this.restriction.toString()}`);
        }
        if (this.extension) {
            array.push(`"extension": ${this.extension.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

export class BaseContent implements Content {
    readonly elements: Group | All | Choice | Sequence | undefined;
    readonly attributes: Map<string, XSDAttribute | AttributeGroup> | undefined;
    readonly anyAttribute: AnyAttribute | undefined;

    constructor(schema: XSDSchema, root: XSDNode) {
        const node = root.getChild(0);
        if (!node) {
            throw new Error("lack child");
        }

        if (node.name == "group") {
            this.elements = schema.getGroup(undefined, node);
        } else if (node.name == "all") {
            this.elements = new All(schema, undefined, node);
        } else if (node.name == "choice") {
            this.elements = new Choice(schema, undefined, node);
        } else if (node.name == "sequence") {
            this.elements = new Sequence(schema, undefined, node);
        }

        this.attributes = AttributeGroup.buildAttributes(schema, root);
        this.anyAttribute = AnyAttribute.buildAnyAttribute(root);
    }
    getElements(unions: UnionMatcher[]) {
        if (this.elements) {
            this.elements.getElements(unions);
        }
    }
    findElement(name: string, prefix: string): MatchElement | undefined {
        if (this.elements) {
            return this.elements.findElement(name, prefix);
        }
    }
    getAttributeNames(names: string[]) {
        if (!this.attributes) {
            return;
        }
        for (const item of this.attributes) {
            const attr = item[1];
            if (attr instanceof XSDAttribute) {
                names.push(item[0]);
            } else if (attr instanceof AttributeGroup) {
                attr.getAttributeNames(names);
            }
        }
    }
    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.attributes) {
            const attr = AttributeGroup.lookupAttribute(this.attributes, name, prefix);
            if (attr) {
                return attr;
            }
        }
        if (this.anyAttribute) {
            return this.anyAttribute;
        }
        return undefined;
    }
    getRestriction(): Restriction | undefined {
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"type": "baseContent"`);
        if (this.elements) {
            array.push(`"elements": ${this.elements.toString()}`);
        }
        if (this.attributes) {
            const attrs: string[] = [];
            this.attributes.forEach((value) => {
                attrs.push(value.toString());
            });
            if (attrs.length > 0) {
                array.push(`"attributes": [${attrs.join(",")}]`);
            }
        }
        if (this.anyAttribute) {
            array.push(`"anyAttribute": ${this.anyAttribute.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

export class ComplexContent implements Content {
    readonly restriction: ComplexContentRestriction | undefined;
    readonly extension: ComplexExtension | undefined;
    readonly mixed: boolean;
    constructor(schema: XSDSchema, node: XSDNode) {
        const child = node.getChild(0);
        this.mixed = "true" == node.getAttribute("mixed");
        if (child.name == "restriction") {
            this.restriction = new ComplexContentRestriction(schema, child);
        } else if (child.name == "extension") {
            this.extension = new ComplexExtension(schema, child);
        }
    }
    getAttributeNames(names: string[]) {
        if (this.restriction) {
            this.restriction.getAttributeNames(names);
        } else if (this.extension) {
            this.extension.getAttributeNames(names);

        }
    }
    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.extension) {
            return this.extension.findAttribute(name, prefix);
        }
        return undefined;
    }
    getElements(unions: UnionMatcher[]) {
        if (this.restriction) {
            this.restriction.getElements(unions);
        } else if (this.extension) {
            this.extension.getElements(unions);
        }
    }
    findElement(name: string, prefix: string): MatchElement | undefined {
        if (this.extension) {
            return this.extension.findElement(name, prefix);
        } else if (this.restriction) {
            return this.restriction.findElement(name, prefix);
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"type": "complexContent"`);
        if (this.mixed) {
            array.push(`"mixed": true`);
        }
        if (this.restriction) {
            array.push(`"restriction": ${this.restriction.toString()}`);
        } else if (this.extension) {
            array.push(`"extension": ${this.extension.toString()}`);
        }
        return `{${array.join(', ')}}`;
    }
}

export class AnyAttribute extends MatchAttribute {
    private type: SimpleType;
    readonly namespace: string | undefined;
    readonly processContents: string | undefined;
    private constructor(node: XSDNode) {
        super("any", node.prefix);
        this.type = new SimpleType("string", BaseType.STRING);
        this.namespace = node.getAttribute("namespace");
        this.processContents = node.getAttribute("processContents");
    }
    getType(): SimpleType {
        return this.type;
    }
    validateValue(_value: string): string | undefined {
        return undefined;
    }
    static buildAnyAttribute(node: XSDNode): AnyAttribute | undefined {
        for (let i = 0; i < node.childrenCount(); i++) {
            const eleNode = node.getChild(i);
            if (eleNode.name == "anyAttribute") {
                return new AnyAttribute(eleNode);
            }
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        array.push(`"prefix": "${this.prefix}"`);
        if (this.namespace) {
            array.push(`"namespace": "${this.namespace}"`);
        }
        if (this.processContents) {
            array.push(`"processContents": "${this.processContents}"`);
        }
        return `{${array.join(",")}}`;
    }
}

export class XSDAttribute extends MatchAttribute {
    private type: SimpleType;
    readonly defaultValue: string | undefined;
    readonly fixed: string | undefined;
    readonly used: boolean = false;
    readonly readonly: boolean = false;
    constructor(schema: XSDSchema, node: XSDNode) {
        super(node.getAttribute("name"), node.prefix);
        this.used = node.getAttribute("use") === "required";
        this.fixed = node.getAttribute("fixed");
        this.readonly = node.getAttribute("readonly") == "true";
        this.defaultValue = node.getAttribute("default");
        if (!this.fixed && this.defaultValue) {
            // throw new Error("attribute[" + this.name +  "] can not have [fixed] and [default]!");
        }
        const type = node.getAttribute("type");
        let simpleType: SimpleType;
        if (type) {
            simpleType = schema.findSimpleType(type) as SimpleType;
        } else if (node.childrenCount() > 0) {
            const child = node.getChildByName("simpleType");
            if (!child) {
                throw new Error("attribute[" + this.name + "] has not child for type!");
            }
            simpleType = schema.getSimpleType(child);
        } else if (this.defaultValue) {
            const base = inferType(this.defaultValue);
            simpleType = new SimpleType(getBaseTypeName(base), base);
        } else {
            const base = BaseType.STRING;
            simpleType = new SimpleType(getBaseTypeName(base), base);
        }
        this.type = simpleType;
    }
    getType(): SimpleType {
        return this.type;
    }
    validateValue(value: string | undefined): string | undefined {
        if (this.used && !value) {
            return `attribute[${this.name}] can not be empty!`;
        }
        return value ? this.type.validateValue(value) : undefined;
    }
    toString(): string {
        const array: string[] = [];
        if(this.prefix) {
            array.push(`"prefix": "${this.prefix}"`);
        }
        array.push(`"name": "${this.name}"`);
        if (this.used) {
            array.push(`"used": true`);
        }
        if (this.fixed) {
            array.push(`"fixed": "${this.fixed}"`);
        }
        if (this.defaultValue) {
            array.push(`"default": "${this.defaultValue}"`);
        }
        array.push(`"type": ${this.type.toString()}`);
        return `{${array.join(",")}}`;
    }
}

class AttributeGroup {
    readonly name: string;
    readonly attributes: Map<string, XSDAttribute | AttributeGroup> = new Map();
    readonly anyAttribute: AnyAttribute | undefined;
    toString(): string {
        let str = "{'name':'" + this.name + "'";
        if (this.attributes && this.attributes.size > 0) {
            str += ",'attributes':[";
            let first = true;
            for (const attr of this.attributes) {
                if (!first) {
                    str += ",";
                }
                str += attr[1].toString();
                first = false;
            }
            str += "]";
        }
        if (this.anyAttribute) {
            str += ", 'anyAttribute' :" + this.anyAttribute.toString();
        }
        str += "}";
        return str;
    }
    constructor(schema: XSDSchema, node: XSDNode) {
        const name = node.getAttribute("name");
        this.name = name ? name : "attrGrp" + uuid();
        schema.attributeGroups.set(this.name, this);
        this.attributes = AttributeGroup.buildAttributes(schema, node);
        this.anyAttribute = AnyAttribute.buildAnyAttribute(node);
    }

    getAttributeNames(names: string[]) {
        if (!this.attributes) {
            return;
        }
        for (const item of this.attributes) {
            const attr = item[1];
            if (attr instanceof XSDAttribute) {
                names.push(item[0]);
            } else if (attr instanceof AttributeGroup) {
                attr.getAttributeNames(names);
            }
        }
    }

    public static buildAttributes(schema: XSDSchema, node: XSDNode): Map<string, XSDAttribute | AttributeGroup> {
        const attributes: Map<string, XSDAttribute | AttributeGroup> = new Map();
        for (let i = 0; i < node.childrenCount(); i++) {
            const eleNode = node.getChild(i);
            if (eleNode.name == "attribute") {
                const attr = schema.getAttribute(eleNode);
                attributes.set(attr.name, attr);
            } else if (eleNode.name == "attributeGroup") {
                const group = schema.getAttributeGroup(eleNode);
                attributes.set("group@" + group.name, group);
            }
        }
        return attributes;
    }

    findAttribute(name: string, prefix: string): MatchAttribute | undefined {
        if (this.attributes) {
            const attr = AttributeGroup.lookupAttribute(this.attributes, name, prefix);
            if (attr) {
                return attr;
            }
        }
        if (this.anyAttribute) {
            return this.anyAttribute;
        }
    }

    static lookupAttribute(attributes: Map<string, XSDAttribute | AttributeGroup>, name: string, prefix: string): MatchAttribute | undefined {
        if (attributes.size > 0) {
            for (const item of attributes) {
                const attrName = item[0];
                const attribute = item[1];
                if (attribute instanceof XSDAttribute) {
                    if (name == attrName && attribute.prefix == prefix) {
                        return attribute;
                    }
                    continue;
                }
                const attr = (attribute as AttributeGroup).findAttribute(name, prefix);
                if (attr) {
                    return attr;
                }
            }
        }
        return undefined;
    }
}

class All extends OccursTime {
    readonly owner: Group | undefined;
    readonly elements: XSDElement[] = [];
    private names: Set<string> = new Set();

    constructor(schema: XSDSchema, owner: Group | undefined, node: XSDNode) {
        super("all", node);
        this.owner = owner;
        log("build all...");
        if (this.maxOccurs != 1) {
            throw new Error("maxOccurs in [All] element must be 1!");
        }
        if (this.minOccurs != 0 && this.minOccurs != 1) {
            throw new Error("minOccurs in [All] element must be 0 or 1!");
        }
        for (let i = 0; i < node.childrenCount(); i++) {
            const child = node.getChild(i);
            if (child.name == "element") {
                const ele = schema.getElement(this, child);
                if (this.names.has(ele.name)) {
                    throw new Error("duplication name:" + ele.name);
                }
                log("   add:" + child.getAttribute("name"));
                this.elements.push(ele);
                this.names.add(ele.name);
            }
        }
    }

    getElements(unions: UnionMatcher[], maxOccurs?: number, minOccurs?: number) {
        const members = [];
        for (const item of this.elements) {
            members.push(new ElementMatcher(item.name, item.maxOccurs, item.minOccurs));
        }
        unions.push(new AllMatcher(members, maxOccurs || this.maxOccurs, minOccurs || this.minOccurs));
    }

    findElement(name: string, prefix: string): MatchElement | undefined {
        for (const element of this.elements) {
            if (element.name == name && element.prefix == prefix) {
                return element;
            }
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        this.buildStr(array);
        const elements: string[] = [];
        for (const item of this.elements) {
            elements.push(item.toString());
        }
        array.push(`"elements": [${elements.join(",")}]`)
        return `{${array.join(', ')}}`;
    }
}

class Choice extends OccursTime {
    readonly owner: Group | Choice | Sequence | undefined;
    readonly elements: (XSDElement | Group | Choice | Sequence | AnyElement)[] = [];
    constructor(schema: XSDSchema, owner: Group | Choice | Sequence | undefined, node: XSDNode) {
        super("choice", node);
        this.owner = owner;
        log("build choice...");
        for (let i = 0; i < node.childrenCount(); i++) {
            const child = node.getChild(i);
            if (child.name == "element") {
                log("   add:" + child.getAttribute("name"));
                const ele = schema.getElement(this, child);
                this.elements.push(ele);
            } else if (child.name == "group") {
                const group = schema.getGroup(this, child);
                this.elements.push(group);
            } else if (child.name == "choice") {
                const ch = new Choice(schema, this, child);
                this.elements.push(ch);
            } else if (child.name == "sequence") {
                const seq = new Sequence(schema, this, child);
                this.elements.push(seq);
            } else if (child.name == "any") {
                const any = new AnyElement(this, child);
                this.elements.push(any);
            }
        }
    }

    getElements(unions: UnionMatcher[], maxOccurs?: number, minOccurs?: number) {
        const members = [];
        for (const item of this.elements) {
            if (item instanceof XSDElement) {
                members.push(new ElementMatcher(item.name, item.maxOccurs, item.minOccurs));
            } else if (item instanceof Sequence) {
                item.getElements(members);
            } else if (item instanceof Choice) {
                item.getElements(members);
            } else if (item instanceof Group) {
                item.getElements(members);
            }
        }
        unions.push(new ChoiceMatcher(members, maxOccurs || this.maxOccurs, minOccurs || this.minOccurs));
    }

    findElement(name: string, prefix: string): MatchElement | undefined {
        for (const element of this.elements) {
            if (element instanceof XSDElement) {
                if (element.name == name && element.prefix == prefix) {
                    return element;
                }
                continue;
            }
            if (element instanceof AnyElement) {
                return element;
            }
            const ele = element.findElement(name, prefix);
            if (ele) {
                return ele;
            }
        }
        return undefined;
    }

    toString(): string {
        const array: string[] = [];
        this.buildStr(array);
        const elements: string[] = [];
        for (const item of this.elements) {
            elements.push(item.toString());
        }
        array.push(`"elements": [${elements.join(",")}]`)
        return `{${array.join(', ')}}`;
    }
}

class Sequence extends OccursTime {
    readonly owner: Group | Choice | Sequence | undefined;
    readonly elements: (XSDElement | Group | Choice | Sequence | AnyElement)[] = [];
    constructor(schema: XSDSchema, owner: Group | Choice | Sequence | undefined, node: XSDNode) {
        super("sequence", node);
        this.owner = owner;
        log("build sequence...");
        for (let i = 0; i < node.childrenCount(); i++) {
            const child = node.getChild(i);
            if (child.name == "element") {
                log("   add:" + child.getAttribute("name"));
                const ele = schema.getElement(this, child);
                this.elements.push(ele);
            } else if (child.name == "group") {
                const group = schema.getGroup(this, child);
                this.elements.push(group);
            } else if (child.name == "choice") {
                const ch = new Choice(schema, this, child);
                this.elements.push(ch);
            } else if (child.name == "sequence") {
                const seq = new Sequence(schema, this, child);
                this.elements.push(seq);
            } else if (child.name == "any") {
                const any = new AnyElement(this, child);
                this.elements.push(any);
            }
        }
    }

    getElements(unions: UnionMatcher[], maxOccurs?: number, minOccurs?: number) {
        const members = [];
        for (const item of this.elements) {
            if (item instanceof XSDElement) {
                members.push(new ElementMatcher(item.name, item.maxOccurs, item.minOccurs));
            } else if (item instanceof Sequence) {
                item.getElements(members);
            } else if (item instanceof Choice) {
                item.getElements(members);
            } else if (item instanceof Group) {
                item.getElements(members);
            }
        }
        unions.push(new SequenceMatcher(members, maxOccurs || this.maxOccurs, minOccurs || this.minOccurs));
    }

    findElement(name: string, prefix: string): MatchElement | undefined {
        for (const element of this.elements) {
            if (element instanceof XSDElement) {
                if (element.name == name && element.prefix == prefix) {
                    return element;
                }
                continue;
            }
            if (element instanceof AnyElement) {
                return element;
            }
            const ele = element.findElement(name, prefix);
            if (ele) {
                return ele;
            }
        }
        return undefined;
    }

    toString(): string {
        const array: string[] = [];
        this.buildStr(array);
        const elements: string[] = [];
        for (const item of this.elements) {
            elements.push(item.toString());
        }
        array.push(`"elements": [${elements.join(",")}]`)
        return `{${array.join(', ')}}`;
    }
}

class Group extends OccursTime {
    readonly owner: Choice | Sequence | undefined;
    readonly name: string;
    readonly element: All | Choice | Sequence;
    constructor(schema: XSDSchema, owner: Choice | Sequence | undefined, node: XSDNode) {
        super("group", node);
        this.owner = owner;
        const name = node.getAttribute("name");
        log("build group [" + name + "]...");
        this.name = name ? name : "grp" + uuid();
        const child = node.getChild(0);
        if (child.name == "all") {
            this.element = new All(schema, this, child);
        } else if (child.name == "choice") {
            this.element = new Choice(schema, this, child);
        } else if (child.name == "sequence") {
            this.element = new Sequence(schema, this, child);
        } else {
            throw new Error("not find match child!");
        }
    }
    clone(schema: XSDSchema, owner: Choice | Sequence, node: XSDNode): Group {
        return new Group(schema, owner, node);
    }

    getElements(unions: UnionMatcher[]) {
        const item = this.element;
        if (item instanceof Sequence) {
            item.getElements(unions, this.maxOccurs, this.minOccurs);
        } else if (item instanceof Choice) {
            item.getElements(unions, this.maxOccurs, this.minOccurs);
        } else if (item instanceof All) {
            item.getElements(unions, this.maxOccurs, this.minOccurs);
        }
    }

    findElement(name: string, prefix: string): MatchElement | undefined {
        return this.element.findElement(name, prefix);
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        this.buildStr(array);
        array.push(`"element": ${this.element.toString()}]`)
        return `{${array.join(', ')}}`;
    }
}

export abstract class AbstractMatchElement extends OccursTime implements MatchElement {
    readonly owner?: All | Choice | Sequence;
    readonly prefix: string;
    readonly name: string;
    constructor(name: string, node: XSDNode, owner?: All | Choice | Sequence) {
        super("element", node);
        if (!name) {
            console.error(node.toStr());
            throw new Error("name of element can not be empty!");
        }
        this.prefix = node.prefix;
        this.owner = owner;
        this.name = name;
    }

    match(xpath: string, name: string) {
        const xsd = this.findElement(name);
        if (!xsd) {
            throw new Error("未发现节点【" + xpath + "】的子节点【" + name + "】");
        }
        return xsd;
    }

    matchAttribute(xpath: string, attrName: string, attrValue: string | undefined){
        const matchAttr = this.findAttribute(attrName);
        if (!matchAttr) {
            return "未发现节点【xpath:" + xpath + ", name:" + this.name + "】的属性【" + attrName + "】";
        }
        if (matchAttr instanceof XSDAttribute) {
            if (matchAttr.fixed) {
                return "节点【xpath:" + xpath + ", name:" + this.name + "】的属性【" + attrName + "】不可修改";
            }
        }
        const error = matchAttr.validateValue(attrValue);
        if (error) {
            return "节点【xpath:" + xpath + ", name:" + this.name + "】的属性【" + attrName + "】值校验错误:" + error;
        }
    }

    matchText(xpath: string, text: string) {
        const xsd = this;
        if (xsd instanceof XSDElement) {
            const error = xsd.validateValue(text);
            if (error) {
                return "节点【" + xpath + "/" + xsd.name + "】值校验错误:" + error;
            }
        }
    }

    protected printName(elements: UnionMatcher[]): string {
        let names = '';
        elements.forEach(ele => {
            if (names.length > 0) {
                names += ', ';
            }
            if (ele instanceof ElementMatcher) {
                names += ele.name
            } else if (ele instanceof IndicatorMatcher) {
                names += `[${this.printName(ele.members)}]`;
            }
        })
        return names;
    }

    siblingList(last?: string): UnionMatcher[] {
        if (!this.owner) {
            return [];
        }
        const elements: UnionMatcher[] = [];

        log("name:" + this.name);
        log("owner:" + this.owner.typeName);
        this.owner.getElements(elements);
        const array = siblingList(elements, this.name, last);
        if (array) {
            //console.log("siblingList:" + this.printName(array));
            return array;
        }
        throw new Error("fatal error: not find elemnt '" + this.name + "' in parent!");
    }

    beforeList(sibling?: string): UnionMatcher[] {
        if (!this.owner) {
            return [];
        }
        const elements: UnionMatcher[] = [];
        this.owner.getElements(elements);
        const array = beforeList(elements, this.name, sibling);
        if (array) {
            //console.log('beforeList:' + this.printName(array));
            return array;
        }
        throw new Error("fatal error: not find elemnt '" + this.name + "' in parent!");
    }

    afterList(sibling?: string): UnionMatcher[] {
        if (!this.owner) {
            return [];
        }
        const elements: UnionMatcher[] = [];
        this.owner.getElements(elements);
        const array = afterList(elements, this.name, sibling);
        if (array) {
            //console.log('afterList:' + this.printName(array));
            return array;
        }
        throw new Error("fatal error: not find elemnt '" + this.name + "' in parent!");
    }

    abstract findElement(name: string, prefix?: string): MatchElement | undefined;
    abstract getChild(index?: number): ElementMatcher | undefined;
    abstract childList(lastChild?: string): UnionMatcher[];
    abstract attributeNames(): string[];
    abstract findAttribute(key: string, prefix?: string): MatchAttribute | undefined;
}
export class AnyElement extends AbstractMatchElement {
    constructor(owner: Choice | Sequence, node: XSDNode) {
        super("any", node, owner);
    }
    findElement(_name: string, _prefix?: string): undefined {
        return undefined;
    }

    getChild(_index?: number) {
        return undefined;
    }

    childList(_lastChild?: string): UnionMatcher[] {
        return [];
    }

    attributeNames(): string[] {
        return [];
    }

    findAttribute(_key: string, _prefix?: string): MatchAttribute | undefined {
        return;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        array.push(`"prefix": "${this.prefix}"`);
        this.buildStr(array);
        return `{${array.join(', ')}}`;
    }
}

export class XSDElement extends AbstractMatchElement {
    readonly type: XSDType;
    readonly defaultValue: string | undefined;
    readonly render: string | undefined;
    readonly fixed: boolean;
    constructor(schema: XSDSchema, owner: All | Choice | Sequence | undefined, node: XSDNode) {
        super(node.getAttribute("name") || '', node, owner);
        this.fixed = node.getAttribute("fixed") ? true : false;
        this.defaultValue = node.getAttribute("default");
        this.render = node.getAttribute("render");
        const typeName = node.getAttribute("type");
        if (typeName) {
            this.type = schema.findType(typeName);
            return;
        } else if (node.childrenCount() > 0) {
            const count = node.childrenCount();
            for (let i = 0; i < count; i++) {
                const child = node.getChild(i);
                if (child.name == "simpleType") {
                    this.type = schema.getSimpleType(child);
                    return;
                } else if (child.name == "complexType") {
                    this.type = schema.getComplexType(child);
                    return;
                }
            }
        }
        throw new Error("element[" + this.name + "] not define type!");
    }
    clone(schema: XSDSchema, owner: All | Choice | Sequence): XSDElement {
        return new XSDElement(schema, owner, this.node);
    }
    validateValue(text: string): string | undefined {
        const type = this.type;
        if (type instanceof ExtSimpleType) {
            return type.validateValue(text);
        } else if (type instanceof ListType) {
            return type.validateValue(text);
        } else if (type instanceof UnionType) {
            return type.validateValue(text);
        } else if (type instanceof SimpleType) {
            return type.validateValue(text);
        } else if (type instanceof ComplexType) {
            const content = type.content;
            if (content instanceof SimpleContent) {
                const simpleContent = content as SimpleContent;
                if (simpleContent.restriction) {
                    return simpleContent.restriction.validateValue(text);
                }
                return;
            } else {
                throw new Error("the content of element[" + this.name + "] is complex type, not support validate!");
            }
            //ContentType.COMPLEX ContentType.BASE can not validate text
        }
        throw new Error("the content of element[" + this.name + "]`s type not support validate!");
    }
    findElement(name: string, prefix?: string): MatchElement | undefined {
        if (this.type instanceof ComplexType) {
            if (!prefix) {
                prefix = this.prefix;
            }
            return this.type.findElement(name, prefix);
        }
        return undefined;
    }

    getChild(index?: number) {
        if (!index) {
            index = 0;
        }
        const unions = this.childList();
        for (const union of unions) {
            if (union instanceof ElementMatcher) {
                return union;
            } else if (union instanceof IndicatorMatcher) {
                return union.elementList()[index];
            }
        }
        throw new Error('not find index: ' + index);
    }

    childList(lastChild?: string): UnionMatcher[] {
        const elements: UnionMatcher[] = [];
        if (this.type instanceof ComplexType) {
            const content = this.type.content;
            if (content instanceof BaseContent) {
                content.getElements(elements);
            } else if (content instanceof ComplexContent) {
                content.getElements(elements);
            }
        }
        return lastChild ? afterList(elements, lastChild) : elements;
    }

    attributeNames(): string[] {
        const attributeNames: string[] = [];
        if (this.type instanceof ComplexType) {
            const content = this.type.content;
            content.getAttributeNames(attributeNames);
        }
        return attributeNames;
    }

    findAttribute(name: string, prefix?: string): MatchAttribute | undefined {
        if (this.type instanceof ComplexType) {
            if (!prefix) {
                prefix = this.prefix;
            }
            return (this.type as ComplexType).findAttribute(name, prefix);
        }
        return undefined;
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        array.push(`"prefix": "${this.prefix}"`);
        this.buildStr(array);
        array.push(`"type": "${this.type.toString()}"`);
        return `{${array.join(', ')}}`;
    }
}

class Notation {
    readonly name: string;
    readonly pub: string | undefined;
    readonly sys: string | undefined;
    constructor(node: XSDNode) {
        const name = node.getAttribute("name");
        if (!name) {
            console.error(node.toStr());
            throw new Error("notation` name can not be empty!");
        }
        this.name = name;
        const pub = node.getAttribute("public");
        if (pub) {
            this.pub = pub;
        }
        const sys = node.getAttribute("system");
        if (sys) {
            this.sys = sys;
        }
    }
    toString(): string {
        const array: string[] = [];
        array.push(`"name": "${this.name}"`);
        if (this.pub) {
            array.push(`"public": "${this.pub}"`);
        }
        if (this.sys) {
            array.push(`"system": "${this.sys}"`);
        }
        return `{${array.join(', ')}}`;
    }
}

export class XSDSchema {
    private readonly xsd: XSDRoot;
    readonly namespace: string;
    readonly groups: Map<string, Group> = new Map();
    readonly attributeGroups: Map<string, AttributeGroup> = new Map();
    readonly types: Map<string, XSDType> = new Map();
    private _elements: Map<string, XSDElement> = new Map();
    private _attributes: Map<string, XSDAttribute> = new Map();
    private _notations: Map<string, Notation> = new Map();
    private _initial: boolean;

    toString(): string {
        const array: string[] = [];
        const items: string[] = [];
        for (const item of this._elements) {
            items.push(item.toString());
        }
        array.push(`"elements": [${items.join(",")}]`);
        items.length = 0;
        for (const item of this._attributes) {
            items.push(item[1].toString());
        }
        array.push(`"attributes": [${items.join(",")}]`);
        items.length = 0;
        for (const item of this._notations) {
            items.push(item.toString());
        }
        array.push(`"notations": [${items.join(",")}]`);
        items.length = 0;
        for (const item of this.groups) {
            items.push(item.toString());
        }
        array.push(`"groups": [${items.join(",")}]`);
        items.length = 0;
        for (const item of this.attributeGroups) {
            items.push(item.toString());
        }
        array.push(`"attributeGroups": [${items.join(",")}]`);
        items.length = 0;
        for (const item of this.types) {
            items.push(item.toString());
        }
        array.push(`"types": [${items.join(",")}]`);
        return `{${array.join(",")}}`;
    }

    get initial() {
        return this._initial;
    }

    constructor(root: XSDRoot) {
        this._initial = false;
        this.xsd = root;
        this.namespace = root.prefix;
        const count = root.childrenCount();
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const node = root.getChild(i);
                const name = node.name;
                if (name == "import") {
                    throw new Error('not support import');
                } else if (name == "include") {
                    throw new Error('not support include element:' + node.toStr());
                } else if (name == "redefine") {
                    throw new Error('not support redefine');
                } else if (name == "element") {
                    console.log(`element name: ${node.getAttribute("name")}`);
                    const ele = new XSDElement(this, undefined, node);
                    this._elements.set(ele.name, ele);
                } else if (name == "group") {
                    const group = new Group(this, undefined, node);
                    this.groups.set(group.name, group);
                } else if (name == "simpleType") {
                    const stype = this.buildSimpleExtend(node);
                    this.types.set(stype.name, stype);
                } else if (name == "complexType") {
                    new ComplexType(this, node);
                } else if (name == "attribute") {
                    this.parseAttribute(node, true);
                } else if (name == "attributeGroup") {
                    new AttributeGroup(this, node);
                } else if (name == "notation") {
                    const notation = new Notation(node);
                    this._notations.set(notation.name, notation);
                } else {
                    log("skip node:" + name);
                }
            }
        }
        this._initial = true;
    }

    private parseAttribute(node: XSDNode, inRoot: boolean): XSDAttribute {
        const attr = new XSDAttribute(this, node);
        if (inRoot) {
            this._attributes.set(attr.name, attr);
        }
        return attr;
    }

    getComplexType(node: XSDNode): ComplexType {
        const ref = node.getAttribute("ref");
        return ref ? this.findComplexType(ref) : new ComplexType(this, node);
    }

    getSimpleType(node: XSDNode): SimpleType {
        const ref = node.getAttribute("ref");
        return ref ? this.findSimpleType(ref) : this.buildSimpleExtend(node);
    }

    private genName(node: XSDNode): string {
        const name = node.getAttribute("name");
        return name ? name : "stype" + uuid();
    }

    buildSimpleExtend(node: XSDNode): SimpleType {
        const name = this.genName(node);
        const count = node.childrenCount();
        if (count <= 0) {
            throw new Error("lack child element!");
        }
        for (let i = 0; i < count; i++) {
            const child = node.getChild(i);
            if (child.name == "restriction") {
                return ExtSimpleType.build(name, this, child);
            } else if (child.name == "list") {
                return ListType.build(name, this, child);
            } else if (child.name == "union") {
                return UnionType.build(name, this, child);
            }
        }
        //log(node.toString());
        throw new Error("element[" + node.name + "] not find expecting child element[restriction, list, union]!");
    }

    getElement(owner: All | Choice | Sequence, node: XSDNode): XSDElement {
        const ref = node.getAttribute("ref");
        return ref ? this.findElement(owner, ref) : new XSDElement(this, owner, node);
    }

    getGroup(owner: Choice | Sequence | undefined, node: XSDNode): Group {
        const ref = node.getAttribute("ref");
        return ref ? this.findGroup(owner, ref) : new Group(this, owner, node);
    }

    getAttribute(node: XSDNode): XSDAttribute {
        const ref = node.getAttribute("ref");
        return ref ? this.findAttribute(ref) : this.parseAttribute(node, false);
    }

    getAttributeGroup(node: XSDNode): AttributeGroup {
        const ref = node.getAttribute("ref");
        return ref ? this.findAttributeGroup(ref) : new AttributeGroup(this, node);
    }

    findType(name: string): XSDType {
        log("findType - " + name);
        if (name.startsWith(this.namespace + ":")) {
            name = name.substring(this.namespace.length + 1);
            if (isBaseType(name)) {
                const base = parseBaseType(name);
                return new SimpleType(name, base);
            }
        }
        let tp: XSDType | undefined;
        if (this.types) {
            tp = this.types.get(name);
            if (tp) {
                return tp;
            }
        }
        let node: XSDNode;
        let type: XSDType;
        try {
            node = this.findNode("simpleType", name);
            type = this.buildSimpleExtend(node);
        } catch (err) {
            //console.warn("err:" + err);
            //console.warn("not find simpleType:" + name);
            node = this.findNode("complexType", name);
            type = new ComplexType(this, node);
        }
        return type;
    }

    findSimpleType(name: string): SimpleType {
        log("findSimpleType - " + name);
        if (name.startsWith(this.namespace + ":")) {
            name = name.substring(this.namespace.length + 1);
            if (isBaseType(name)) {
                return new SimpleType(name);
            }
        }
        if (this.types && this.types.has(name)) {
            const t = this.types.get(name);
            if (!(t instanceof SimpleType)) {
                throw new Error(name + " is not a simple type, it is " + t?.name);
            }
        }
        const node: XSDNode = this.findNode("simpleType", name);
        const type = this.buildSimpleExtend(node);
        return type;
    }

    private findComplexType(name: string): ComplexType {
        if (this.types && this.types.has(name)) {
            const t = this.types.get(name);
            if (!(t instanceof ComplexType)) {
                throw new Error(name + " is not a complex type!");
            }
            return t as ComplexType;
        }
        const node: XSDNode = this.findNode("complexType", name);
        return new ComplexType(this, node);
    }

    private findElement(owner: All | Choice | Sequence, name: string): XSDElement {
        let ele = this._elements.get(name);
        if (!ele) {
            const node: XSDNode = this.findNode("element", name);
            ele = new XSDElement(this, undefined, node);
            this._elements.set(ele.name, ele);
        }
        return ele.clone(this, owner);
    }

    private findAttribute(name: string): XSDAttribute {
        if (this._attributes.has(name)) {
            return this._attributes.get(name) as XSDAttribute;
        }
        const node: XSDNode = this.findNode("attribute", name);
        return this.parseAttribute(node, true);
    }

    private findGroup(owner: Choice | Sequence | undefined, name: string): Group {
        let group = this.groups.get(name);
        if (!group) {
            const node: XSDNode = this.findNode("group", name);
            group = new Group(this, undefined, node);
            this.groups.set(name, group);
        }
        return owner ? group.clone(this, owner, group.node) : group;
    }

    private findAttributeGroup(name: string): AttributeGroup {
        if (this.attributeGroups.has(name)) {
            return this.attributeGroups.get(name) as AttributeGroup;
        }
        const node: XSDNode = this.findNode("attributeGroup", name);
        return new AttributeGroup(this, node);
    }

    private findNode(nodeType: string, name: string): XSDNode {
        //log("findNode:" + nodeType);
        if (this.xsd) {
            const count: number = this.xsd.childrenCount();
            log("childrenCount:" + count);
            for (let i = 0; i < count; i++) {
                const node = this.xsd.getChild(i);
                /*if(nodeType == "simpleType" || nodeType == "complexType"){
                    log(nodeType + "[" + name + "] => " + node?.name + "[" + node?.getAttribute("name") + "]");
                }*/
                //console.log('node.prefix: ' + node.prefix + ', node.name: ' + node.name + ', name: ' + node.getAttribute("name"));
                if (node && node.name == nodeType && node.getAttribute("name") == name) {
                    log("find node: " + nodeType + "[name='" + name + "']");
                    return node;
                }
            }
        }

        throw new Error("can not find node: " + nodeType + "[name='" + name + "']");
    }

    public lookup(xpath: string[]): MatchElement | null {
        if (!this._elements) {
            throw new Error("no any element");
        }
        let ele: MatchElement | undefined = this._elements.get(xpath[0]);
        if (!ele) {
            throw new Error("can not find [/" + xpath[0] + ']');
        }
        for (let i = 1; i < xpath.length; i++) {
            const eleName = xpath[i];
            ele = ele.findElement(eleName);
            if (!ele) {
                console.error("can not find [" + eleName + '] in [' + xpath.slice(0, i).join("/") + ']');
                return null
            } else {
                log('find:' + eleName);
            }
        }
        return ele;
    }
}

export async function buildXsdRoot(xsd: string, finder: FileFinder) {
    if(!xsd){
        throw new Error('xsd is empty!');
    }
    const xsdReader = new XSDReader();
    xsdReader.read(xsd);
    const xsdRoot = await xsdReader.analyse(finder);
    if (!xsdRoot) {
        throw new Error('xsd root is undefined!');
    }
    return xsdRoot;
}
