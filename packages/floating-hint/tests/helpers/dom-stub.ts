// Minimal DOM-like stub used by dom-mount tests. Avoids pulling in jsdom/happy-dom
// which are outside the PRD §12 catalog (BOUNDARIES.md §3).

export interface StubElement {
  tag: string;
  attributes: Record<string, string>;
  children: StubElement[];
  textContent: string;
  disabled: boolean;
  hidden: boolean;
  listeners: Map<string, Array<(event: unknown) => void>>;
  appendChild(child: StubElement): StubElement;
  removeChild(child: StubElement): void;
  replaceChildren(...nodes: StubElement[]): void;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(event: string, handler: (e: unknown) => void): void;
  click(): void;
  remove(): void;
}

export interface DomStub {
  createElement(tag: string): StubElement;
  createTextNode(text: string): StubElement;
}

export function createDomStub(): DomStub {
  function makeElement(tag: string): StubElement {
    const el: StubElement = {
      tag,
      attributes: {},
      children: [],
      textContent: '',
      disabled: false,
      hidden: false,
      listeners: new Map(),
      appendChild(child) {
        this.children.push(child);
        recomputeText(this);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        recomputeText(this);
      },
      replaceChildren(...nodes) {
        this.children = nodes.slice();
        recomputeText(this);
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      addEventListener(event, handler) {
        const arr = this.listeners.get(event) ?? [];
        arr.push(handler);
        this.listeners.set(event, arr);
      },
      click() {
        const arr = this.listeners.get('click') ?? [];
        for (const h of arr) h({ type: 'click' });
      },
      remove() {
        // Simulate detach (no parent tracking for simplicity).
      },
    };
    return el;
  }

  function recomputeText(el: StubElement): void {
    el.textContent = el.children.map((c) => c.textContent).join('');
  }

  function makeText(content: string): StubElement {
    const el = makeElement('#text');
    el.textContent = content;
    return el;
  }

  return {
    createElement: (tag) => makeElement(tag),
    createTextNode: (s) => makeText(s),
  };
}
