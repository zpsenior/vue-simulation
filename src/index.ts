/**
 * Vue模拟库的主要导出文件
 */

// 导出DOM相关类和函数
// 导出模板相关类和类型
import { HTMLNode, MapRenderContext } from './parser/template';
// 导出事件类型
import type { OnEvent } from './parser/expression';
import type { RenderContext } from './parser/template';
// 导出组件相关类
import { HTMLBlockNode } from './component/block';
import { HTMLPanel, TriggerEvent } from './component/panel';
import { DialogOptions, HTMLDialog } from './component/dialog';
import { createApp, registerWebComponents } from './component/app';
import { loadTemplate } from './utils/utils';

// 重新导出这些类和函数，以便通过lib访问
export {
  loadTemplate,
  registerWebComponents,
  createApp,
  HTMLBlockNode, 
  HTMLNode,
  HTMLPanel,
  HTMLDialog,
  MapRenderContext,
};
export type { 
  RenderContext,
  OnEvent,
  DialogOptions,
  TriggerEvent
};