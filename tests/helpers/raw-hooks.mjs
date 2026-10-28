import { readFile } from 'node:fs/promises';

// 讓 Node 測試能像 webpack 一樣載入 `*.css?raw`。
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('?raw')) {
    return { url: new URL(specifier, context.parentURL).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('?raw')) {
    const fileUrl = new URL(url);
    fileUrl.search = '';
    const source = await readFile(fileUrl, 'utf8');
    return { format: 'module', source: `export default ${JSON.stringify(source)};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
