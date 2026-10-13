// Empaqueta dist-artifact/ en un único HTML para publicarlo como artefacto de Claude.
// El visor añade <!doctype>, <html>, <head> y <body>: aquí solo va el contenido.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const dir = 'dist-artifact/assets'
const files = readdirSync(dir)
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n')
const js = files
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
  .join('\n')
  .replace(/<\/script/gi, '<\\/script')

const html = `<title>Mi Vida</title>
<meta name="theme-color" content="#0b0f17">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync('dist-artifact/mi-vida.html', html)
console.log(`dist-artifact/mi-vida.html · ${(html.length / 1024).toFixed(0)} KB`)
