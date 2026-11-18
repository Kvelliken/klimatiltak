// Bygger én selvstendig index.html (for GitHub Pages og forhåndsvisning). Kjør: node build.js
const fs = require('fs'), path = require('path');
const r = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
let tokens = r('src/css/tokens.css').replace(/url\(\.\.\/fonts\/([^)]+)\)/g, (m, f) =>
  'url(data:font/woff2;base64,' + fs.readFileSync(path.join(__dirname, 'fonts', f)).toString('base64') + ')');
const css = [tokens, r('src/css/vargvind.css'), r('src/css/app.css')].join('\n');
const js = ['src/js/calc.js', 'src/js/bibliotek.js', 'src/js/eksempel.js', 'src/js/app.js'].map(r).join('\n;\n');
const html = r('src/index.html').replace('<!--STYLES-->', '<style>\n' + css + '\n</style>').replace('<!--SCRIPTS-->', () => '<script>\n' + js + '\n</script>');
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
// Biblioteket som åpen JSON
const bib = require('./src/js/bibliotek.js');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'data/bibliotek.json'), JSON.stringify(bib, null, 2));
console.log('index.html', (html.length / 1024).toFixed(0), 'kB');
