export const EVENT_HTML_NODE_CLICK = 'htmlClick';
export const EVENT_TREE_NODE_CLICK = 'treeNodeClick';
export const EVENT_TREE_NODE_RIGHT_CLICK = 'treeNodeRightClick';

export type JDOM = {
    name: string,
    id?: string,
    attributes?: any,
    text?: string,
    raw?: boolean,
    children?: JDOM[],
}

export type NodePos = {
    beforeId?: string,
    afterId?: string
};

export type FileFinder = (fileName: string) => Promise<string>;

export const leafHtmlTag = ['img', 'input', 'area', 'hr',
    'col', 'br', 'wbr', 'base', 'param', 'source', 'track', 'link', 'meta'];