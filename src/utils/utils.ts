export function uuid(split = true): string {
    let val = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    if (!split) {
        val = val.replace(/-/g, '');
    }
    return val;
}
export function log(_msg: string) {
    //console.log(msg);
}
export function decodeHTML(str: string) {
    return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")replace(/&nbsp;/g, " ");
}
export async function loadTemplate(url: string) {
    const res = await window.fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'text/html;charset=utf-8'
        }
    });
    const content = await res.text();
    //console.log(content);
    return content;
}
export function decodeBase64(value: string): string {
    value = value.substring(7);
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    let i = 0;
    value = value.replace(/=+$/, '');

    while (i < value.length) {
        const group1 = base64Chars.indexOf(value[i++]);
        const group2 = base64Chars.indexOf(value[i++]);
        const group3 = base64Chars.indexOf(value[i++]);
        const group4 = base64Chars.indexOf(value[i++]);

        const bits = (group1 << 18) | (group2 << 12) | ((group3 & 0x3F) << 6) | (group4 & 0x3F);

        const byte1 = (bits >> 16) & 0xFF;
        output += String.fromCharCode(byte1);

        if (group3 !== -1) {
            const byte2 = (bits >> 8) & 0xFF;
            output += String.fromCharCode(byte2);
        }

        if (group4 !== -1) {
            const byte3 = bits & 0xFF;
            output += String.fromCharCode(byte3);
        }
    }

    return output;
}
export function encodeBase64(value: string): string {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    let i = 0;
    const length = value.length;

    while (i < length) {
        // 取三个字节
        const byte1 = value.charCodeAt(i++);
        const byte2 = i < length ? value.charCodeAt(i++) : NaN;
        const byte3 = i < length ? value.charCodeAt(i++) : NaN;

        // 转换为 24 位二进制数
        const bits = (byte1 << 16) | (isNaN(byte2) ? 0 : byte2 << 8) | (isNaN(byte3) ? 0 : byte3);

        // 分割为 4 个 6 位的部分
        const group1 = (bits >> 18) & 0x3F;
        const group2 = (bits >> 12) & 0x3F;
        const group3 = (bits >> 6) & 0x3F;
        const group4 = bits & 0x3F;

        // 转换为 Base64 字符
        output += base64Chars[group1];
        output += isNaN(byte2) ? '=' : base64Chars[group2];
        output += isNaN(byte3) ? '=' : base64Chars[group3];
        output += isNaN(byte3) ? '=' : base64Chars[group4];
    }
    return `base64:${output}`
}
export class StringPrinter {
    private array: string[] = [];
    private current = '';
    append(msg: string) {
        this.current += msg;
        return this;
    }
    print(deep: number, msg: string) {
        for (let i = 0; i < deep; i++) {
            this.current += '  ';
        }
        this.current += msg;
        return this;
    }
    println() {
        this.array.push(this.current);
        this.current = '';
        return this;
    }
    toString() {
        if (this.current.length > 0) {
            this.array.push(this.current);
            this.current = '';
        }
        return this.array.join('\n');
    }
    clear() {
        this.array = [];
    }
}
export function calcuateOffset(main: HTMLElement, root?: HTMLElement) {
    let top = 0, left = 0;
    let parent = main;
    while (parent) {
        top += parent.offsetTop;
        left += parent.offsetLeft;
        parent = parent.offsetParent as HTMLElement;
        if (root && parent == root) {
            break;
        }
    }
    return { top, left };
}
export function bindDrag(callbacks: {
    start?: (event: MouseEvent) => void;
    move: (dx: number, dy: number) => void;
    end?: (event: Event) => void;
}, ele?: HTMLElement) {
    let offsetLeft: number;
    let offsetTop: number;
    let lastTime = 0;
    function startDrag(event: MouseEvent) {
        offsetLeft = event.clientX;
        offsetTop = event.clientY;
        lastTime = Date.now();
        callbacks.start?.(event);
        document.body.addEventListener("mousemove", mouseDrag);
        document.body.addEventListener("mouseup", stopDrag);
        event.preventDefault();
    }
    function mouseDrag(event: MouseEvent) {
        const now = Date.now();
        if (now - lastTime < 100) {
            return;
        }
        event.preventDefault();
        lastTime = now;
        const dx = event.clientX - offsetLeft;
        const dy = event.clientY - offsetTop;
        callbacks.move(dx, dy);
        offsetLeft = event.clientX;
        offsetTop = event.clientY;
    }
    function stopDrag(event: MouseEvent) {
        event.preventDefault();
        callbacks.end?.(event);
        document.body.removeEventListener("mousemove", mouseDrag);
        document.body.removeEventListener("mouseup", stopDrag);
    }
    if (ele) {
        ele.addEventListener("mousedown", startDrag);
    }
    return {
        startDrag,
        mouseDrag,
        stopDrag
    }
}

/**
 * 横线字符串转驼峰字符串
 * @param str 横线格式的字符串
 * @returns 驼峰格式的字符串
 */
export function toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * 驼峰字符串转横线字符串
 * @param str 驼峰格式的字符串
 * @returns 横线格式的字符串
 */
export function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}