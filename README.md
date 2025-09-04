# Vue Simulation

一个简单的Vue模拟库，提供类似Vue的组件化开发体验。

## 项目简介

Vue Simulation 是一个轻量级的前端框架，模拟了Vue的核心功能，包括数据绑定、事件处理、模板渲染等。该库使用TypeScript开发，提供了良好的类型支持。

## 项目结构

```
├── src/             # 源码目录
│   ├── component/   # 组件相关代码
│   ├── dom/         # DOM操作相关代码
│   ├── parser/      # 解析器相关代码
│   ├── utils/       # 工具函数
│   └── xsd/         # XSD相关代码
├── test/            # 测试目录
├── example/         # 示例目录
├── tsconfig.json    # TypeScript配置文件
└── webpack.config.cjs # Webpack配置文件
```

### 核心模块

- **component/**: 包含App、Block、Dialog等核心组件
- **dom/**: 提供DOM读取、操作和样式处理功能
- **parser/**: 负责表达式解析、模板解析和虚拟DOM处理
- **utils/**: 提供各种工具函数

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

启动webpack开发服务器：

```bash
npm run dev
```

服务器将在 http://localhost:3002 启动，支持热更新。

### 构建项目

```bash
npm run build
```

构建后的文件将输出到 `dist/` 目录。

## 基本使用

### 创建应用

#### 方法一

```html
<div id="app">
  <h1>{{ message }}</h1>
  <p>Count: {{ count }}</p>
  <button @click="increment">Increment</button>
</div>
```

```javascript
const app = vs.createApp({
  data() {
    return {
      message: 'Hello Vue Simulation!',
      count: 0
    }
  },
  methods: {
    increment() {
      let count = this.getVariable('count');
      count++;
      this.setVariable('count', count, true);
    }
  }
});
app.mount('#app');
```

#### 方法二

```html
<div id="app">
  <template>
    <h1>{{ message }}</h1>
    <p>Count: {{ count }}</p>
    <button @click="increment">Increment</button>
  </template>
</div>
```