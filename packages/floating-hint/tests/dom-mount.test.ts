import { describe, it, expect, vi } from 'vitest';
import { mountVNode, applyVNode } from '../src/renderer/dom-mount.js';
import { el, text } from '../src/renderer/vnode.js';
import { createDomStub } from './helpers/dom-stub.js';

describe('mountVNode', () => {
  it('creates an element with text content', () => {
    const dom = createDomStub();
    const root = dom.createElement('div');
    mountVNode(
      el('p', { className: 'hello', dataset: { testid: 't' } }, [text('Hi')]),
      root,
      dom,
    );
    expect(root.children).toHaveLength(1);
    const child = root.children[0]!;
    expect(child.tag).toBe('p');
    expect(child.attributes['class']).toBe('hello');
    expect(child.attributes['data-testid']).toBe('t');
    expect(child.textContent).toBe('Hi');
  });

  it('attaches click event handlers that fire on click()', () => {
    const dom = createDomStub();
    const root = dom.createElement('div');
    const handler = vi.fn();
    mountVNode(
      el('button', { on: { click: handler } }, [text('Go')]),
      root,
      dom,
    );
    root.children[0]!.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('toggles disabled and hidden boolean attributes', () => {
    const dom = createDomStub();
    const root = dom.createElement('div');
    mountVNode(
      el('button', { disabled: true, hidden: true }, [text('No')]),
      root,
      dom,
    );
    const btn = root.children[0]!;
    expect(btn.disabled).toBe(true);
    expect(btn.hidden).toBe(true);
  });

  it('renders nested children', () => {
    const dom = createDomStub();
    const root = dom.createElement('div');
    mountVNode(
      el('section', null, [
        el('p', null, [text('a')]),
        el('p', null, [text('b')]),
      ]),
      root,
      dom,
    );
    expect(root.children[0]!.children).toHaveLength(2);
  });
});

describe('applyVNode (re-render)', () => {
  it('replaces the rendered tree on subsequent calls', () => {
    const dom = createDomStub();
    const root = dom.createElement('div');
    applyVNode(el('p', null, [text('first')]), root, dom);
    expect(root.textContent).toBe('first');
    applyVNode(el('p', null, [text('second')]), root, dom);
    expect(root.textContent).toBe('second');
    expect(root.children).toHaveLength(1);
  });

  it('handles a null vnode by clearing the root', () => {
    const dom = createDomStub();
    const root = dom.createElement('div');
    applyVNode(el('p', null, [text('x')]), root, dom);
    applyVNode(null, root, dom);
    expect(root.children).toHaveLength(0);
  });
});
