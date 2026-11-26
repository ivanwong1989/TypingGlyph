// Optional on-screen log for phones: open the game with ?debug=1 to see the last few input events.
export const DEBUG = new URLSearchParams(location.search).has('debug');
let box: HTMLPreElement | null = null;
const lines: string[] = [];

export function debugLog(msg: string) {
  if (!DEBUG) return;
  if (!box) {
    box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:4px;top:150px;z-index:100;margin:0;padding:4px 6px;max-width:92vw;font:10px/1.3 monospace;color:#fff;background:rgba(0,0,0,0.65);pointer-events:none;white-space:pre-wrap';
    document.body.appendChild(box);
  }
  const t = (performance.now() / 1000).toFixed(2);
  lines.push(`${t} ${msg}`);
  while (lines.length > 9) lines.shift();
  box.textContent = lines.join('\n');
}
