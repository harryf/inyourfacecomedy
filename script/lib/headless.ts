// Headless Brave (or Chrome) over the Chrome DevTools Protocol, for scripts that render the
// site's own canvases (meta-lineup-ad.ts, meta-bank.ts). One browser per run, one page.

import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromiumBinary } from "./email/images";

export interface Cdp { send(method: string, params?: any): Promise<any>; on(method: string, fn: (p: any) => void): void; close(): void }

export async function openBrowser(tag = "iyf-render"): Promise<{ cdp: Cdp; kill: () => void }> {
  const bin = chromiumBinary();
  if (!bin) throw new Error("no Brave or Chrome found for the render");
  const profile = join(tmpdir(), `${tag}-${process.pid}`);
  const child = spawn(bin, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--window-size=1200,900", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl: string = await new Promise((res, rej) => {
    let buf = "";
    const t = setTimeout(() => rej(new Error("browser did not start (no DevTools line in 30 s)")), 30_000);
    child.stderr.on("data", (d) => { buf += d.toString(); const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
    child.on("exit", (c) => { clearTimeout(t); rej(new Error(`browser exited early (${c})`)); });
  });
  const port = new URL(wsUrl).port;
  // The first page target can appear a moment after the DevTools line; poll, then open one.
  let page: any;
  for (let i = 0; i < 20 && !page; i++) {
    const targets: any[] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = targets.find((t) => t.type === "page");
    if (!page) await new Promise((r) => setTimeout(r, 250));
  }
  if (!page) page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  if (!page?.webSocketDebuggerUrl) throw new Error("no page target in headless browser");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(new Error(`devtools socket: ${String(e)}`)); });
  let id = 0;
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  const listeners = new Map<string, ((p: any) => void)[]>();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)!; pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    } else if (msg.method) for (const fn of listeners.get(msg.method) || []) fn(msg.params);
  };
  const cdp: Cdp = {
    send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }),
    on: (method, fn) => { listeners.set(method, [...(listeners.get(method) || []), fn]); },
    close: () => { try { ws.close(); } catch {} },
  };
  return { cdp, kill: () => { cdp.close(); try { child.kill(); } catch {} } };
}

// Navigate the page and wait for its load event.
export async function navigate(cdp: Cdp, url: string): Promise<void> {
  await cdp.send("Page.enable");
  const loaded = new Promise<void>((res) => cdp.on("Page.loadEventFired", () => res()));
  await cdp.send("Page.navigate", { url });
  await Promise.race([loaded, new Promise<void>((_, rej) => setTimeout(() => rej(new Error(`page did not load in 30 s: ${url}`)), 30_000))]);
}

// Evaluate an expression that returns a promise; the resolved value comes back by value.
export async function evaluate<T = any>(cdp: Cdp, expression: string): Promise<T> {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`in page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value as T;
}

// A PNG data URL to bytes.
export function pngBytes(dataUrl: string): Uint8Array {
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!m) throw new Error("expected a PNG data URL");
  return Buffer.from(m[1], "base64");
}
