# Vue Simulation

A simple Vue simulation library that provides Vue-like component-based development experience.

## Project Introduction

Vue Simulation is a lightweight front-end framework that simulates Vue's core functionalities, including data binding, event handling, template rendering, etc. This library is developed using TypeScript and provides good type support.

## Project Structure

```
├── src/             # Source code directory
│   ├── component/   # Component-related code
│   ├── dom/         # DOM operation-related code
│   ├── parser/      # Parser-related code
│   ├── utils/       # Utility functions
│   └── xsd/         # XSD-related code
├── test/            # Test directory
├── example/         # Example directory
├── tsconfig.json    # TypeScript configuration file
└── webpack.config.cjs # Webpack configuration file
```

### Core Modules

- **component/**: Contains core components like App, Block, Dialog, etc.
- **dom/**: Provides DOM reading, manipulation, and style handling functionality
- **parser/**: Responsible for expression parsing, template parsing, and virtual DOM processing
- **utils/**: Provides various utility functions

## Quick Start

### Install Dependencies

```bash
npm install
```

### Development Mode

Start the webpack development server:

```bash
npm run dev
```

The server will start at http://localhost:3002 with hot reloading support.

### Build Project

```bash
npm run build
```

Built files will be output to the `dist/` directory.

## Basic Usage

### Create Application

#### Method 1

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

#### Method 2

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

#### Method 3

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

### Directive Support

#### Template Directives
Supports Vue-like directives such as:

- `v-html` - Render HTML content
- `v-if` - Conditional rendering
- `v-if-else` - Multi-conditional rendering
- `v-else` - Conditional branch rendering
- `v-for` - List rendering
- `:[attribute name]` - Dynamic attributes, e.g., :src, :href, etc.
- `:class` - Dynamic class names
- `:style` - Dynamic styles
- `@[event name]` - Event handling, e.g., @click, @input, etc.

#### Dynamic Class Names

```javascript
:class="{'active': isActive}"

:class="[{active: isActive}, 'text-red']"
```

#### Dynamic Styles

```javascript
:style="{'color': 'red', 'fontSize': getFontSize}"
```

## Core API

### App Class

#### createApp(config)

Creates a new application instance.

**Parameters**: 
- `config` - Application configuration object, containing properties like createComponents, template, data, methods, and setup
  - **createComponents** - Optional, specifies an array of webComponent component names to create, e.g., ['card', 'card-item'], the created component names will be: vs-card, vs-card-item
  - **template** - Optional, specifies the application's template string
  - **data** - Optional, specifies the application's initial data object
  - **methods** - Optional, specifies the application's methods object
  - **setup** - Optional, specifies the application's setup function for initializing application state and logic, cannot be used with data, methods simultaneously

**Returns**: App instance

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

Creates a reactive reference type.

**Parameters**: 
- `value` - Initial value, can be any type

**Returns**: A reactive object containing a `value` property

```javascript
const count = vs.ref(0);
console.log(count.value); // 0
count.value++;
console.log(count.value); // 1
```

#### reactive(object)

Creates a reactive object.

**Parameters**: 
- `object` - Plain object to make reactive

**Returns**: A reactive proxy of the original object

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

Gets a specified variable from application data.

**Parameters**: 
- `key` - Variable name

**Returns**: Variable value

```javascript
const msg = this.getVariable('message');
console.log(msg); // Hello Vue Simulation!
```

#### setVariable(key, value, render?)

Sets a specified variable in application data.

**Parameters**: 
- `key` - Variable name
- `value` - Variable value
- `render` - Whether to render the view immediately after setting

```javascript
this.setVariable('message', 'Hello Vue Simulation!'); // Do not render immediately
this.setVariable('message', 'Hello Vue Simulation!', true); // Render immediately
```

#### setData(kv)

Batch sets application data and renders the view.

**Parameters**: 
- `kv` - Key-value pair object

```javascript
app.setData({
  message: 'Hello Vue Simulation!',
  count: 0
});
```

Sets both message and count variables simultaneously and renders the view immediately.

#### querySelector(selector)

Queries the first element matching the specified selector in the container.

**Parameters**: 
- `selector` - CSS selector

**Returns**: Matching DOM element or undefined

```javascript
this.querySelector('h1'); //Query h1 element
this.querySelector('.tabs'); //Query element with class 'tabs'
```

#### querySelectorAll(selector)

Queries all elements matching the specified selector in the container.

**Parameters**: 
- `selector` - CSS selector

**Returns**: Collection of matching DOM elements or undefined

```javascript
this.querySelectorAll('img'); //Query all img elements
this.querySelectorAll('.tab'); //Query all elements with class 'tab'
```

#### use(...urls)

Loads multiple template files from specified URLs.

**Parameters**: 
- `url` - Template file URL

**Returns**: Template content

```javascript
app.use('template1.html', 'template2.html').then((temp)=> {
  console.log(temp);
});
```

#### mount(root)

Mounts the application to the specified DOM element.

**Parameters**: 
- `root` - Mount point, can be a DOM element or selector string

```javascript
app.mount('#app'); //Mount the application to the element with id 'app'
//Or
const container = document.querySelector('#app');
app.mount(container); //Mount the application to the container element
```

#### render()

Renders or updates the application view.

#### onLoad Method
The initialization function has a fixed name: onLoad, which can be defined in appConfig's methods or setup

```javascript
methods: {
    onLoad(context) {
        console.log('Initialization');
    }
}
//Or
setup() {
    const onLoad = (context) => {
        console.log('Initialization');
    }
}
```

### Static Page Reference

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

### vs-block Component

The vs-block component is a custom component used to render specified templates.

**Attributes**: 
- `template` - Template name

**Example**: 

```html
<vs-card dom="entity" title="Entity">
    <vs-card-item label="Name" name="name"></vs-card-item>
</vs-card>
```

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
        /* Card item styles */
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

### Template Syntax

Template syntax is similar to Vue, supporting styles, scripts, events, etc.

**Template Syntax**: Basic structure is as follows

```html
<template id="[template name]">
    <style>
        /* Template styles */
    </style>
    <props>
        <prop name="[property name]" />
    </props>
    <template>
        /* Template content */
    </template>
    <script>
        /* Template script */
    </script>
</template>
```

**init Function**: Template initialization function, called after the template is loaded.

**Parameters**: 
- `ele` - Template root element
- `context` - Template context

```javascript
const init = (ele) => {
    // Initialize template
}
```

**Example**: echart template

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

## Example Description

The test directory contains multiple example files:

- **tab-panel.html**: Complete application example showing tabs, data binding, and event handling
- **air-panel.html**: Dashboard panel component example
- **echarts.html**: ECharts integration example
- **color.html**: Color picker example
- **count.html**: Counter example
- **template.html**: Template syntax example

### tab-panel.html

```html
<body style="margin: 0;width: 100vw;">
    <div id="app">
        <div class="tabs">
          <!-- Tabs -->
            <div :class="['tab', {'active': activeTab == 0}]" @click="switchTab(0)">Enums</div>
            <div :class="['tab', {'active': activeTab == 1}]" @click="switchTab(1)">Entities</div>
            <div :class="['tab', {'active': activeTab == 2}]" @click="switchTab(2)">DTOs</div>
            <div class="bar">&nbsp;</div>
        </div>
        <!-- Enums tab content -->
        <div class="tab-panel" v-if="activeTab === 0" @click="closeDialog">
            <vs-block template="card" v-for="item in enums" dom="enum" :title="item.description">
                <vs-block template="card-item" v-for="it in item.items" :label="it.description"
                    :name="it.name"></vs-block>
            </vs-block>
        </div>
        <!-- Entities tab content -->
        <div class="tab-panel" v-else-if="activeTab === 1" @click="closeDialog">
            <vs-block template="card" v-for="(item, index) in entities" dom="entity" :title="item.description">
                <vs-block template="card-item" v-for="it in item.fields" :label="it.description"
                    :name="it.name"></vs-block>
            </vs-block>
        </div>
        <!-- DTOs tab content -->
        <div class="tab-panel" v-else-if="activeTab === 2" @click="closeDialog">
            <vs-block template="card" v-for="(item, index) in dtos" dom="dto" :title="item.name">
                <vs-block template="card-item" v-for="it in item.relations" :label="it.name" :name="it.type"
                    @click="showDialog(it.join, $event)"></vs-block>
            </vs-block>
        </div>
        <!-- Dialog box, implemented via WebComponent -->
        <vs-card class="dialog" v-if="current != null" :style="pos" dom="entity" :title="current.description">
            <vs-card-item v-for="it in current.fields" :label="it.description" :name="it.name"></vs-card-item>
        </vs-card>
    </div>
```

```javascript
const app = vs.createApp({
            //Register vs-card and vs-card-item as WebComponent components
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
                // Switch tabs
                switchTab(index) {
                    this.setVariable('activeTab', index, true);
                },
                // Close dialog
                closeDialog() {
                    this.setData({
                        current: null,
                    });
                },
                // Show dialog
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
        // Load template
        app.use('./template.html').then(() => {
            app.mount('#app');
        });
```

![example](./example/air-panel.png)

Demo Address: [vue-simulation](http://124.221.39.74/)

## Development Notes

1. All source code is located in the `src/` directory
2. Development is done using TypeScript to ensure type safety
3. Test files are located in the `test/` directory and can be opened directly in the browser to view the effects

## License

ISC License