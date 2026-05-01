export type EventName =
  | 'click'
  | 'input'
  | 'change'
  | 'keydown'
  | 'keyup'
  | 'submit';

export interface VNodeAttrs {
  className?: string;
  id?: string;
  role?: string;
  ariaLabel?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
  disabled?: boolean;
  hidden?: boolean;
  tabIndex?: number;
  href?: string;
  type?: string;
  dataset?: Record<string, string>;
  style?: Partial<Record<string, string>>;
  on?: Partial<Record<EventName, (event: unknown) => void>>;
}

export interface ElementVNode {
  tag: string;
  attrs?: VNodeAttrs | null;
  children?: VNode[];
}

export interface TextVNode {
  tag: '#text';
  text: string;
}

export type VNode = ElementVNode | TextVNode;

export type VNodeChild = VNode | null | undefined | false;

export function text(value: string): TextVNode {
  return { tag: '#text', text: value };
}

export function el(
  tag: string,
  attrs: VNodeAttrs | null,
  children: VNodeChild[],
): ElementVNode {
  return {
    tag,
    attrs,
    children: children.filter((c): c is VNode => Boolean(c)),
  };
}

export function isText(node: VNode): node is TextVNode {
  return node.tag === '#text';
}

export function isElement(node: VNode): node is ElementVNode {
  return node.tag !== '#text';
}

function walk(node: VNode, visit: (n: VNode) => void): void {
  visit(node);
  if (isElement(node) && node.children) {
    for (const child of node.children) walk(child, visit);
  }
}

export function findByTestId(root: VNode, testid: string): ElementVNode | null {
  let found: ElementVNode | null = null;
  walk(root, (node) => {
    if (found) return;
    if (isElement(node) && node.attrs?.dataset?.testid === testid) {
      found = node;
    }
  });
  return found;
}

export function findAllByTestId(root: VNode, testid: string): ElementVNode[] {
  const results: ElementVNode[] = [];
  walk(root, (node) => {
    if (isElement(node) && node.attrs?.dataset?.testid === testid) {
      results.push(node);
    }
  });
  return results;
}

export function findByTag(root: VNode, tag: string): ElementVNode | null {
  let found: ElementVNode | null = null;
  walk(root, (node) => {
    if (found) return;
    if (isElement(node) && node.tag === tag) {
      found = node;
    }
  });
  return found;
}

export function textContent(node: VNode): string {
  if (isText(node)) return node.text;
  if (!node.children) return '';
  return node.children.map(textContent).join('');
}
