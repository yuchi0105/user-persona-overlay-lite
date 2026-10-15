import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, normalize, relative, resolve } from 'node:path';

const root = process.cwd();
const host = '127.0.0.1';
const port = 5500;
const mimeTypes = {
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${host}:${port}`).pathname);
  const relativePath = normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = resolve(root, relativePath);
  const relation = relative(root, filePath);
  if (relation.startsWith('..') || isAbsolute(relation)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!statSync(filePath).isFile()) {
      throw new Error('Not a file');
    }
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end('Not found');
  }
}).listen(port, host, () => {
  console.info(`Persona Overlay Lite dev server: http://${host}:${port}`);
});
