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