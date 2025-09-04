import { MapRenderContext, RenderContext } from "../parser/template";
import { bindDrag, calcuateOffset } from "../utils/utils";
import { HTMLBase } from "./base";

export type TriggerEvent = (params: any) => any;

export abstract class HTMLPanel extends HTMLBase {
    constructor() {
        super();
    }
    protected bindStyle(style: HTMLStyleElement) {
        style.innerHTML = `
            :host {
                position: absolute;
                box-shadow: 0px 0px 5px 5px rgba(77, 106, 154, 0.28);
                font-size: 14px;
                min-width: 100px;
                min-height: 20px;
                background-color: #fff;
                border-radius: 5px;
                z-index: 9999;
            }
            .title {
                color: #4489FF;
                text-align: center;
                font-size: 14px;
                font-weight: bold;
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px 0 24px;
            }
            .title__close {
                width: 12px;
                height: 12px;
                color: #666;
                cursor: pointer;
            }
            .iconfont {
                font-family: "editor-font" !important;
                font-size: 16px;
                font-style: normal;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            .icon-panel-close:before {
                content: "\e695";`;
    }
    protected buildContext(): RenderContext {
        const vars = new Map();
        this.bindVars(vars);
        const events = new Map();
        events.set("close", () => {
            this.remove();
        });
        events.set("confirm", () => {
        });
        events.set("switchTab", (idx: number) => {
            const tabs = this.findSelectorAll('.tab');
            if (tabs) {
                for (let i = 0; i < tabs.length; i++) {
                    const tab = tabs.item(i);
                    i == idx ? tab.classList.add('active') : tab.classList.remove('active');
                }
                this.switchTab(idx);
            }
        });
        const { startDrag } = bindDrag({
            start: () => {
                const pos = calcuateOffset(this);
                this.cx = pos.left;
                this.cy = pos.top;

            },
            move: this.move.bind(this)
        });
        events.set("boardmdown", startDrag);
        this.bindEvents(events);
        return new MapRenderContext(vars, events);
    }
    protected switchTab(_idx: number) { };
    private cx: number = 0;
    private cy: number = 0;
    private move(dx: number, dy: number) {
        this.cx += dx;
        this.cy += dy;
        const panel = this;
        if (panel) {
            console.log(`move ${dx}, ${dy}`);
            panel.style.left = this.cx + "px";
            panel.style.top = this.cy + "px";
        }
    }
    protected bindVars(_vars: Map<any, any>) { };
    protected bindEvents(_events: Map<string, TriggerEvent>) { };
    protected abstract buildTemplate(): string;
}