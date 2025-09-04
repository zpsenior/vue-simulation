import { HTMLNode, MapRenderContext } from "./parser/template";
import { OnEvent } from "./parser/expression";
import { RenderContext } from "./parser/template";
import { HTMLBlockNode } from "./component/block";
import { HTMLPanel, TriggerEvent } from "./component/panel";
import { DialogOptions, HTMLDialog } from "./component/dialog";
import { createApp, registerWebComponents } from "./component/app";
import { loadTemplate } from "./utils/utils";

// 导出所有的类和函数，以便用户可以通过库访问它们
export {
    HTMLNode,
    MapRenderContext,
    OnEvent,
    RenderContext,
    HTMLBlockNode,
    HTMLPanel,
    TriggerEvent,
    DialogOptions,
    HTMLDialog,
    createApp,
    registerWebComponents,
    loadTemplate
};

// 导出默认值
export default {
    HTMLNode,
    MapRenderContext,
    OnEvent,
    RenderContext,
    HTMLBlockNode,
    HTMLPanel,
    TriggerEvent,
    DialogOptions,
    HTMLDialog,
    createApp,
    registerWebComponents,
    loadTemplate
};

// 为了在浏览器中直接使用
declare global {
    interface Window {
        VueSimulation: typeof exports;
    }
}

if (typeof window !== 'undefined') {
    window.VueSimulation = exports;
}