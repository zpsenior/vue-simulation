export enum BaseType {
    STRING = 1,
    BYTE,
    DECIMAL,
    DOUBLE,
    FLOAT,
    LONG,
    INTEGER,
    SHORT,
    NEGATIVE_INTEGER,
    NON_NEGATIVE_INTEGER,
    POSITIVE_INTEGER,
    NON_POSITIVE_INTEGER,
    UNSIGNED_LONG,
    UNSIGNED_INT,
    UNSIGNED_SHORT,
    UNSIGNED_BYTE,
    DATE,
    TIME,
    DATETIME,
    DURATION,
    DAY,
    MONTHDAY,
    MONTH,
    YEARMONTH,
    YEAR,
    ANY_URI,
    BOOLEAN,
    BASE64BINARY,
    HEXBINARY,
    NOTATION,
    NMTOKEN,
    ANY = 255
}

const baseTypes:Map<string, BaseType> = new Map([
['string', BaseType.STRING], 
['byte', BaseType.BYTE], 
['decimal', BaseType.DECIMAL], 
['double', BaseType.DOUBLE], 
['float', BaseType.FLOAT], 
['long', BaseType.LONG], 
['integer', BaseType.INTEGER], 
['int', BaseType.INTEGER], 
['short',BaseType.SHORT], 
['negativeInteger',BaseType.NEGATIVE_INTEGER], 
['nonNegativeInteger',BaseType.NON_NEGATIVE_INTEGER], 
['nonPositiveInteger',BaseType.NON_POSITIVE_INTEGER], 
['positiveInteger',BaseType.POSITIVE_INTEGER], 
['unsignedLong',BaseType.UNSIGNED_LONG], 
['unsignedInt',BaseType.UNSIGNED_INT], 
['unsignedShort',BaseType.UNSIGNED_SHORT], 
['unsignedByte',BaseType.UNSIGNED_BYTE], 
['date', BaseType.DATE], 
['time', BaseType.TIME], 
['dateTime',BaseType.DATETIME], 
['duration',BaseType.DURATION], 
['gDay', BaseType.DAY], 
['gMonthDay', BaseType.MONTHDAY], 
['gMonth', BaseType.MONTH], 
['gYearMonth', BaseType.YEARMONTH], 
['gYear',BaseType.YEAR], 
['anyURI', BaseType.ANY_URI], 
['boolean', BaseType.BOOLEAN], 
['base64Binary', BaseType.BASE64BINARY], 
['hexBinary', BaseType.HEXBINARY], 
['NOTATION', BaseType.NOTATION], 
['NMTOKEN', BaseType.NMTOKEN]
]);

export function isBaseType(name:string):boolean{
    return baseTypes.has(name);
}

const numberType = [
    BaseType.BYTE,
    BaseType.DECIMAL,
    BaseType.DOUBLE,
    BaseType.FLOAT,
    BaseType.LONG,
    BaseType.INTEGER,
    BaseType.SHORT,
    BaseType.NEGATIVE_INTEGER,
    BaseType.NON_NEGATIVE_INTEGER,
    BaseType.POSITIVE_INTEGER,
    BaseType.NON_POSITIVE_INTEGER,
    BaseType.UNSIGNED_LONG,
    BaseType.UNSIGNED_INT,
    BaseType.UNSIGNED_SHORT,
    BaseType.UNSIGNED_BYTE
]

function isNumber(base:BaseType) :boolean{
    return numberType.includes(base);
}

export function inferType(value:string):BaseType{
    value = value.toLowerCase();
    if(value == "true" || value == "false"){
        return BaseType.BOOLEAN;
    }else if(integerFormat.test(value)){
        return BaseType.INTEGER;
    }
    return BaseType.STRING;
}

export function parseBaseType(name:string):BaseType{
    //console.log("parseBaseType " + name);
    const base = baseTypes.get(name);
    if(base != undefined){
        return base;
    }
    throw new Error("not support base type:" + name);
}

export function getBaseTypeName(base:BaseType){
    for(const type of baseTypes){
        if(type[1] == base){
            return type[0];
        }
    }
    throw new Error("not support base type:" + base);
}

const dateTimeFormat = /^(?:19|20)[0-9][0-9]-(?:(?:0[1-9])|(?:1[0-2]))-(?:(?:[0-2][1-9])|(?:[1-3][0-1]))T(?:(?:[0-2][0-3])|(?:[0-1][0-9])):[0-5][0-9]:[0-5][0-9]$/;
const timeFormat = /^(20|21|22|23|[0-1]\d):[0-5]\d:[0-5]\d$/;
const dateFormat = /^(\d{4})-(\d{2})-(\d{2})$/;
const integerFormat = /^-?[0-9]\d*$/;
const positiveIntegerFormat = /^[0-9]*[1-9][0-9]*$/;
const nonPositiveIntegerFormat = /^-[0-9]\d*|0$/;
const negativeIntegerFormat = /^^-[1-9]+[0-9]*$/;
const nonNegativeIntegerFormat = /^[1-9]+[0-9]*$|^0$/;
const longFormat = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
const floatFormat = /^(-?\d+)(\.\d+)?$/;
const doubleFormat = /^(-?\d+)(\.\d+)?$/;
const decimalFormat = /^(-?\d+)(\.\d+)?$/;
const urlFormat = /^(https?:\/\/)([0-9a-z.]+)(:[0-9]+)?([/0-9a-z.]+)?(\?[0-9a-z&=]+)?(#[0-9-a-z]+)?/i;

export function validateValue(base:BaseType, value: string): string | undefined{
    let ret:boolean;
    switch(base){
        case BaseType.INTEGER:
            ret = integerFormat.test(value);
            break;
        case BaseType.LONG:
            ret = longFormat.test(value);
            break;
        case BaseType.FLOAT:
            ret = floatFormat.test(value);
            break;
        case BaseType.DOUBLE:
            ret = doubleFormat.test(value);
            break;
        case BaseType.DECIMAL:
            ret = decimalFormat.test(value);
            break;
        case BaseType.BOOLEAN:
            value = value.toLowerCase();
            ret = value == "true" || value == "false"
            break;
        case BaseType.DATE:
            ret = dateFormat.test(value);
            break;
        case BaseType.DATETIME:
            ret = dateTimeFormat.test(value);
            break;
        case BaseType.TIME:
            ret = timeFormat.test(value);
            break;
        case BaseType.ANY_URI:
            ret = value ? urlFormat.test(value) : true;
            break;
        case BaseType.POSITIVE_INTEGER:
            ret = positiveIntegerFormat.test(value);
            break;
        case BaseType.NON_POSITIVE_INTEGER:
            ret = nonPositiveIntegerFormat.test(value);
            break;
        case BaseType.NEGATIVE_INTEGER:
            ret = negativeIntegerFormat.test(value);
            break;
        case BaseType.NON_NEGATIVE_INTEGER:
            ret = nonNegativeIntegerFormat.test(value);
            break;
        case BaseType.STRING:
            ret = true;
            break;
        default:
            ret = false;
    }
    if(!ret){
        return "值不匹配类型！"
    }
}

export enum WhiteSpace{
    preserve = 1,
    replace,
    collapse
}

export class Limitation {
    maxExclusive:number | undefined;
    minExclusive:number | undefined;
    maxInclusive:number | undefined;
    minInclusive:number | undefined;
    maxLength:number | undefined;
    minLength:number | undefined;
    totalDigits:number | undefined;
    fractionDigits:number | undefined;
    whiteSpace:WhiteSpace | undefined;
    length:number | undefined;
    pattern:string | undefined;
    enumeration:(string|number)[] | undefined;
    private regExp : RegExp | undefined;
    readonly base:BaseType;
    constructor(base:BaseType){
        this.base = base;
    }
    toString() :string {
        const array: string[] = [];
        this.buildStr(array);
        return `{${array.join(', ')}}`;
    }
    buildStr(array: string[]) {
        if (this.maxExclusive) {
            array.push(`"maxExclusive": "${this.maxExclusive}"`);
        }
        if (this.minExclusive) {
            array.push(`"minExclusive": "${this.minExclusive}"`); 
        }
        if (this.maxInclusive) {
            array.push(`"maxInclusive": "${this.maxInclusive}"`);
        }
        if (this.minInclusive) {
            array.push(`"minInclusive": "${this.minInclusive}"`);
        }
        if (this.maxLength) {
            array.push(`"maxLength": "${this.maxLength}"`);
        }
        if (this.minLength) {
            array.push(`"minLength": "${this.minLength}"`);
        }
        if (this.length) {
            array.push(`"length": "${this.length}"`);
        }
        if (this.whiteSpace) {
            array.push(`"whiteSpace": "${this.whiteSpace}"`);
        }
        if (this.pattern) {
            //const base64 = encodeBase64(this.pattern);
            array.push(`"pattern": "${this.pattern}"`);
        }
        if (this.totalDigits) {
            array.push(`"totalDigits": "${this.totalDigits}"`);
        }
        if (this.fractionDigits) {
            array.push(`"fractionDigits": "${this.fractionDigits}"`);
        }
        if (this.enumeration) {
            array.push(`"enumeration": [${this.enumeration.join(', ')}]`);
        }
    }
    addEnum(value: string) {
        const enumValue = isNumber(this.base) ? parseFloat(value) : value;
        if(!this.enumeration){
            this.enumeration = [];
        }
        this.enumeration.push(enumValue);
    }
    pretreatment(value: string): string{
        if(this.whiteSpace){
            if(this.whiteSpace == WhiteSpace.replace){
                let str = value;
                while(str.indexOf(" ") >= 0){
                    str = str.replace(" ", '');
                }
                return str;
            }else if(this.whiteSpace == WhiteSpace.collapse){
                let str = value;
                while(str.indexOf("  ") >= 0){
                    str = str.replace("  ", ' ');
                }
                return str;
            }
        }
        return value;
    }
    validateValue(value: string): string | undefined{
        if (this.pattern) {
            if(!this.regExp){
                this.regExp = new RegExp(this.pattern);
            }
            if(!this.regExp.test(value)){
                return  "模式不匹配";
            }
        }
        if(isNumber(this.base)){
            if(!/^[+-]?\d*(\.\d*)?(e[+-]?\d+)?$/.test(value)){
                return '无效数值';
            }
            const num = parseFloat(value);
            if (this.maxExclusive && num >= this.maxExclusive) {
                return "必须小于" + this.maxExclusive;
            }
            if (this.minExclusive && num <= this.minExclusive) {
                return "必须大于" + this.minExclusive;
            }
            if (this.maxInclusive && num > this.maxInclusive) {
                return "必须小于等于" + this.maxInclusive;
            }
            if (this.minInclusive && num < this.minInclusive) {
                return "必须大于等于" + this.minInclusive;
            }
            if (this.totalDigits || this.fractionDigits){
                const pos = value.indexOf(".");
                const left = pos > 0 ? value.substring(0, pos).length : value.length;
                const right = pos > 0 ? value.substring(pos + 1).length : 0;
                if (this.totalDigits && (  left + right != this.totalDigits )) {
                    return "精确位数不等于" + this.totalDigits;
                }
                if (this.fractionDigits && right != this.fractionDigits) {
                    return "小数位数不等于" + this.fractionDigits;
                }
            }
            if (this.enumeration) {
                if (!this.enumeration.includes(value)) {
                    return "不在范围内";
                }
            }
        }else{
            const len = value.length;
            if (this.maxLength && len > this.maxLength) {
                return "长度超过最大值" + this.maxLength;
            }
            if (this.minLength && len < this.minLength) {
                return "长度小于最小值" + this.minLength;
            }
            if (this.length && len == this.length) {
                return "长度不等于" + this.length;
            }
            if (this.enumeration) {
                if (!this.enumeration.includes(value)) {
                    return "不在范围内";
                }
            }
        }
        return;
    }
}