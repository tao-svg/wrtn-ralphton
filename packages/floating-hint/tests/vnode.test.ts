import { describe, it, expect } from 'vitest';
import {
  el,
  text,
  findByTestId,
  findAllByTestId,
  findByTag,
  type VNode,
} from '../src/renderer/vnode.js';

describe('el()', () => {
  it('creates a vnode with tag, attrs, and children', () => {
    const node = el('button', { className: 'btn', dataset: { testid: 'go' } }, [
      text('Go'),
    ]);
    expect(node.tag).toBe('button');
    expect(node.attrs?.className).toBe('btn');
    expect(node.attrs?.dataset?.testid).toBe('go');
    expect(node.children).toHaveLength(1);
    expect(node.children?.[0]).toEqual({ tag: '#text', text: 'Go' });
  });

  it('flattens nested falsy children (null/undefined/false)', () => {
    const node = el('div', null, [
      text('a'),
      null,
      undefined,
      false,
      text('b'),
    ]);
    expect(node.children).toHaveLength(2);
  });

  it('attaches event listeners via on:event', () => {
    const onClick = (): void => {};
    const node = el('button', { on: { click: onClick } }, []);
    expect(node.attrs?.on?.click).toBe(onClick);
  });
});

describe('findByTestId', () => {
  const tree: VNode = el('div', null, [
    el('span', { dataset: { testid: 'a' } }, [text('A')]),
    el('div', null, [
      el('button', { dataset: { testid: 'b' } }, [text('B')]),
    ]),
  ]);

  it('finds the first descendant with matching testid', () => {
    const found = findByTestId(tree, 'a');
    expect(found?.tag).toBe('span');
  });

  it('finds nested descendants', () => {
    const found = findByTestId(tree, 'b');
    expect(found?.tag).toBe('button');
  });

  it('returns null when missing', () => {
    expect(findByTestId(tree, 'nope')).toBeNull();
  });
});

describe('findAllByTestId', () => {
  it('finds all matching descendants', () => {
    const tree: VNode = el('div', null, [
      el('span', { dataset: { testid: 'item' } }, []),
      el('span', { dataset: { testid: 'item' } }, []),
      el('span', { dataset: { testid: 'other' } }, []),
    ]);
    const matches = findAllByTestId(tree, 'item');
    expect(matches).toHaveLength(2);
  });
});

describe('findByTag', () => {
  it('finds the first descendant with the given tag', () => {
    const tree: VNode = el('div', null, [
      el('p', null, [text('hi')]),
      el('button', null, [text('go')]),
    ]);
    expect(findByTag(tree, 'button')?.tag).toBe('button');
  });
});

describe('text()', () => {
  it('produces a #text vnode', () => {
    expect(text('hello')).toEqual({ tag: '#text', text: 'hello' });
  });
});
