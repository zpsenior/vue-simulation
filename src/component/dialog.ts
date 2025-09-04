import { HTMLPanel } from "./panel";

export type DialogOptions = {
    container: HTMLElement,
    position: { x: number, y: number },
    params?: any,
}

export abstract class HTMLDialog extends HTMLPanel {
    constructor() {
        super();
        if (!this.getVariable('btnConfirm')) {
            this.setVariable('btnConfirm', '确定');
        }
    }
    protected bindStyle(style: HTMLStyleElement) {
        style.innerHTML = `
        :host {
            position: absolute;
            background-color: rgb(255, 255, 255);
            box-shadow: 0px 0px 5px 5px rgba(77, 106, 154, 0.28);
            font-size: 14px;
            width: 400px;
            display: none;
            z-index: 9999;
        }
        .iconfont {
            font-family: "editor-font" !important;
            font-size: 16px;
            font-style: normal;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        .panel {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            width: 100%;
            height: 100%;
        }
        .panel-header {
            border-bottom: 1px solid #aaaaaa;
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
        }
        .panel-header > .panel-title {
            margin: 10px;
            text-align: left;
            font-weight: bolder;
            height: 20px;
        }
        .panel-header > .panel-close {
            margin: 10px;
            background-color: red;
            width: 20px;
            height: 20px;
            font-size: 12px;
            font-weight: bolder;
            line-height: 20px;
            text-align: center;
            color: white;
            border-radius: 3px;
            cursor: pointer;
        }
        .panel-body {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            width: 100%;
        }
        .panel-body .tabs {
            width: 100%;
            height: 30px;
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            align-items: center;
        }
        .panel-body .tabs > .tab {
            min-width: 50px;
            margin-left: 10px;
        }
        .panel-body .tabs > .active {
            color:blue;
            font-weight: bolder;
            border-bottom: 1px solid blue;
        }
        .panel-body .tab-body {
            margin-top:10px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            overflow: auto;
            border-top: 1px solid lightgray;
            border-right: 1px solid lightgray;
            border-bottom: 1px solid gray;
            border-left: 1px solid gray;
            max-height: 400px;
        }
        .panel-footer {
            width: 80%;
            height: 30px;
            display: flex;
            flex-direction: row;
            justify-content:space-between;
            align-items: flex-start;
            padding-top: 10px;
            padding-bottom: 10px;
        }
        .panel-footer .panel-button {
            background-color: white;
            border: 1px solid gray;
            color: black;
            border-radius: 5px;
            width: 70px;
            height: 25px;
            text-align: center;
            padding-top: 5px;
            font-size: 14px;
            cursor: pointer;
        }
        .panel-footer .button-confirm {
            background-color: blue;
            border: 1px solid blue;
            color: white;
        }
        .panel-item {
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            align-items: flex-start;
            margin-bottom: 10px;
            width: 90%;
        }
        .panel-item .item-label {
            margin-right: 10px;
            width: 40%;
            text-align: right;
        }
        .panel-item .content {
            width: 100%;
            height: 300px;
        }
        .panel-item .item-text {
            width: 60%;
        }
        .panel-item .select-editable {
            position: relative;
        }
        .panel-item .select-editable > select {
            position: absolute;
            top: 0;
            left: 0;
            width: 105px;
            border: none;
            outline: none;
        }
        .panel-item .select-editable > input {
            position: absolute;
            top: 0;
            left: 0;
            width: 80px;
            outline: none;
            border-top: none;
            border-right: none;
            border-left: none;
            border-bottom: 1px solid gray;
        }
        .panel-item .item-input {
            width: 60%;
            border-top: none;
            border-right: none;
            border-left: none;
            border-bottom: 1px solid lightgray;
        }
        .panel-item textarea {
            height: 50px;
        }`;
    }
    protected buildTemplate() {
        return `<div class="panel">
                <div class="panel-header" v-on:mousedown="boardmdown">
                ${this.buildHeader()}
                </div>
                <div class="panel-body">
                ${this.buildBody()}
                </div>
                <div class="panel-footer">
                ${this.buildFooter()}
                </div>
            </div>`;
    }
    protected abstract buildBody(): string;

    protected buildHeader() {
        return `<div class="panel-title">{{title}}</div>
                <div class="panel-close" v-on:click="close">X</div>`;
    }

    protected buildFooter() {
        return `<div class="panel-button button-confirm" v-on:click="confirm">{{btnConfirm}}</div>
                <div class="panel-button" v-on:click="close">取消</div>`;
    }

    display(position: { x: number, y: number }) {
        this.style.left = position.x + 'px';
        this.style.top = position.y + 'px';
        this.style.display = 'block';
    }
}