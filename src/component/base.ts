import { MapRenderContext } from "../parser/template";

// 定义应用接口
export interface App {
    cache: WeakMap<any, any>;
    getVariable(key: string): any;
    setVariable(key: string, value: any, render?: boolean): void;
    setData(data: any): void;
    querySelector(selector: string): HTMLElement | undefined;
    querySelectorAll(selector: string): NodeListOf<HTMLElement> | undefined;
    use(...urls: string[]): Promise<string>;
    mount(root: HTMLElement | string): void;
    render(): void;
    ref<T>(val: T): Ref<T>;
    reactive<T extends Object>(val: T): T;
}

// 定义引用接口
export interface Ref<T> {
    value: T;
    _isRef: boolean;
}

// 实现引用类
export class RefImpl<T> implements Ref<T> {
    private _value: T;
    private _app: App;
    public name: string = '';
    public _isRef: boolean = true;

    constructor(app: App, value: T) {
        this._app = app;
        this._value = value;
    }

    get value(): T {
        return this._value;
    }

    set value(val: T) {
        this._value = val;
        if (this.name && this._app) {
            this._app.setVariable(this.name, this);
        }
    }
}

// 深度代理对象，实现响应式
export function deepProxy(app: App, obj: any): any {
    // 如果是基本类型，直接返回
    if (!obj || typeof obj !== 'object' || obj instanceof HTMLElement || obj instanceof Node) {
        return obj;
    }

    // 如果是数组，处理数组的特殊方法
    if (Array.isArray(obj)) {
        const array = obj.map((item: any) => deepProxy(app, item));
        return new Proxy(array, {
            get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);
                
                // 处理数组的方法
                if (typeof value === 'function' && ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop.toString())) {
                    return function(...args: any[]) {
                        const result = value.apply(target, args);
                        // 对新添加的元素进行代理
                        if (['push', 'unshift', 'splice'].includes(prop.toString())) {
                            for (let i = 0; i < target.length; i++) {
                                if (!app.cache.has(target[i])) {
                                    target[i] = deepProxy(app, target[i]);
                                }
                            }
                        }
                        return result;
                    };
                }
                
                return value;
            },
            set(target, prop, value, receiver) {
                const oldValue = Reflect.get(target, prop, receiver);
                if (oldValue !== value) {
                    const result = Reflect.set(target, prop, deepProxy(app, value), receiver);
                    return result;
                }
                return true;
            },
            deleteProperty(target, prop) {
                const result = Reflect.deleteProperty(target, prop);
                return result;
            }
        });
    }

    // 如果是普通对象，创建代理
    const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            return deepProxy(app, value);
        },
        set(target, prop, value, receiver) {
            const oldValue = Reflect.get(target, prop, receiver);
            if (oldValue !== value) {
                const result = Reflect.set(target, prop, deepProxy(app, value), receiver);
                return result;
            }
            return true;
        },
        deleteProperty(target, prop) {
            const result = Reflect.deleteProperty(target, prop);
            return result;
        }
    });

    return proxy;
}

// 工具函数：检查是否是引用对象
export function isRef(val: any): boolean {
    return val && val._isRef === true;
}

// 工具函数：检查是否是响应式对象
export function isReactive(val: any): boolean {
    return val && typeof val === 'object' && val.__isReactive === true;
}

// 工具函数：获取原始对象
export function toRaw<T>(val: T): T {
    if (isRef(val)) {
        return val.value;
    }
    if (isReactive(val)) {
        return val.__raw || val;
    }
    return val;
}

// 工具函数：合并两个对象
export function merge(target: any, source: any): any {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (target[key] && typeof target[key] === 'object' && typeof source[key] === 'object') {
                target[key] = merge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
}

// 工具函数：防抖函数
export function debounce(fn: Function, delay: number): Function {
    let timer: number | null = null;
    return function(this: any, ...args: any[]) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}

// 工具函数：节流函数
export function throttle(fn: Function, delay: number): Function {
    let lastTime = 0;
    return function(this: any, ...args: any[]) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            fn.apply(this, args);
            lastTime = now;
        }
    };
}

// 工具函数：格式化日期
export function formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month.toString().padStart(2, '0'))
        .replace('DD', day.toString().padStart(2, '0'))
        .replace('HH', hour.toString().padStart(2, '0'))
        .replace('mm', minute.toString().padStart(2, '0'))
        .replace('ss', second.toString().padStart(2, '0'));
}

// 工具函数：深拷贝
export function deepClone<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
        return obj.map((item) => deepClone(item)) as unknown as T;
    }

    const clone: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = deepClone(obj[key]);
        }
    }

    return clone;
}

// 工具函数：获取URL参数
export function getUrlParams(): { [key: string]: string } {
    const params: { [key: string]: string } = {};
    const query = window.location.search.substr(1);
    const pairs = query.split('&');
    
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            params[key] = decodeURIComponent(value || '');
        }
    }
    
    return params;
}

// 工具函数：设置URL参数
export function setUrlParams(params: { [key: string]: string }): void {
    const searchParams = new URLSearchParams(window.location.search);
    
    for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, value);
    }
    
    const newUrl = window.location.pathname + '?' + searchParams.toString();
    window.history.replaceState({}, document.title, newUrl);
}

// 工具函数：检测是否在移动设备上
export function isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 工具函数：平滑滚动到元素
export function scrollToElement(element: HTMLElement | string, offset: number = 0): void {
    let targetElement: HTMLElement | null = null;
    
    if (typeof element === 'string') {
        targetElement = document.querySelector(element);
    } else {
        targetElement = element;
    }
    
    if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const top = rect.top + scrollTop - offset;
        
        window.scrollTo({
            top: top,
            behavior: 'smooth'
        });
    }
}

// 工具函数：生成唯一ID
export function generateId(prefix: string = ''): string {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 工具函数：检查是否为空
export function isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return true;
    }
    if (Array.isArray(value) && value.length === 0) {
        return true;
    }
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return true;
    }
    return false;
}

// 工具函数：防抖渲染
export function debounceRender(app: App, delay: number = 30): Function {
    return debounce(() => {
        app.render();
    }, delay);
}