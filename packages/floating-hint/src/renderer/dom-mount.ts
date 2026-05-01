import { isText, type ElementVNode, type VNode, type VNodeAttrs } from './vnode.js';

// Minimal DOM contract — large enough to render our VNodes without depending
// on full lib.dom typings (so tests can pass a stub).
interface DomElementLike {
  appendChild(child: DomElementLike): DomElementLike;
  replaceChildren(...nodes: DomElementLike[]): void;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(event: string, handler: (e: unknown) => void): void;
  textContent: string;
  disabled?: boolean;
  hidden?: boolean;
}

export interface DomLike {
  createElement(tag: string): DomElementLike;
  createTextNode(text: string): DomElementLike;
}

const BOOLEAN_PROPS = new Set<keyof VNodeAttrs>(['disabled', 'hidden']);

function applyAttrs(target: DomElementLike, attrs: VNodeAttrs | null | undefined): void {
  if (!attrs) return;
  if (attrs.className !== undefined) target.setAttribute('class', attrs.className);
  if (attrs.id !== undefined) target.setAttribute('id', attrs.id);
  if (attrs.role !== undefined) target.setAttribute('role', attrs.role);
  if (attrs.ariaLabel !== undefined) target.setAttribute('aria-label', attrs.ariaLabel);
  if (attrs.ariaLive !== undefined) target.setAttribute('aria-live', attrs.ariaLive);
  if (attrs.tabIndex !== undefined) target.setAttribute('tabindex', String(attrs.tabIndex));
  if (attrs.href !== undefined) target.setAttribute('href', attrs.href);
  if (attrs.type !== undefined) target.setAttribute('type', attrs.type);
  const targetMap = target as unknown as Record<string, unknown>;
  for (const prop of BOOLEAN_PROPS) {
    const value = attrs[prop];
    if (value === true) {
      target.setAttribute(String(prop), '');
      targetMap[prop] = true;
    } else if (value === false) {
      target.removeAttribute(String(prop));
      targetMap[prop] = false;
    }
  }
  if (attrs.dataset) {
    for (const [k, v] of Object.entries(attrs.dataset)) {
      target.setAttribute(`data-${k}`, v);
    }
  }
  if (attrs.style) {
    const cssParts: string[] = [];
    for (const [k, v] of Object.entries(attrs.style)) {
      if (v !== undefined) cssParts.push(`${k}: ${String(v)}`);
    }
    if (cssParts.length > 0) target.setAttribute('style', cssParts.join('; '));
  }
  if (attrs.on) {
    for (const [event, handler] of Object.entries(attrs.on)) {
      if (handler) {
        target.addEventListener(event, handler as (e: unknown) => void);
      }
    }
  }
}

function createNode(node: VNode, dom: DomLike): DomElementLike {
  if (isText(node)) {
    return dom.createTextNode(node.text);
  }
  const element = dom.createElement(node.tag);
  applyAttrs(element, node.attrs);
  if (node.children) {
    for (const child of node.children) {
      element.appendChild(createNode(child, dom));
    }
  }
  return element;
}

export function mountVNode(
  node: ElementVNode,
  parent: DomElementLike,
  dom: DomLike,
): DomElementLike {
  const created = createNode(node, dom);
  parent.appendChild(created);
  return created;
}

export function applyVNode(
  node: ElementVNode | null,
  root: DomElementLike,
  dom: DomLike,
): void {
  if (node === null) {
    root.replaceChildren();
    return;
  }
  const created = createNode(node, dom);
  root.replaceChildren(created);
}
