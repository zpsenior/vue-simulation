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

#### 方法三

```javascript
const app = vs.createApp({
  template: `
    <div>
      <h1>{{ message }}</h1>
      <p>Count: {{ count }}</p>
      <button @click="increment">Increment</button>
    </div>
  `,
  setup(app) {
    const count = app.ref(0);
    const message = 'Hello Vue Simulation!';
    const increment = () => {
      count.value++;
    }
    return {
      message,
      count,
      increment
    }
  }
});
app.mount('#app');
```

### 指令支持

#### 模板指令
支持类似Vue的指令，如：

- `v-html` - 渲染HTML内容
- `v-if` - 条件渲染
- `v-if-else` - 多条件渲染
- `v-else` - 条件分支渲染
- `v-for` - 列表渲染
- `:[属性名]` - 动态属性，如：:src、:href等
- `:class` - 动态类名
- `:style` - 动态样式
- `@[事件名]` - 事件处理，如：@click、@input等

#### 动态类名

```javascript
:class="{'active': isActive}"

:class="[{active: isActive}, 'text-red']"
```

#### 动态样式

```javascript
:style="{'color': 'red', 'fontSize': getFontSize}"
```

## 核心API

### App类

#### createApp(config)

创建一个新的应用实例。

**参数**: 
- `config` - 应用配置对象，包含createComponents、template、data、methods和setup等属性
  - **createComponents** - 可选，指定需要创建的webComponent组件名称数组，如：['card', 'card-item']，创建后的组件名称为：vs-card、vs-card-item
  - **template** - 可选，指定应用的模板字符串
  - **data** - 可选，指定应用的初始数据对象
  - **methods** - 可选，指定应用的方法对象
  - **setup** - 可选，指定应用的setup函数，用于初始化应用状态和逻辑，不可与data、methods同时使用

**返回值**: App实例

```javascript
const app = vs.createApp({
  template: `
      ....
  `,
  setup() {
    const count = vs.ref(0);
    const message = 'Hello Vue Simulation!';
    const increment = () => {
      count.value++;
    }
    return {
      message,
      count,
      increment
    }
  }
});
```

#### ref(value)

创建一个响应式的引用类型。

**参数**: 
- `value` - 初始值，可以是任何类型

**返回值**: 一个包含`value`属性的响应式对象

```javascript
const count = vs.ref(0);
console.log(count.value); // 0
count.value++;
console.log(count.value); // 1
```

#### reactive(object)

创建一个响应式对象。

**参数**: 
- `object` - 要使其响应式的普通对象

**返回值**: 原始对象的响应式代理

```javascript
const state = vs.reactive({
  count: 0,
  message: 'Hello Vue Simulation!'
});
console.log(state.count); // 0
state.count++;
console.log(state.count); // 1
```

#### getVariable(key)

获取应用数据中的指定变量。

**参数**: 
- `key` - 变量名

**返回值**: 变量值

```javascript
const msg = this.getVariable('message');
console.log(msg); // Hello Vue Simulation!
```

#### setVariable(key, value, render?)

设置应用数据中的指定变量。

**参数**: 
- `key` - 变量名
- `value` - 变量值
- `render` - 是否在设置后立即渲染视图

```javascript
this.setVariable('message', 'Hello Vue Simulation!'); // 不立即渲染
this.setVariable('message', 'Hello Vue Simulation!', true); // 立即渲染
```

#### setData(kv)

批量设置应用数据并渲染视图。

**参数**: 
- `kv` - 键值对对象

```javascript
app.setData({
  message: 'Hello Vue Simulation!',
  count: 0
});
```

同时设置message和count变量，且立即渲染视图。

#### querySelector(selector)

在容器中查询匹配指定选择器的第一个元素。

**参数**: 
- `selector` - CSS选择器

**返回值**: 匹配的DOM元素或undefined

```javascript
this.querySelector('h1'); //查询h1元素
this.querySelector('.tabs'); //查询class包含tabs的元素
```

#### querySelectorAll(selector)

在容器中查询匹配指定选择器的所有元素。

**参数**: 
- `selector` - CSS选择器

**返回值**: 匹配的DOM元素集合或undefined

```javascript
this.querySelectorAll('img'); //查询所有img元素
this.querySelectorAll('.tab'); //查询class包含tab的所有元素
```

#### use(...urls)

加载指定URL的多个模板文件。

**参数**: 
- `url` - 模板文件URL

**返回值**: 模板内容

```javascript
app.use('template1.html', 'template2.html').then((temp)=> {
  console.log(temp);
});
```

#### mount(root)

将应用挂载到指定的DOM元素上。

**参数**: 
- `root` - 挂载点，可以是DOM元素或选择器字符串

```javascript
app.mount('#app'); //将应用挂载到id为app的元素上
//或者
const container = document.querySelector('#app');
app.mount(container); //将应用挂载到container元素上
```

#### render()

渲染或更新应用视图。

#### onLoad方法
初始化函数固定名称为: onLoad, 可以在appConfig的methods或setup中定义

```javascript
methods: {
    onLoad(context) {
        console.log('初始化');
    }
}
//或者
setup() {
    const onLoad = (context) => {
        console.log('初始化');
    }
}
```

### 静态页面引用

```html
<body>
    <div class="container">
        <vs-color-panel style="position:absolute;top:200px;left:300px"></vs-color-panel>
    </div>
    <script>
        vs.registerWebComponents(['color-panel'], async () => {
            const template = await vs.loadTemplate('./template.html');
            return template;
        });
    </script>
</body>
```

### vs-block组件

vs-block组件是一个自定义组件，用于渲染指定的模板。

**属性**: 
- `template` - 模板名称

**示例**: 

```html
<vs-card dom="entity" title="实体">
    <vs-card-item label="名称" name="name"></vs-card-item>
</vs-card>
```

```html
<template id="card">
    <template>
        <div class="card">
            <div :class="'head ' + dom">
                <span class="title">{{title}}</span>
            </div>
            <div class="items">
                <slot />
            </div>
        </div>
    </template>
    <style>
        ...
    </style>
</template>

<template id="card-item">
    <style>
        /* 卡片项样式 */
    </style>
    <template>
        <div class="item">
            <div class="label">{{label}}</div>
            <div class="name">{{name}}</div>
            <div class="dlg" style="display:none">
                <slot />
            </div>
        </div>
    </template>
</template>
```

### 模板语法

模板语法与Vue类似，支持样式、脚本、事件等。

**模板语法**: 基本结构如下

```html
<template id="[模板名称]">
    <style>
        /* 模板样式 */
    </style>
    <props>
        <prop name="[属性名称]" />
    </props>
    <template>
        /* 模板内容 */
    </template>
    <script>
        /* 模板脚本 */
    </script>
</template>
```

**init函数**: 模板初始化函数，在模板加载完成后调用。

**参数**: 
- `ele` - 模板根元素
- `context` - 模板上下文

```javascript
const init = (ele) => {
    // 初始化模板
}
```

**示例**: echart模板

```html
<template id="echart">
    <template>
        <div id="container"></div>
    </template>
    <script>
        const init = (ele) => {
            const container = ele.shadowRoot.querySelector('#container');
            const chart = echarts.init(container);
            const options = this.getVariable('options');
            chart.setOption(options);
        }
        return {
            init
        }
    </script>
    <style>
        #container {
            width: 100%;
            height: 400px;
        }
    </style>
</template>
```

## 示例说明

test目录下包含多个示例文件：

- **tab-panel.html**: 完整的应用示例，展示标签页、数据绑定和事件处理
- **air-panel.html**: 大屏面板组件示例
- **echarts.html**: echarts图表集成示例
- **color.html**: 颜色选择器示例
- **count.html**: 计数器示例
- **template.html**: 模板语法示例

### tab-panel.html

```html
<body style="margin: 0;width: 100vw;">
    <div id="app">
        <div class="tabs">
          <!-- 标签页 -->
            <div :class="['tab', {'active': activeTab == 0}]" @click="switchTab(0)">枚举</div>
            <div :class="['tab', {'active': activeTab == 1}]" @click="switchTab(1)">实体</div>
            <div :class="['tab', {'active': activeTab == 2}]" @click="switchTab(2)">DTO</div>
            <div class="bar">&nbsp;</div>
        </div>
        <!-- 标签页enums内容 -->
        <div class="tab-panel" v-if="activeTab === 0" @click="closeDialog">
            <vs-block template="card" v-for="item in enums" dom="enum" :title="item.description">
                <vs-block template="card-item" v-for="it in item.items" :label="it.description"
                    :name="it.name"></vs-block>
            </vs-block>
        </div>
        <!-- 标签页entities内容 -->
        <div class="tab-panel" v-else-if="activeTab === 1" @click="closeDialog">
            <vs-block template="card" v-for="(item, index) in entities" dom="entity" :title="item.description">
                <vs-block template="card-item" v-for="it in item.fields" :label="it.description"
                    :name="it.name"></vs-block>
            </vs-block>
        </div>
        <!-- 标签页dtos内容 -->
        <div class="tab-panel" v-else-if="activeTab === 2" @click="closeDialog">
            <vs-block template="card" v-for="(item, index) in dtos" dom="dto" :title="item.name">
                <vs-block template="card-item" v-for="it in item.relations" :label="it.name" :name="it.type"
                    @click="showDialog(it.join, $event)"></vs-block>
            </vs-block>
        </div>
        <!-- 弹出框，通过WebComponent组件来实现 -->
        <vs-card class="dialog" v-if="current != null" :style="pos" dom="entity" :title="current.description">
            <vs-card-item v-for="it in current.fields" :label="it.description" :name="it.name"></vs-card-item>
        </vs-card>
    </div>
```

```javascript
const app = vs.createApp({
            //注册vs-card和vs-card-item为WebComponent组件
            createComponents: ['card', 'card-item'],
            data() {
                return {
                    pos: {
                        top: '0',
                        left: '0',
                    },
                    current: null,
                    activeTab: 0,
                    enums: [...],
                    entities: [...],
                    dtos: [...],
                }
            },
            methods: {
                // 切换标签页
                switchTab(index) {
                    this.setVariable('activeTab', index, true);
                },
                // 关闭弹出框
                closeDialog() {
                    this.setData({
                        current: null,
                    });
                },
                // 显示弹出框
                showDialog(join, event) {
                    event.stopPropagation();
                    const top = event.clientY;
                    const left = event.clientX;
                    console.log(join);
                    const entities = this.getVariable('entities');
                    entities.find((entity) => {
                        if (entity.name === join) {
                            this.setData({
                                current: entity,
                                pos: {
                                    top: top + 'px',
                                    left: left + 'px',
                                }
                            });
                            return;
                        }
                    });
                }
            }
        });
        // 加载模板
        app.use('./template.html').then(() => {
            app.mount('#app');
        });
```

![example](./example/air-panel.png)

演示地址：[vue-simulation](http://124.221.39.74/)

## 开发说明

1. 所有源代码位于 `src/` 目录下
2. 使用TypeScript进行开发，确保类型安全
3. 测试文件位于 `test/` 目录下，可以直接在浏览器中打开查看效果

## 许可证

ISC许可证