// Renderer entry — vanilla DOM placeholder. SPEC-015 will replace this with the
// real UI (two buttons + AI response). PRD §12 catalog does not include React;
// no JSX is used here so the .tsx extension reduces to plain TypeScript.

const root = document.getElementById('app');
if (root) {
  root.textContent = 'Hint Window 준비됨';
}
