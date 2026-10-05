import { readFile, writeFile } from 'node:fs/promises';
const pages = ['anuncie', 'login', 'cadastro', 'admin-login', 'admin', 'imovel', 'checkout', 'reservas'];
for (const page of pages) {
  const source = new URL(`../${page}.html`, import.meta.url);
  await writeFile(new URL(`../${page}/index.html`, import.meta.url), await readFile(source));
}
console.log('Páginas em diretórios sincronizadas com os HTMLs da raiz.');
