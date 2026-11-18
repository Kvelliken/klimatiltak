/*
 * Eksempelprosjekt. ALLE TALL HER ER OPPDIKTET for å vise hvordan verktøyet virker.
 * De skal ikke brukes i et budsjett.
 */
(function (root) {
  'use strict';
  var K = 'Eksempeltall (oppdiktet)';
  function E(v) { return { v: v, kilde: K, aar: 2026, kvalitet: 'C' }; }

  var eksempel = {
    kommune: 'Eksempelkommune',
    eksempel: true,
    innstillinger: { maalaar: 2030, maalTonnPerAar: 2000, budsjett: 10000000, grenser: [500, 1500] },
    parametre: {
      efDiesel: E(2.6), efFyringsolje: E(2.7), prisDiesel: E(20), prisAnleggsdiesel: E(15),
      prisStrom: E(1.2), karbonpris: E(2000)
    },
    egneMaler: [],
    tiltak: [
      { id: 't1', mal: 'elvarebil', navn: '20 elektriske varebiler i hjemmetjenesten', ansvarlig: 'Helse og omsorg', status: 'foreslått', effekttype: 'beregnet',
        verdier: { antall: E(20), aktivitet: E(15000), fossilPerAkt: E(0.08), elPerAkt: E(0.22), merkostnad: E(150000), ladeinfra: E(30000), vedlikehold: E(4000), levetid: E(10), startaar: E(2027) } },
      { id: 't2', mal: 'anleggsmaskiner', navn: 'Krav om elektriske gravemaskiner i tre kommunale byggeprosjekter', ansvarlig: 'Eiendom', status: 'foreslått', effekttype: 'beregnet',
        verdier: { antall: E(3), aktivitet: E(1200), fossilPerAkt: E(15), elPerAkt: E(60), merkostnad: E(2500000), ladeinfra: E(300000), tilskudd: E(1500000), levetid: E(10), startaar: E(2027) } },
      { id: 't3', mal: 'lavkarbonbetong20', navn: 'Lavkarbonbetong klasse 20 i ny ungdomsskole', ansvarlig: 'Eiendom', status: 'foreslått', effekttype: 'beregnet',
        verdier: { mengde: E(3000), efRef: E(250), merkostnadPerEnhet: E(30), levetid: E(60), startaar: E(2027) } },
      { id: 't4', mal: 'trefremforstal', navn: 'Limtre i stedet for stål i ny ungdomsskole', ansvarlig: 'Eiendom', status: 'foreslått', effekttype: 'beregnet',
        verdier: { mengde: E(40), efRef: E(1800), reduksjon: E(70), merkostnadPerEnhet: E(-2000), levetid: E(60), startaar: E(2027) } },
      { id: 't5', mal: 'fossilvarme', navn: 'Gassfyring erstattes med varmepumpe i fire bygg', ansvarlig: 'Eiendom', status: 'vedtatt', effekttype: 'beregnet',
        verdier: { fossilErstattet: E(40000), kwhEkstra: E(130000), prisFossil: E(18), vedlikehold: E(-20000), investering: E(2400000), levetid: E(20), startaar: E(2027) } },
      { id: 't6', mal: 'sykkelgange', navn: 'Sykkelvei og sykkelparkering ved skolene', ansvarlig: 'Samferdsel', status: 'foreslått', effekttype: 'beregnet',
        verdier: { pkm: E(400000), andelGange: E(20), bilUtslipp: E(120), belegg: E(1.2), investering: E(8000000), drift: E(100000), effektnedgang: E(8), levetid: E(30), startaar: E(2028) } },
      { id: 't7', mal: 'matsvinn', navn: 'Måling og tiltak mot matsvinn på sykehjemmene', ansvarlig: 'Helse og omsorg', status: 'vedtatt', effekttype: 'beregnet',
        verdier: { mengdeRedusert: E(20000), efVare: E(2.5), prisVare: E(60), investering: E(50000), drift: E(150000), levetid: E(5), startaar: E(2027) } },
      { id: 't8', mal: 'ledgatelys', navn: 'LED i alle kommunale gatelys', ansvarlig: 'Samferdsel', status: 'vedtatt', effekttype: 'beregnet',
        verdier: { kwhSpart: E(600000), investering: E(6000000), vedlikehold: E(150000), levetid: E(20), startaar: E(2027) } },
      { id: 't9', mal: 'egendefinert', navn: 'Ladepunkter for innbyggere i sentrum', ansvarlig: 'Samferdsel', status: 'vedtatt', effekttype: 'tilretteleggende', sektor: 'Veitrafikk', verdier: {} },
      { id: 't10', mal: 'egendefinert', navn: 'Klimakrav ved innkjøp av IKT-utstyr', ansvarlig: 'Innkjøp', status: 'foreslått', effekttype: 'indirekte-ikke-kvantifisert', sektor: 'Forbruk', omfang: 'indirekte', verdier: {} }
    ]
  };

  root.KT = root.KT || {};
  root.KT.eksempel = eksempel;
  if (typeof module !== 'undefined' && module.exports) module.exports = eksempel;
})(typeof window !== 'undefined' ? window : globalThis);
