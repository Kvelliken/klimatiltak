// Kjør: node test/calc.test.js
const assert = require('assert');
const calc = require('../src/js/calc.js');
const bib = require('../src/js/bibliotek.js');
const eks = require('../src/js/eksempel.js');

function params(prosjekt) {
  const p = {};
  Object.keys(bib.parametre).forEach(k => { p[k] = bib.parametre[k]; });
  Object.keys(prosjekt.parametre || {}).forEach(k => { if (!calc.erTom(prosjekt.parametre[k])) p[k] = prosjekt.parametre[k]; });
  return p;
}
const P = params(eks);
const mal = id => bib.maler.find(m => m.id === id);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} != ${b}`);

// 1) Diskontering: 4 % i 10 år gir sum av faktorer = 8,1109
let s = 0; for (let t = 1; t <= 10; t++) s += calc.diskonteringsfaktor(t, 0.04);
near(s, 8.1109, 0.0001, 'annuitetsfaktor 10 år');
// R-109: år 41 diskonteres med 3 %
near(calc.diskonteringsfaktor(41, 0.04), calc.diskonteringsfaktor(40, 0.04) / 1.03, 1e-12, 'år 41 med 3 %');

// 2) Elektriske varebiler, regnet for hånd
const t1 = eks.tiltak[0];
const r1 = calc.beregnTiltak(t1, mal(t1.mal), P, eks.innstillinger);
// tonn/år = 20 × 15 000 × 0,08 × 2,6 × (1 − 0,15) / 1000 = 53,04
near(r1.tonnPerAar, 53.04, 1e-9, 'tonn per år');
near(r1.tonnTotalt, 530.4, 1e-9, 'tonn totalt (udiskontert)');
// investering = 20 × (150 000 + 30 000) = 3 600 000
near(r1.komponenter.investering, 3600000, 1e-6, 'investering');
// besparelse/år = 300 000 km × (0,08 × 20 − 0,22 × 1,2) + 20 × 4 000 = 400 800 + 80 000 = 480 800
const B = 480800;
near(r1.komponenter.besparelserNv, B * s, 1e-3, 'besparelser nåverdi');
const kommune = 3600000 - B * s;
near(r1.nv.kommune, kommune, 1e-3, 'netto for kommunen');
near(r1.kpt.kommune, kommune / 530.4, 1e-6, 'kr per tonn');
assert.strictEqual(r1.kategori, 'lonnsom');

// 3) Materialtiltak: engangskutt diskonteres ikke, investering i år 0
const t3 = eks.tiltak[2];
const r3 = calc.beregnTiltak(t3, mal(t3.mal), P, eks.innstillinger);
near(r3.tonnTotalt, 3000 * 250 * 0.10 / 1000, 1e-9, 'betong tonn');
near(r3.kpt.kommune, 90000 / 75, 1e-9, 'betong kr per tonn');
assert.strictEqual(r3.kategori, 'middels');

// 4) Sykkel: nedgang i kuttet og helsegevinst
const t6 = eks.tiltak[5];
const r6 = calc.beregnTiltak(t6, mal(t6.mal), P, eks.innstillinger);
const e1 = 400000 / 1.2 * 120 / 1e6;
let Tsum = 0; for (let t = 1; t <= 30; t++) Tsum += e1 * Math.pow(0.92, t - 1);
near(r6.tonnTotalt, Tsum, 1e-9, 'sykkel tonn med nedgang');
near(r6.komponenter.helsePerAar, 400000 * (0.2 * 29.40 + 0.8 * 20.03), 1e-6, 'helsegevinst per år');
assert.ok(r6.kpt.samfunn < 0, 'samfunnsøkonomisk lønnsom med helse');

// 5) LED med strømfaktor 0: rangeres ikke, men viser sparte kWh
const t8 = eks.tiltak[7];
const r8 = calc.beregnTiltak(t8, mal(t8.mal), P, eks.innstillinger);
assert.strictEqual(r8.rangeres, false);
assert.strictEqual(r8.kwhSpartPerAar, 600000);

// 6) Tilretteleggende tiltak rangeres ikke
const r9 = calc.beregnTiltak(eks.tiltak[8], mal('egendefinert'), P, eks.innstillinger);
assert.strictEqual(r9.rangeres, false);

// 7) Manglende tall: biblioteket alene har ikke dieselfaktor
const Pbib = params({ parametre: {} });
const r1b = calc.beregnTiltak({ id: 'x', mal: 'elvarebil', verdier: { antall: { v: 1 }, aktivitet: { v: 1000 }, fossilPerAkt: { v: 0.1 }, merkostnad: { v: 1 }, levetid: { v: 5 } } }, mal('elvarebil'), Pbib, {});
assert.ok(r1b.mangler.includes('efFossil'), 'skal mangle utslippsfaktor');

// 8) Kategorigrenser og avrunding
assert.strictEqual(calc.kategori(-1), 'lonnsom');
assert.strictEqual(calc.kategori(500), 'lav');
assert.strictEqual(calc.kategori(1500), 'middels');
assert.strictEqual(calc.kategori(1501), 'hoy');
assert.strictEqual(calc.avrundKpt(1240), 1000);
assert.strictEqual(calc.avrundKpt(1260), 1500);
assert.strictEqual(calc.avrundKpt(-570), -600);

// Utskrift av eksempelprosjektet
eks.tiltak.forEach(t => {
  const r = calc.beregnTiltak(t, mal(t.mal), P, eks.innstillinger);
  console.log(t.id.padEnd(4), (r.rangeres ? Math.round(r.kpt.kommune) + ' kr/t (' + r.kategori + '), samfunn ' + Math.round(r.kpt.samfunn) + ', tonn ' + r.tonnTotalt.toFixed(1) : 'ikke rangert: ' + r.grunn).padEnd(70), t.navn);
});
console.log('Alle tester bestått');
