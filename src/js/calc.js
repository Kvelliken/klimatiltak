/*
 * Beregningskjerne for kostnadseffektive klimatiltak.
 * Metode: Miljødirektoratet M-1084. Kostnader diskonteres, tonn summeres udiskontert.
 * Ren JavaScript uten avhengigheter. Brukes både i nettleseren (window.KT.calc) og i Node (tester).
 */
(function (root) {
  'use strict';

  // ---------- Hjelpere for verdier ----------
  // En verdi lagres som objekt: { v: tall, kilde: tekst, aar: tall, kvalitet: 'A'|'B'|'C' }
  // eller som referanse til en felles parameter: { ref: 'prisStrom' }.
  function erTom(x) {
    if (x === null || x === undefined) return true;
    if (typeof x === 'object') return x.v === null || x.v === undefined || x.v === '' || isNaN(+x.v);
    return x === '' || isNaN(+x);
  }
  function tall(x) { return erTom(x) ? null : +(typeof x === 'object' ? x.v : x); }

  // ---------- Diskontering (R-109: 4 % i 40 år, så 1 og 2 prosentpoeng lavere) ----------
  function diskonteringsfaktor(t, r) {
    var f = 1;
    for (var y = 1; y <= t; y++) {
      var rr = y <= 40 ? r : (y <= 75 ? Math.max(r - 0.01, 0) : Math.max(r - 0.02, 0));
      f = f / (1 + rr);
    }
    return f;
  }

  // ---------- Felles felt for alle tiltak ----------
  var FELLES = [
    { id: 'levetid', label: 'Levetid', enhet: 'år', gruppe: 'grunnlag', paakrevd: true,
      hjelp: 'Hvor mange år tiltaket virker før det må fornyes. Kostnader og kutt regnes over denne perioden.' },
    { id: 'startaar', label: 'Første virkeår', enhet: 'år', gruppe: 'grunnlag',
      hjelp: 'Året tiltaket begynner å virke. Brukes til å vise kuttet i målåret.' },
    { id: 'investering', label: 'Investering eller engangskostnad', enhet: 'kr', gruppe: 'kostnad',
      hjelp: 'Kostnader som kommer én gang ved oppstart, utover det som er regnet per enhet over. Bruk kroner uten merverdiavgift som kommunen får kompensert.' },
    { id: 'drift', label: 'Årlige driftskostnader', enhet: 'kr per år', gruppe: 'kostnad',
      hjelp: 'Nye kostnader hvert år, for eksempel lisenser, årsverk eller service. Ikke ta med det kommunen sparer – det føres under besparelser.' },
    { id: 'tilskudd', label: 'Statlig tilskudd', enhet: 'kr', gruppe: 'kostnad',
      hjelp: 'Støtte fra for eksempel Klimasats eller Enova. Trekkes fra kommunens kostnad, men ikke i det samfunnsøkonomiske regnestykket.' },
    { id: 'effektnedgang', label: 'Årlig nedgang i kuttet', enhet: '% per år', gruppe: 'effekt',
      hjelp: 'Hvor mye mindre kuttet blir for hvert år fordi utslippene ville gått ned uansett, for eksempel fordi bilparken blir elektrisk. 0 betyr at kuttet er like stort hvert år.' },
    { id: 'overlapp', label: 'Justering for overlapp', enhet: '%', gruppe: 'effekt',
      hjelp: 'Hvor stor del av kuttet som allerede er regnet med i et annet tiltak. 20 betyr at kuttet reduseres med 20 %.' },
    { id: 'andreGevinster', label: 'Andre gevinster for samfunnet', enhet: 'kr per år', gruppe: 'samfunn',
      hjelp: 'Verdien av gevinster for innbyggere eller næringsliv som ikke er regnet med andre steder. Brukes bare i det samfunnsøkonomiske tallet.' },
    { id: 'avgifter', label: 'Herav skatter og avgifter i investeringen', enhet: 'kr', gruppe: 'samfunn',
      hjelp: 'Skatter og avgifter er overføringer til staten og trekkes ut av det samfunnsøkonomiske tallet (M-1084).' },
    { id: 'usikkerhetKost', label: 'Usikkerhet i kostnadene', enhet: '±%', gruppe: 'usikkerhet',
      hjelp: 'Hvor mye kostnadene kan avvike. Miljødirektoratet anbefaler ±30 % når informasjonen er begrenset.' },
    { id: 'usikkerhetEffekt', label: 'Usikkerhet i utslippskuttet', enhet: '±%', gruppe: 'usikkerhet',
      hjelp: 'Hvor mye utslippskuttet kan avvike. ±30 % er standard når informasjonen er begrenset.' }
  ];

  // ---------- Beregningsmodeller ----------
  // Hver modell gir: tonnPerAar, tonnEngangs, investering, besparelser per år (energi, materiell, vedlikehold),
  // samfunnsgevinster per år (helse, luft, andre) og endring i strømbruk (kWh per år).
  var MODELLER = {
    kjoretoy: {
      navn: 'Kjøretøy og maskiner',
      felt: [
        { id: 'antall', label: 'Antall kjøretøy eller maskiner', enhet: 'stk', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mange fossile kjøretøy eller maskiner som erstattes.' },
        { id: 'aktivitet', label: 'Bruk per kjøretøy', enhet: '{aktivitetEnhet} per år', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mye hvert kjøretøy brukes i året.' },
        { id: 'fossilPerAkt', label: 'Drivstofforbruk, fossilt kjøretøy', enhet: 'liter per {aktivitetEnhetEntall}', gruppe: 'effekt', paakrevd: true, hjelp: 'Forbruket til kjøretøyet som byttes ut.' },
        { id: 'efFossil', label: 'Utslipp per liter drivstoff', enhet: 'kg CO2e per liter', gruppe: 'effekt', paakrevd: true, hjelp: 'Utslippsfaktor for rent fossilt drivstoff.' },
        { id: 'bioandel', label: 'Innblandet biodrivstoff', enhet: '%', gruppe: 'effekt', hjelp: 'Andelen biodrivstoff som allerede er i drivstoffet. Biogen CO2 telles som null, så denne andelen trekkes fra kuttet.' },
        { id: 'elPerAkt', label: 'Strømforbruk, elektrisk kjøretøy', enhet: 'kWh per {aktivitetEnhetEntall}', gruppe: 'effekt', hjelp: 'Brukes til strømkostnad og eventuelt utslipp fra strøm.' },
        { id: 'efStrom', label: 'Utslipp per kWh strøm', enhet: 'kg CO2e per kWh', gruppe: 'effekt', hjelp: 'Standard er samme avgrensning som kommunestatistikken (direkte utslipp).' },
        { id: 'merkostnad', label: 'Merpris per elektrisk kjøretøy', enhet: 'kr', gruppe: 'kostnad', paakrevd: true, hjelp: 'Hvor mye mer det elektriske kjøretøyet koster enn et fossilt, eller merkostnaden i kontrakten.' },
        { id: 'ladeinfra', label: 'Lading per kjøretøy', enhet: 'kr', gruppe: 'kostnad', hjelp: 'Ladepunkt, nettoppgradering eller batteribank fordelt per kjøretøy.' },
        { id: 'prisFossil', label: 'Pris drivstoff', enhet: 'kr per liter', gruppe: 'besparelse', hjelp: 'Det kommunen betaler per liter, uten mva.' },
        { id: 'prisStrom', label: 'Pris strøm', enhet: 'kr per kWh', gruppe: 'besparelse', hjelp: 'Det kommunen betaler per kWh inkludert nettleie, uten mva.' },
        { id: 'vedlikehold', label: 'Spart vedlikehold per kjøretøy', enhet: 'kr per år', gruppe: 'besparelse', hjelp: 'Positivt tall hvis det elektriske kjøretøyet er billigere å vedlikeholde.' },
        { id: 'noxPerAkt', label: 'Redusert NOx', enhet: 'gram per {aktivitetEnhetEntall}', gruppe: 'samfunn', hjelp: 'Lokal luftforurensning som unngås. Brukes bare i det samfunnsøkonomiske tallet.' },
        { id: 'pmPerAkt', label: 'Redusert svevestøv (PM)', enhet: 'gram per {aktivitetEnhetEntall}', gruppe: 'samfunn', hjelp: 'Partikler fra eksos som unngås.' },
        { id: 'kostNox', label: 'Helsekostnad per kg NOx', enhet: 'kr per kg', gruppe: 'samfunn', hjelp: 'Enhetsverdi fra Statens vegvesens håndbok V712.' },
        { id: 'kostPm', label: 'Helsekostnad per kg PM', enhet: 'kr per kg', gruppe: 'samfunn', hjelp: 'Enhetsverdi fra Statens vegvesens håndbok V712.' }
      ],
      beregn: function (x) {
        var akt = x.antall * x.aktivitet;
        var liter = akt * x.fossilPerAkt;
        var kwh = akt * (x.elPerAkt || 0);
        return {
          tonnPerAar: (liter * x.efFossil * (1 - (x.bioandel || 0) / 100) - kwh * (x.efStrom || 0)) / 1000,
          tonnEngangs: 0,
          investering: x.antall * ((x.merkostnad || 0) + (x.ladeinfra || 0)),
          energi: liter * (x.prisFossil || 0) - kwh * (x.prisStrom || 0),
          materiell: 0,
          vedlikehold: x.antall * (x.vedlikehold || 0),
          helse: 0,
          luft: akt * ((x.noxPerAkt || 0) * (x.kostNox || 0) + (x.pmPerAkt || 0) * (x.kostPm || 0)) / 1000,
          andre: 0,
          kwhSpart: -kwh
        };
      }
    },
    energi: {
      navn: 'Energi i bygg og anlegg',
      felt: [
        { id: 'fossilErstattet', label: 'Fossilt brensel som fases ut', enhet: 'liter (eller kg) per år', gruppe: 'effekt', hjelp: 'Mengde olje, gass eller diesel til oppvarming som ikke lenger brukes.' },
        { id: 'efFossil', label: 'Utslipp per liter (eller kg) brensel', enhet: 'kg CO2e per enhet', gruppe: 'effekt', hjelp: 'Utslippsfaktor for brenselet som fases ut.' },
        { id: 'kwhSpart', label: 'Strøm spart', enhet: 'kWh per år', gruppe: 'effekt', hjelp: 'Redusert strømbruk, for eksempel fra etterisolering eller LED.' },
        { id: 'kwhEkstra', label: 'Ny strømbruk', enhet: 'kWh per år', gruppe: 'effekt', hjelp: 'Økt strømbruk, for eksempel til varmepumpen som erstatter oljefyren.' },
        { id: 'efStrom', label: 'Utslipp per kWh strøm', enhet: 'kg CO2e per kWh', gruppe: 'effekt', hjelp: 'Standard er samme avgrensning som kommunestatistikken (direkte utslipp).' },
        { id: 'prisFossil', label: 'Pris brensel', enhet: 'kr per liter (eller kg)', gruppe: 'besparelse', hjelp: 'Uten mva.' },
        { id: 'prisStrom', label: 'Pris strøm', enhet: 'kr per kWh', gruppe: 'besparelse', hjelp: 'Inkludert nettleie, uten mva.' },
        { id: 'vedlikehold', label: 'Endring i vedlikehold', enhet: 'kr per år', gruppe: 'besparelse', hjelp: 'Positivt tall hvis vedlikeholdet blir billigere, negativt hvis det blir dyrere.' }
      ],
      beregn: function (x) {
        var netto = (x.kwhEkstra || 0) - (x.kwhSpart || 0);
        return {
          tonnPerAar: ((x.fossilErstattet || 0) * (x.efFossil || 0) - netto * (x.efStrom || 0)) / 1000,
          tonnEngangs: 0, investering: 0,
          energi: (x.fossilErstattet || 0) * (x.prisFossil || 0) - netto * (x.prisStrom || 0),
          materiell: 0, vedlikehold: x.vedlikehold || 0, helse: 0, luft: 0, andre: 0,
          kwhSpart: -netto
        };
      }
    },
    materiale: {
      navn: 'Materialer i bygg og anlegg',
      felt: [
        { id: 'mengde', label: 'Mengde', enhet: '{mengdeEnhet}', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mye av materialet prosjektet bruker.' },
        { id: 'efRef', label: 'Utslipp for vanlig løsning', enhet: 'kg CO2e per {mengdeEnhet}', gruppe: 'effekt', paakrevd: true, hjelp: 'Utslipp fra produksjon (A1–A3) for løsningen som ellers ville blitt valgt.' },
        { id: 'reduksjon', label: 'Reduksjon med tiltaket', enhet: '%', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mye lavere utslippet er med den klimavennlige løsningen.' },
        { id: 'merkostnadPerEnhet', label: 'Merkostnad', enhet: 'kr per {mengdeEnhet}', gruppe: 'kostnad', hjelp: 'Negativt tall hvis løsningen er billigere.' }
      ],
      beregn: function (x) {
        return {
          tonnPerAar: 0,
          tonnEngangs: x.mengde * x.efRef * x.reduksjon / 100 / 1000,
          investering: x.mengde * (x.merkostnadPerEnhet || 0),
          energi: 0, materiell: 0, vedlikehold: 0, helse: 0, luft: 0, andre: 0, kwhSpart: 0
        };
      }
    },
    aktivtransport: {
      navn: 'Gange, sykkel og kollektiv',
      felt: [
        { id: 'pkm', label: 'Reiser flyttet fra bil', enhet: 'personkilometer per år', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mange kilometer som gås, sykles eller tas kollektivt i stedet for med bil.' },
        { id: 'andelGange', label: 'Andel som går', enhet: '%', gruppe: 'effekt', hjelp: 'Resten regnes som sykling. Settes til 0 for kollektivtiltak og fyll da ikke inn helsegevinst.' },
        { id: 'bilUtslipp', label: 'Utslipp per kilometer med bil', enhet: 'gram CO2e per km', gruppe: 'effekt', paakrevd: true, hjelp: 'Gjennomsnitt for bilene i kommunen. Bruk kommunens egen faktor fra utslippsstatistikken hvis den finnes.' },
        { id: 'belegg', label: 'Personer per bil', enhet: 'personer', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mange som i snitt sitter i bilen.' },
        { id: 'helseGange', label: 'Helsegevinst per km gange', enhet: 'kr per personkilometer', gruppe: 'samfunn', hjelp: 'Verdien av bedre folkehelse.' },
        { id: 'helseSykkel', label: 'Helsegevinst per km sykling', enhet: 'kr per personkilometer', gruppe: 'samfunn', hjelp: 'Verdien av bedre folkehelse.' },
        { id: 'sparteBilkostnader', label: 'Sparte bilkostnader for innbyggerne', enhet: 'kr per bilkilometer', gruppe: 'samfunn', hjelp: 'Drivstoff, slitasje og annet innbyggerne sparer.' }
      ],
      beregn: function (x) {
        var vkm = x.pkm / (x.belegg || 1);
        var g = (x.andelGange || 0) / 100;
        return {
          tonnPerAar: vkm * x.bilUtslipp / 1e6,
          tonnEngangs: 0, investering: 0, energi: 0, materiell: 0, vedlikehold: 0,
          helse: x.pkm * (g * (x.helseGange || 0) + (1 - g) * (x.helseSykkel || 0)),
          luft: 0,
          andre: vkm * (x.sparteBilkostnader || 0),
          kwhSpart: 0
        };
      }
    },
    innkjop: {
      navn: 'Innkjøp, mat og forbruk',
      felt: [
        { id: 'mengdeRedusert', label: 'Mindre innkjøp eller svinn', enhet: 'kg per år', gruppe: 'effekt', paakrevd: true, hjelp: 'Hvor mye mindre som kjøpes eller kastes.' },
        { id: 'efVare', label: 'Utslipp per kg', enhet: 'kg CO2e per kg', gruppe: 'effekt', paakrevd: true, hjelp: 'Utslipp fra produksjon og transport av varen.' },
        { id: 'prisVare', label: 'Innkjøpspris', enhet: 'kr per kg', gruppe: 'besparelse', hjelp: 'Det kommunen sparer per kg som ikke kjøpes.' }
      ],
      beregn: function (x) {
        return {
          tonnPerAar: x.mengdeRedusert * x.efVare / 1000,
          tonnEngangs: 0, investering: 0, energi: 0,
          materiell: x.mengdeRedusert * (x.prisVare || 0),
          vedlikehold: 0, helse: 0, luft: 0, andre: 0, kwhSpart: 0
        };
      }
    },
    direkte: {
      navn: 'Egendefinert',
      felt: [
        { id: 'tonnPerAar', label: 'Utslippskutt per år', enhet: 'tonn CO2e per år', gruppe: 'effekt', hjelp: 'Brukes når kuttet er regnet ut et annet sted, for eksempel i Miljødirektoratets regnemaler.' },
        { id: 'tonnEngangs', label: 'Engangskutt', enhet: 'tonn CO2e', gruppe: 'effekt', hjelp: 'Kutt som skjer én gang, for eksempel ved bygging.' },
        { id: 'besparelse', label: 'Årlige besparelser', enhet: 'kr per år', gruppe: 'besparelse', hjelp: 'Lavere kostnader for kommunen hvert år.' }
      ],
      beregn: function (x) {
        return {
          tonnPerAar: x.tonnPerAar || 0, tonnEngangs: x.tonnEngangs || 0, investering: 0,
          energi: 0, materiell: x.besparelse || 0, vedlikehold: 0, helse: 0, luft: 0, andre: 0, kwhSpart: 0
        };
      }
    }
  };

  var EFFEKTTYPER = {
    'beregnet': 'Beregnet',
    'ikke-beregnet': 'Ikke beregnet',
    'tilretteleggende': 'Tilretteleggende',
    'indirekte-ikke-kvantifisert': 'Indirekte, ikke kvantifisert'
  };

  // ---------- Oppslag av verdier: tiltak → mal → felles parameter ----------
  function slaaOpp(tiltak, felt, mal, parametre) {
    var egen = tiltak.verdier && tiltak.verdier[felt];
    if (egen && !erTom(egen)) return { v: tall(egen), kilde: egen.kilde || '', aar: egen.aar || null, kvalitet: egen.kvalitet || 'A', niva: 'tiltak' };
    var std = mal && mal.standard && mal.standard[felt];
    if (std && std.ref) {
      var p = parametre && parametre[std.ref];
      if (p && !erTom(p)) return { v: tall(p), kilde: p.kilde || '', aar: p.aar || null, kvalitet: p.kvalitet || 'B', niva: 'parameter', ref: std.ref };
      return { v: null, niva: 'mangler', ref: std.ref };
    }
    if (std && !erTom(std)) return { v: tall(std), kilde: std.kilde || '', aar: std.aar || null, kvalitet: std.kvalitet || 'B', niva: 'mal' };
    return { v: null, niva: 'mangler' };
  }

  function alleFelt(modell) {
    var m = MODELLER[modell];
    return (m ? m.felt : []).concat(FELLES);
  }

  // ---------- Hovedberegning for ett tiltak ----------
  function beregnTiltak(tiltak, mal, parametre, innstillinger) {
    innstillinger = innstillinger || {};
    var modellNavn = tiltak.modell || (mal && mal.modell) || 'direkte';
    var modell = MODELLER[modellNavn];
    var res = { id: tiltak.id, modell: modellNavn, advarsler: [], mangler: [], verdier: {}, rangeres: false };
    var effekttype = tiltak.effekttype || 'beregnet';
    res.effekttype = effekttype;

    var x = {};
    alleFelt(modellNavn).forEach(function (f) {
      var o = slaaOpp(tiltak, f.id, mal, parametre);
      res.verdier[f.id] = o;
      x[f.id] = o.v;
      if (o.v === null && f.paakrevd) res.mangler.push(f.id);
    });

    // Standardverdier for felles felt
    if (x.usikkerhetKost === null) x.usikkerhetKost = 30;
    if (x.usikkerhetEffekt === null) x.usikkerhetEffekt = 30;
    var r = (tall(parametre && parametre.rente) !== null ? tall(parametre.rente) : 4) / 100;

    if (effekttype !== 'beregnet') {
      res.grunn = EFFEKTTYPER[effekttype] || effekttype;
      return res;
    }
    if (res.mangler.length) {
      res.grunn = 'Mangler tall';
      return res;
    }

    var m = modell.beregn(x);
    var n = Math.max(1, Math.round(x.levetid));
    var g = (x.effektnedgang || 0) / 100;
    var ov = (x.overlapp || 0) / 100;
    var I = m.investering + (x.investering || 0);
    var D = x.drift || 0;
    var B = m.energi + m.materiell + m.vedlikehold;
    var S = x.tilskudd || 0;
    var SG = m.helse + m.luft + m.andre + (x.andreGevinster || 0);

    var tonnAar = [];
    var T = m.tonnEngangs * (1 - ov);
    var npvD = 0, npvB = 0, npvSG = 0;
    for (var t = 1; t <= n; t++) {
      var df = diskonteringsfaktor(t, r);
      var e = m.tonnPerAar * Math.pow(1 - g, t - 1) * (1 - ov);
      tonnAar.push(e);
      T += e;
      npvD += df * D; npvB += df * B; npvSG += df * SG;
    }

    var brutto = I + npvD;
    var kommune = brutto - npvB - S;
    var samfunn = kommune + S - (x.avgifter || 0) - npvSG;

    res.n = n;
    res.rente = r;
    res.tonnTotalt = T;
    res.tonnPerAar = m.tonnPerAar * (1 - ov);
    res.tonnEngangs = m.tonnEngangs * (1 - ov);
    res.tonnAar = tonnAar;
    res.kwhSpartPerAar = m.kwhSpart;
    res.komponenter = {
      investering: I, driftNv: npvD, besparelserNv: npvB, tilskudd: S,
      energiPerAar: m.energi, materiellPerAar: m.materiell, vedlikeholdPerAar: m.vedlikehold,
      helsePerAar: m.helse, luftPerAar: m.luft, andrePerAar: m.andre + (x.andreGevinster || 0),
      samfunnsgevinsterNv: npvSG, avgifter: x.avgifter || 0
    };
    res.nv = { brutto: brutto, kommune: kommune, samfunn: samfunn };

    if (!(T > 0)) {
      res.grunn = res.kwhSpartPerAar > 0 ? 'Sparer strøm, men gir ikke direkte utslippskutt med valgt strømfaktor' : 'Gir ikke utslippskutt';
      return res;
    }
    res.rangeres = true;
    res.kpt = { brutto: brutto / T, kommune: kommune / T, samfunn: samfunn / T };
    res.spenn = spenn(kommune, T, x.usikkerhetKost / 100, x.usikkerhetEffekt / 100);
    res.kategori = kategori(res.kpt.kommune, innstillinger.grenser);
    if (T < 1) res.advarsler.push('Svært lite utslippskutt (under 1 tonn totalt). Kroner per tonn blir ustabilt.');

    // Datakvalitet: dårligste kvalitet blant tall som er brukt
    var kval = 'A';
    Object.keys(res.verdier).forEach(function (k) {
      var o = res.verdier[k];
      if (o.v === null) return;
      if (o.kvalitet === 'C') kval = 'C'; else if (o.kvalitet === 'B' && kval === 'A') kval = 'B';
      if (o.kilde && /eksempel/i.test(o.kilde)) res.eksempeltall = true;
    });
    res.datakvalitet = kval;
    if (m.helse === 0 && m.luft === 0 && modellNavn !== 'materiale') {
      // ingen advarsel; samfunnsgevinster er frivillige
    }
    return res;
  }

  function spenn(nv, T, uk, ue) {
    var kost = [nv - Math.abs(nv) * uk, nv + Math.abs(nv) * uk];
    var ton = [T * (1 - ue), T * (1 + ue)];
    var v = [];
    kost.forEach(function (c) { ton.forEach(function (tt) { if (tt > 0) v.push(c / tt); }); });
    return { lav: Math.min.apply(null, v), hoy: Math.max.apply(null, v) };
  }

  var KATEGORIER = [
    { id: 'lonnsom', navn: 'Lønnsomme', kort: 'Lønnsom', budskap: 'Gjør dette uansett. Kommunen sparer penger.' },
    { id: 'lav', navn: 'Lav kostnad', kort: 'Lav', budskap: 'Rimelige kutt. Bør prioriteres.' },
    { id: 'middels', navn: 'Middels kostnad', kort: 'Middels', budskap: 'Vurder mot budsjett og andre gevinster.' },
    { id: 'hoy', navn: 'Høy kostnad', kort: 'Høy', budskap: 'Krever en god begrunnelse utover klima.' }
  ];
  function kategori(kpt, grenser) {
    var g = grenser || [500, 1500];
    if (kpt < 0) return 'lonnsom';
    if (kpt <= g[0]) return 'lav';
    if (kpt <= g[1]) return 'middels';
    return 'hoy';
  }

  // ---------- Portefølje: rangering, overlapp, budsjett ----------
  function rangering(resultater) {
    var r = resultater.filter(function (x) { return x.rangeres; });
    var orden = { lonnsom: 0, lav: 1, middels: 2, hoy: 3 };
    r.sort(function (a, b) {
      if (orden[a.kategori] !== orden[b.kategori]) return orden[a.kategori] - orden[b.kategori];
      if (a.kategori === 'lonnsom') return b.tonnTotalt - a.tonnTotalt;
      return a.kpt.kommune - b.kpt.kommune;
    });
    return r;
  }

  function overlappGrupper(tiltakListe, resultater) {
    var perKilde = {};
    tiltakListe.forEach(function (t, i) {
      var res = resultater[i];
      if (!res || !res.rangeres || !t.utslippskilde) return;
      (perKilde[t.utslippskilde] = perKilde[t.utslippskilde] || []).push(t.id);
    });
    var ut = {};
    Object.keys(perKilde).forEach(function (k) { if (perKilde[k].length > 1) ut[k] = perKilde[k]; });
    return ut;
  }

  function budsjett(rangert, ramme) {
    var sum = 0, tonn = 0, valgt = [];
    rangert.forEach(function (r) {
      if (sum + r.nv.kommune <= ramme || r.nv.kommune <= 0) {
        sum += r.nv.kommune; tonn += r.tonnTotalt; valgt.push(r.id);
      }
    });
    return { kostnad: sum, tonn: tonn, valgt: valgt };
  }

  function kuttIAar(res, startaar, aar) {
    if (!res.rangeres) return 0;
    var t = aar - startaar + 1;
    var v = 0;
    if (t >= 1 && t <= res.tonnAar.length) v += res.tonnAar[t - 1];
    return v;
  }

  // ---------- Avrunding som i Miljødirektoratets presentasjon ----------
  function avrundKpt(x) {
    if (!isFinite(x)) return x;
    var a = Math.abs(x);
    var steg = a < 1000 ? 100 : 500;
    return Math.round(x / steg) * steg;
  }

  var api = {
    FELLES: FELLES, MODELLER: MODELLER, KATEGORIER: KATEGORIER, EFFEKTTYPER: EFFEKTTYPER,
    erTom: erTom, tall: tall, diskonteringsfaktor: diskonteringsfaktor, slaaOpp: slaaOpp, alleFelt: alleFelt,
    beregnTiltak: beregnTiltak, kategori: kategori, rangering: rangering, overlappGrupper: overlappGrupper,
    budsjett: budsjett, kuttIAar: kuttIAar, avrundKpt: avrundKpt
  };
  root.KT = root.KT || {};
  root.KT.calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
