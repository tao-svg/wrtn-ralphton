// Wipe a captured-image Buffer in place (PRD §8.2 / AC-VIS-07).
// JavaScript cannot null out the caller's reference from inside a function;
// callers must drop their own handle after this returns.
export function disposeBuffer(buf: Buffer): void {
  buf.fill(0);
}
