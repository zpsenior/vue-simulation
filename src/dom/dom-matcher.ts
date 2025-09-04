import { DOM } from "./dom";
import { AttributeOpt, Selector, SelectorRelationship } from "./dom-style";

class SelectorMatcher {
    private readonly dom;
    private readonly tagName: string;
    private readonly classList: string[];
    constructor(dom: DOM) {
        this.dom = dom;
        const classAttr = dom.styleClass?.list();
        this.classList = classAttr ? classAttr : [];
        this.tagName = dom.name;
    }

    match(selector: Selector): boolean {
        const name = selector.name;
        if (name.startsWith('.')) {
            if (this.matchClassName(name.substring(1))) {
                if (this.matchAttribute(selector)) {
                    return true;
                }
            }
        } else if (name.startsWith('#')) {
            if (this.dom.hasAttribute('id')) {
                const value = this.dom.getAttribute('id');
                if (value == name.substring(1)) {
                    if (this.matchAttribute(selector)) {
                        return true;
                    }
                }
            }
        } else if (this.matchTagName(name)) {
            if (this.matchAttribute(selector)) {
                return true;
            }
        }
        return false;
    }

    private matchClassName(name: string) {
        const res = this.classList.find((val) => {
            if (val == name) {
                return val;
            }
        })
        return res ? true : false;
    }

    private matchTagName(name: string) {
        if (name == '*') {
            return true;
        }
        return this.tagName == name;
    }

    private matchAttribute(selector: Selector) {
        const attrs = selector.attributes;
        if (attrs) {
            for (const attr of attrs) {
                const attrName = attr[0];
                const attrValue = attr[1];
                if (!this.dom.hasAttribute(attrName)) {
                    return false;
                }
                if (!attrValue) {
                    continue;
                }
                const value = this.dom.getAttribute(attrName);
                if (!value) {
                    return false;
                }
                const val = attrValue.value;
                switch (attrValue.opt) {
                    case AttributeOpt.equal:
                        if (val != value) {
                            return false;
                        }
                        break;
                    case AttributeOpt.startsWith:
                        if (!value.startsWith(val)) {
                            return false;
                        }
                        break;
                    case AttributeOpt.endsWith:
                        if (!value.endsWith(val)) {
                            return false;
                        }
                        break;
                    case AttributeOpt.contains:
                        if (value.indexOf(val) == -1) {
                            return false;
                        }
                        break;
                }
            }
        }
        return true;
    }
}

export function matchSelector(selector: Selector, dom: DOM, pre: boolean = false): boolean {
    let matcher = new SelectorMatcher(dom);
    if (matcher.match(selector)) {
        if (!selector.preSelector) {
            return true;
        }
        const preSelector = selector.preSelector;
        const relationship = preSelector.relationship;
        if (relationship == SelectorRelationship.ancestor) {
            const parent = dom.parent;
            if (!parent) {
                return false;
            }
            return matchSelector(preSelector, parent, true);
        }
        if (relationship == SelectorRelationship.parent) {
            const parent = dom.parent;
            if (!parent) {
                return false;
            }
            return matchSelector(preSelector, parent);
        }
        if (relationship == SelectorRelationship.nextSibling) {
            const sibling = dom.prevSibling;
            if (!sibling) {
                return false;
            }
            return matchSelector(preSelector, sibling);
        }
        if (relationship == SelectorRelationship.sibling) {
            const siblings = dom.beforeSiblings;
            if (!siblings) {
                return false;
            }
            for (const sibling of siblings) {
                const res = matchSelector(preSelector, sibling);
                if (res) {
                    return true;
                }
            }
            return false;
        }
        throw new Error('not support relationship: ' + relationship + '!');
    }
    if (pre) {
        if(selector.relationship == SelectorRelationship.ancestor && dom.parent) {
            return matchSelector(selector, dom.parent, true);
        }
    }
    return false;
}