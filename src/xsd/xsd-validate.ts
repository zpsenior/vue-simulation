export interface MatchResult {
    status: boolean,
    matchTimes: number,
    msg?: string,
    names?: string[]
}

export function printLog(deep: number, msg: string, obj?: any) {
    let str = '';
    for (let i = 0; i < deep; i++) {
        str += '   ';
    }
    if (obj) {
        console.log(str + msg, obj);
    } else {
        console.log(str + msg);
    }
}

export class ElementMatcher {
    readonly name: string;
    readonly max: number;
    readonly min: number;
    constructor(name: string, max: number, min: number) {
        this.name = name;
        this.max = max;
        this.min = min;
    }
    filter(names: string[]) {
        let current = 0;
        let flag = false;
        names.forEach((exclude) => {
            if (exclude == this.name) {
                current++;
            }
            if (current >= this.max) {
                flag = true;
            }
        });
        return flag;
    }

    match(names: string[], deep: number): MatchResult {
        const min = this.min;
        const max = this.max;
        let current = 0;
        let array: string[] = names;
        for (const name of array) {
            if (this.name == name) {
                printLog(deep, `element[${this.name}] match names[${current}]!`);
                current++;
                if (current == max) {
                    break;
                }
                continue;
            }
            break;
        }
        if (min == 0 && current == 0) {
            const msg = `element[${this.name}] match zero!`;
            printLog(deep, msg);
            return {
                status: true,
                matchTimes: 0,
                msg,
                names: array
            }
        }
        if (current < min) {
            const msg = `element[${this.name}] match times(${current}) is less than min(${this.min})!`;
            printLog(deep, msg);
            return {
                status: false,
                matchTimes: 0,
                msg
            }
        }
        const msg = `match ${current} times in element[${this.name}]`;
        printLog(deep, msg);
        return {
            status: true,
            matchTimes: current,
            msg,
            names: current > 0 ? array.slice(current) : array
        }
    }
}

export enum IndicatorType {
    All,
    Sequence,
    Choice
}

export abstract class IndicatorMatcher {
    readonly members: UnionMatcher[] = [];
    readonly type: IndicatorType;
    readonly max: number;
    readonly min: number;
    constructor(members: UnionMatcher[], type: IndicatorType, max: number, min: number) {
        this.members = members;
        this.type = type;
        this.max = max;
        this.min = min;
    }

    elementList() {
        const elements: ElementMatcher[] = [];
        for (const member of this.members) {
            if (member instanceof IndicatorMatcher) {
                elements.push(...member.elementList());
            } else if (member instanceof ElementMatcher) {
                elements.push(member);
            }
        }
        return elements;
    }

    protected exist(name: string) {
        for (const member of this.members) {
            if (member instanceof IndicatorMatcher) {
                if (member.exist(name)) {
                    return true;
                }
            } else if (member instanceof ElementMatcher) {
                if (member.name == name) {
                    return true;
                }
            }
        }
        return false;
    }
    abstract filter(...names: string[]): IndicatorMatcher | undefined;
    abstract before(name: string): IndicatorMatcher | undefined;
    abstract after(name: string): IndicatorMatcher | undefined;
    abstract match(names: string[], deep: number): MatchResult;
}

export type UnionMatcher = (IndicatorMatcher | ElementMatcher);

export class ChoiceMatcher extends IndicatorMatcher {

    constructor(members: UnionMatcher[], max: number, min: number){
        super(members, IndicatorType.Choice, max, min);
    }
    
    filter(...names: string[]){
        let current = 0;
        for(const name of names){
            if(this.exist(name)){
                current++;
            }
            if(current >= this.max){
                return undefined;
            }
        }
        return new ChoiceMatcher(this.members, this.max, this.min);
    }

    before(name: string){
        /*if(this.filter(name)){
            return undefined;
        }
        return new ChoiceInfo(this.members, this.max, this.min);*/
        return this.filter(name);
    }

    after(name: string){
        /*if(this.filter(name)){
            return undefined;
        }
        return new ChoiceInfo(this.members, this.max, this.min);*/
        return this.filter(name);
    }

    match(names:string[], deep: number){
        let array = names;
        let i = 0;
        printLog(deep, 'choice match start');
        while(i < this.max){
            const res = this.matchOne(array, deep + 1);
            if(!res.status){
                break;
            }
            i++;
            array = res.names as string[];
            printLog(deep, 'choice loop');
        }
        if(this.min == 0 && i == 0){
            const msg = `match zero in [choice]`;
            printLog(deep, msg);
            return { status: true, matchTimes: 0, msg, names: array }; 
        }
        if(i < this.min){
            const msg = `match times(${i}) is less than min(${this.min}) in [choice]`;
            printLog(deep, msg);
            return { status: false, matchTimes: i, msg };
        }
        const msg = `match ${i} times in [choice]`;
        printLog(deep, msg);
        return { status: true, matchTimes: i, msg, names: array };
    }

    private matchOne(names:string[], deep: number){
        let array = names;
        for(const member of this.members){
            const res = member.match(array, deep);
            if(res.status && res.matchTimes > 0){
                printLog(deep, 'match member', member);
                array = res.names as string[];
                return { status: true, names: array };
            }
        }
        const msg = `not match in [choice]`;
        printLog(deep, msg);
        return { status: false, msg };
    }
}

export class SequenceMatcher extends IndicatorMatcher {

    constructor(members: UnionMatcher[], max: number, min: number){
        super(members, IndicatorType.Sequence, max, min);
    }
    
    filter(...names: string[]){
        const children: UnionMatcher[] = [];
        for(const member of this.members){
            if(member instanceof IndicatorMatcher){
                const unit = member.filter(...names);
                if(unit){
                    children.push(unit);
                }
            }else if(member instanceof ElementMatcher){
                const flag = member.filter(names);
                if(!flag){
                    children.push(member);
                }
            }
        }
        if(children.length <= 0){
            return undefined;
        }
        return new SequenceMatcher(children, this.max, this.min);
    }
    

    before(name: string){
        const children: UnionMatcher[] = [];
        let flag = true;
        for(const member of this.members){
            if(member instanceof IndicatorMatcher){
                if(flag){
                    const unit = member.before(name);
                    if(unit){
                        children.push(unit);
                    }
                }
            }else if(member instanceof ElementMatcher){
                if(member.name == name){
                    if(member.max > 1){
                        children.push(member);
                    }
                    flag = false;
                    continue;
                }
                if(flag && member.name != name){
                    children.push(member);
                }
            }
        }
        if(children.length <= 0){
            return undefined;
        }
        return new SequenceMatcher(children, this.max, this.min);
    }

    after(name: string){
        const children: UnionMatcher[] = [];
        let flag = false;
        for(const member of this.members){
            if(member instanceof IndicatorMatcher){
                const unit = member.after(name);
                if(unit){
                    if(flag){
                        //error
                    }
                    flag = true;
                    children.push(unit);
                }
            }else if(member instanceof ElementMatcher){
                if(member.name == name){
                    if(member.max > 1){
                        children.push(member);
                    }
                    flag = true;
                    continue;
                }
                if(flag && member.name != name){
                    children.push(member);
                }
            }
        }
        if(children.length <= 0){
            return undefined;
        }
        return new SequenceMatcher(children, this.max, this.min);
    }

    match(names:string[], deep: number){
        let array = names;
        let i = 0;
        printLog(deep, 'seq match start');
        while(i < this.max){
            const res = this.matchOne(array, deep + 1);
            if(!res.status){
                break;
            }
            i++;
            array = res.names as string[];
            printLog(deep + 1, 'seq loop');
        }
        if(this.min == 0 && i == 0){
            const msg = `match zero in [sequeue]`;
            printLog(deep, msg);
            return { status: true, matchTimes: 0, msg, names: array }; 
        }
        if(i < this.min){
            const msg = `match times(${i}) is less than min(${this.min}) in [sequeue]`;
            printLog(deep, msg);
            return { status: false, matchTimes: i, msg };
        }
        const msg = `match ${i} times in [sequeue]`;
        printLog(deep, msg);
        return { status: true, matchTimes: i, msg, names: array };
    }

    private matchOne(names:string[], deep: number){
        let array = names;
        for(const member of this.members){
            const res = member.match(array, deep);
            if(!res.status){
                const msg = res.msg;
                printLog(deep, 'not match member', member);
                return { status: false, msg: msg };
            }
            printLog(deep, 'match member', member);
            array = res.names as string[];
        }
        return { status: true, msg: '', names: array };
    }
}

export class AllMatcher extends IndicatorMatcher {

    constructor(members: UnionMatcher[], max: number, min: number){
        super(members, IndicatorType.All, max, min);
    }

    private other(...names: string[]){
        const children: UnionMatcher[] = [];
        for(const member of this.members){
            if(member instanceof ElementMatcher){
                const flag = member.filter(names);
                if(!flag){
                    children.push(member);
                }
            }else{
                throw new Error('just support element node！');
            }
        }
        if(children.length <= 0){
            return undefined;
        }
        return new AllMatcher(children, this.max, this.min);
    }
    
    filter(...names: string[]){
        return this.other(...names);
    }

    before(name: string){
        return this.other(name);
    }

    after(name: string){
        return this.other(name);
    }

    match(names:string[], deep: number){
        const members = this.members as ElementMatcher[];
        const matchNames:string[] = [];
        printLog(deep, 'all match start');
        for(const name of names){
            const member = members.find( item => item.name == name);
            if(!member){
                break;
            }
            printLog(deep + 1, `member matched: ${name}`);
            matchNames.push(name);
        }
        const matchNamesLength = matchNames.length;
        if(this.min == 0 && matchNamesLength == 0){
            const msg = `match zero in [all]`;
            printLog(deep, msg);
            return { status: true, matchTimes: 0, msg, names }; 
        }
        const notMatchMembers: ElementMatcher[] = [];
        for(const member of members){
            if(!matchNames.includes(member.name)){
                if(member.min > 0){
                    printLog(deep + 1, `member not matched: ${member.name}`);
                    notMatchMembers.push(member);
                }
            }
        }
        if(notMatchMembers.length > 0){
            const array = notMatchMembers.map( item => item.name);
            const msg = `not match elements: ${array.join(', ')} in [all]`;
            printLog(deep, msg);
            return { status: false, matchTimes: matchNamesLength, msg };
        }
        const msg = `match ${matchNamesLength} elements in [all]`;
        printLog(deep, msg);
        return { status: true, matchTimes: matchNamesLength, msg, names: names.slice(matchNamesLength) };
    }
}

export function siblingList(members: UnionMatcher[], name: string, last?: string){
    const array: UnionMatcher[] = [];
    members.forEach((member) => {
        if(member instanceof IndicatorMatcher){
            const unit = member.filter(name);
            if(unit){
                array.push(unit);
            }
        }else if(member instanceof ElementMatcher){
            if(member.name != name){
                array.push(member);
            }
        }
    });
    return last ? afterList(array, last) : array;
}

export function afterList(members: UnionMatcher[], name: string, sibling?: string): UnionMatcher[]{
    const array: UnionMatcher[] = [];
    let flag = false;
    for(const member of members){
        if(member instanceof IndicatorMatcher){
            const unit = member.after(name);
            if(unit){
                if(flag){
                    // Error
                }
                flag = true;
                array.push(unit);
            }
        }else if(member instanceof ElementMatcher){
            if(member.name == name){
                if(member.max > 1){
                    array.push(member);
                }
                flag = true;
            }else if(flag){
                array.push(member);
            }
        }
    }
    return sibling ? beforeList(array, sibling) : array;
}

export function beforeList(members: UnionMatcher[], name: string, sibling?: string): UnionMatcher[]{
    const array: UnionMatcher[] = [];
    let flag = true;
    for(const member of members){
        if(member instanceof IndicatorMatcher){
            if(flag){
                const unit = member.before(name);
                if(unit){
                    array.push(unit);
                }
            }
        }else if(member instanceof ElementMatcher){
            if(member.name == name){
                if(member.max > 1){
                    array.push(member);
                }
                flag = false;
            }else if(flag){
                array.push(member);
            }
        }
    }
    return sibling ? afterList(array, sibling) : array;
}
export function filterElements(members: UnionMatcher[], exists: string[]){
    const array: UnionMatcher[] = [];
    for(const member of members){
        if(member instanceof IndicatorMatcher){
            const unit = member.filter(...exists);
            if(unit){
                array.push(unit);
            }
        }else if(member instanceof ElementMatcher){
            const flag = member.filter(exists);
            if(!flag){
                array.push(member);
            }
        }
    }
    return array;
}

export function listElements(unions: (IndicatorMatcher | ElementMatcher | undefined)[]){    const elements: ElementMatcher[] = [];
    unions.forEach( union => {
        if(!union){
            return;
        }
        if(union instanceof IndicatorMatcher){
           elements.push(...union.elementList());
        }else if(union instanceof ElementMatcher){
           elements.push(union);
        }
    });
    return elements;
}