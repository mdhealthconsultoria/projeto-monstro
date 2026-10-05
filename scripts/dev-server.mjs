// Servidor estático mínimo só pra rodar a suíte Playwright localmente
// (não faz parte do app, não é um build step — nenhuma transformação,
// só serve os arquivos como estão). node scripts/dev-server.mjs [porta]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] || 8790);
const root = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    let filePath = normalize(join(root, urlPath));
    if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }

    const st = await stat(filePath).catch(() => null);
    if (st && st.isDirectory()) filePath = join(filePath, 'index.html');

    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => console.log(`dev-server rodando em http://localhost:${port}`));
