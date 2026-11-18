/* Brukergrensesnitt. Ren JavaScript, ingen avhengigheter. Data lagres bare i nettleseren. */
(function () {
  'use strict';
  var C = window.KT.calc, BIB = window.KT.bibliotek, EKS = window.KT.eksempel;
  var LAGRING = 'klimatiltak-prosjekt-v1';
  var app = document.getElementById('app');
  var tip = document.getElementById('tip');

  // ---------- Tilstand ----------
  var state = { visning: 'oversikt', valgt: null, figurTabell: {}, utkast: {}, dialog: null };
  var P = last() || tomtProsjekt();

  function tomtProsjekt() {
    return { kommune: '', eksempel: false, innstillinger: { maalaar: 2030, maalTonnPerAar: null, budsjett: 0, grenser: [500, 1500] }, parametre: {}, egneMaler: [], tiltak: [] };
  }
  function kopi(o) { return JSON.parse(JSON.stringify(o)); }
  function last() { try { var s = localStorage.getItem(LAGRING); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function lagre() { try { localStorage.setItem(LAGRING, JSON.stringify(P)); } catch (e) { /* privat modus o.l. */ } }

  // ---------- Formatering (norsk: mellomrom som tusenskille, komma, ekte minus) ----------
  var nf0 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
  function minus(s) { return s.replace(/^-/, '−').replace(/-/g, '−'); }
  function n0(x) { return x === null || x === undefined || !isFinite(x) ? '–' : minus(nf0.format(x)); }
  function n1(x) { return x === null || x === undefined || !isFinite(x) ? '–' : minus(nf1.format(x)); }
  function tonn(x) { return Math.abs(x) < 10 ? n1(x) : n0(x); }
  function kpt(x) { return n0(C.avrundKpt(x)) + ' kr/tonn'; }
  function mill(x) { return Math.abs(x) >= 1e6 ? n1(x / 1e6) + ' mill. kr' : n0(x) + ' kr'; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- Data ----------
  function parametre() {
    var p = {};
    Object.keys(BIB.parametre).forEach(function (k) { p[k] = BIB.parametre[k]; });
    Object.keys(P.parametre || {}).forEach(function (k) { if (!C.erTom(P.parametre[k])) p[k] = P.parametre[k]; });
    return p;
  }
  function maler() { return BIB.maler.concat(P.egneMaler || []); }
  function finnMal(id) { return maler().find(function (m) { return m.id === id; }) || BIB.maler.find(function (m) { return m.id === 'egendefinert'; }); }
  function beregn() {
    var pp = parametre();
    return P.tiltak.map(function (t) { return C.beregnTiltak(t, finnMal(t.mal), pp, P.innstillinger); });
  }
  function enhetTekst(tekst, mal) {
    return String(tekst || '').replace('{aktivitetEnhet}', (mal && mal.aktivitetEnhet) || 'km')
      .replace('{aktivitetEnhetEntall}', (mal && mal.aktivitetEnhetEntall) || 'km')
      .replace(/\{mengdeEnhet\}/g, (mal && mal.mengdeEnhet) || 'enhet');
  }
  var KAT = {}; C.KATEGORIER.forEach(function (k) { KAT[k.id] = k; });

  // ---------- Ikoner (linjeikoner 24 px, 1,5 px strek) ----------
  var IKON = {
    info: '<svg class="vv-callout__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    varsel: '<svg class="vv-callout__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>'
  };

  // ---------- Rammeverk ----------
  var NAV = [['oversikt', 'Oversikt'], ['tiltak', 'Tiltak'], ['rangering', 'Rangering'], ['bibliotek', 'Bibliotek og tall'], ['innstillinger', 'Innstillinger'], ['metode', 'Metode']];

  function render() {
    var res = beregn();
    var html = '<header class="vv-header"><div class="vv-header__inner">' +
      '<a class="app-title" href="#" data-nav="oversikt"><strong>Klimatiltak og kostnad</strong><span>' + esc(P.kommune || 'Ingen kommune valgt') + '</span></a>' +
      '<nav aria-label="Hovedmeny"><ul class="vv-nav">' + NAV.map(function (n) {
        return '<li><button type="button" data-nav="' + n[0] + '"' + (state.visning === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + '</button></li>';
      }).join('') + '</ul></nav></div></header><main id="innhold">';
    if (P.eksempel) {
      html += '<div class="vv-callout vv-callout--correction no-print" role="note">' + IKON.varsel + '<div><p class="vv-callout__title">Eksempeltall</p><p class="vv-callout__body">Tallene i dette prosjektet er oppdiktet for å vise hvordan verktøyet virker. De skal ikke brukes i et budsjett. <button class="linkbtn" data-act="nytt">Start et tomt prosjekt</button></p></div></div><div class="mt-6"></div>';
    }
    var v = state.visning;
    if (v === 'tiltak' && state.valgt) html += visRedigering(res);
    else if (v === 'oversikt') html += visOversikt(res);
    else if (v === 'tiltak') html += visTiltakliste(res);
    else if (v === 'rangering') html += visRangering(res);
    else if (v === 'bibliotek') html += visBibliotek();
    else if (v === 'innstillinger') html += visInnstillinger();
    else if (v === 'metode') html += visMetode();
    html += '</main>' + footer();
    if (state.dialog) html += state.dialog(res);
    app.innerHTML = html;
  }

  function footer() {
    return '<footer class="vv-footer"><div class="vv-footer__inner">' +
      '<div><h2>Om verktøyet</h2><p>Åpent verktøy for kommuner som vil finne de mest kostnadseffektive klimatiltakene i klimabudsjettet.</p><p>Tiltaksbibliotek versjon ' + esc(BIB.versjon) + ', ' + esc(datoTekst(BIB.dato)) + '.</p></div>' +
      '<div><h2>Metode</h2><p>Tiltakskostnad etter Miljødirektoratets metodikk (M-1084): nåverdi av kostnader delt på sum tonn CO2e.</p><ul><li><button class="linkbtn" style="color:var(--ink-on-dark)" data-nav="metode">Les om metoden</button></li></ul></div>' +
      '<div><h2>Personvern</h2><p>Alle tall lagres bare i din nettleser. Ingenting sendes til en server.</p></div>' +
      '</div></footer>';
  }
  function datoTekst(iso) {
    var m = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
    var d = String(iso).split('-'); return (+d[2]) + '. ' + m[+d[1] - 1] + ' ' + d[0];
  }
  function sideTopp(tittel, lede) {
    return '<div class="page-head"><h1 class="vv-page-title">' + esc(tittel) + '</h1>' + (lede ? '<p class="vv-lede">' + lede + '</p>' : '') + '</div>';
  }

  // ---------- Oversikt ----------
  function visOversikt(res) {
    var r = res.filter(function (x) { return x.rangeres; });
    var lonn = r.filter(function (x) { return x.kategori === 'lonnsom'; });
    var T = r.reduce(function (s, x) { return s + x.tonnTotalt; }, 0);
    var NV = r.reduce(function (s, x) { return s + x.nv.kommune; }, 0);
    var aar = P.innstillinger.maalaar || 2030;
    var iAar = P.tiltak.reduce(function (s, t, i) { return s + C.kuttIAar(res[i], startaar(t, res[i]), aar); }, 0);
    var maal = P.innstillinger.maalTonnPerAar;
    var lede = P.tiltak.length
      ? r.length + ' av ' + P.tiltak.length + ' tiltak har tall nok til å rangeres. ' + (lonn.length ? lonn.length + ' av dem sparer kommunen penger og kutter til sammen ' + tonn(lonn.reduce(function (s, x) { return s + x.tonnTotalt; }, 0)) + ' tonn CO2e.' : 'Ingen av dem sparer kommunen penger.')
      : 'Finn ut hvilke klimatiltak som gir mest utslippskutt for pengene. Start med å legge inn klimabudsjettet.';
    var h = sideTopp('Oversikt', lede);
    if (P.tiltak.length) {
      h += '<div class="grid-kpi">' +
        kpi('Utslippskutt over levetiden', tonn(T), 'tonn CO2e', 'Summen for ' + r.length + ' rangerte tiltak. Tonn diskonteres ikke.') +
        kpi('Kutt i ' + aar, tonn(iAar), 'tonn per år', maal ? 'Målet er ' + tonn(maal) + ' tonn per år (' + n0(iAar / maal * 100) + ' % nådd).' : 'Sett kuttmål under Innstillinger.') +
        kpi('Netto kostnad for kommunen', mill(NV), '', 'Nåverdi over levetiden, etter besparelser og tilskudd.') +
        kpi('Tiltak som sparer penger', n0(lonn.length), 'av ' + r.length, 'Gjør disse først.') +
        '</div>';
    }
    h += '<div class="section"><h2>Slik bruker du verktøyet</h2><ol class="steps">' +
      '<li><h3>Legg inn klimabudsjettet</h3><p>Lim inn tabellen fra Excel, eller legg inn tiltakene ett og ett.</p></li>' +
      '<li><h3>Fyll inn kommunens tall</h3><p>Velg en tiltaksmal. Skjemaet forklarer hvert tall og viser hva som mangler.</p></li>' +
      '<li><h3>Se rangeringen</h3><p>Tiltakene sorteres etter hvor mye klima de gir for pengene, i Miljødirektoratets kostnadsgrupper.</p></li>' +
      '<li><h3>Ta det med i budsjettet</h3><p>Skriv ut tiltakskort og last ned tabellen til budsjettdokumentet.</p></li>' +
      '</ol><div class="row mt-6">' +
      '<button class="vv-btn vv-btn--primary" data-act="import">Lim inn klimabudsjett</button>' +
      '<button class="vv-btn vv-btn--secondary" data-act="nytt-tiltak">Legg til tiltak</button>' +
      (P.eksempel ? '' : '<button class="vv-btn vv-btn--ghost" data-act="eksempel">Vis eksempelprosjekt</button>') +
      '</div></div>';
    return h;
  }
  function kpi(label, verdi, enhet, meta) {
    return '<div class="vv-kpi"><span class="vv-kpi__label">' + esc(label) + '</span><span class="vv-kpi__value">' + verdi + (enhet ? '<span class="vv-kpi__unit">' + esc(enhet) + '</span>' : '') + '</span><span class="vv-kpi__meta">' + esc(meta) + '</span></div>';
  }
  function startaar(t, r) { var v = r && r.verdier && r.verdier.startaar; return v && v.v ? v.v : (new Date().getFullYear() + 1); }

  // ---------- Tiltaksliste ----------
  function visTiltakliste(res) {
    var h = sideTopp('Tiltak', 'Alle tiltak i klimabudsjettet. Velg et tiltak for å fylle inn tall og se hva det koster per tonn.');
    h += '<div class="row no-print"><button class="vv-btn vv-btn--primary" data-act="nytt-tiltak">Legg til tiltak</button><button class="vv-btn vv-btn--secondary" data-act="import">Lim inn klimabudsjett</button></div>';
    if (!P.tiltak.length) return h + '<p class="mt-6">Ingen tiltak ennå.</p>';
    h += '<div class="vv-table-wrap mt-6"><table class="vv-table"><caption>' + P.tiltak.length + ' tiltak</caption><thead><tr><th>Tiltak</th><th>Status</th><th class="vv-num">Utslippskutt (tonn)</th><th class="vv-num">Kostnad for kommunen</th><th>Gruppe</th><th>Data</th></tr></thead><tbody>';
    P.tiltak.forEach(function (t, i) {
      var r = res[i], mal = finnMal(t.mal);
      h += '<tr><th scope="row"><button class="linkbtn" data-velg="' + esc(t.id) + '">' + esc(t.navn || 'Uten navn') + '</button><div class="muted">' + esc(t.sektor || mal.sektor || '') + (t.ansvarlig ? ' · ' + esc(t.ansvarlig) : '') + '</div></th>' +
        '<td>' + esc(t.status || '') + '</td>' +
        '<td class="vv-num">' + (r.rangeres ? tonn(r.tonnTotalt) : '–') + '</td>' +
        '<td class="vv-num nowrap">' + (r.rangeres ? kpt(r.kpt.kommune) : '–') + '</td>' +
        '<td>' + (r.rangeres ? '<span class="vv-badge vv-badge--info">' + KAT[r.kategori].kort + '</span>' : '<span class="vv-badge">' + esc(r.grunn) + '</span>') + '</td>' +
        '<td>' + (r.mangler.length && r.effekttype === 'beregnet' ? '<span class="vv-badge vv-badge--negative">Mangler ' + r.mangler.length + ' tall</span>' : (r.datakvalitet ? 'Kvalitet ' + r.datakvalitet : '')) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  // ---------- Redigering av ett tiltak ----------
  var GRUPPER = [['effekt', 'Utslippskutt'], ['kostnad', 'Kostnader'], ['besparelse', 'Besparelser for kommunen'], ['grunnlag', 'Levetid og tid'], ['samfunn', 'Gevinster for samfunnet'], ['usikkerhet', 'Usikkerhet']];

  function visRedigering(res) {
    var i = P.tiltak.findIndex(function (t) { return t.id === state.valgt; });
    if (i < 0) { state.valgt = null; return visTiltakliste(res); }
    var t = P.tiltak[i], r = res[i], mal = finnMal(t.mal);
    var h = '<p class="no-print"><button class="linkbtn" data-act="tilbake">← Alle tiltak</button></p>';
    h += '<div class="layout-edit"><div>';
    h += '<h1 class="h-lg" style="font-size:32px;line-height:40px">' + esc(t.navn || 'Nytt tiltak') + '</h1>';
    h += '<fieldset><legend>Om tiltaket</legend><div class="form-grid">' +
      inp('Navn', 'navn', t.navn) + inp('Ansvarlig', 'ansvarlig', t.ansvarlig) +
      sel('Tiltaksmal', 'mal', t.mal, maler().map(function (m) { return [m.id, m.navn + (m.kode ? ' (' + m.kode + ')' : '')]; })) +
      sel('Status', 'status', t.status || 'foreslått', [['vedtatt', 'Vedtatt'], ['foreslått', 'Foreslått']]) +
      sel('Effekt', 'effekttype', t.effekttype || 'beregnet', Object.keys(C.EFFEKTTYPER).map(function (k) { return [k, C.EFFEKTTYPER[k]]; })) +
      sel('Utslipp som telles', 'omfang', t.omfang || mal.omfang || 'direkte', [['direkte', 'Direkte (i kommunestatistikken)'], ['indirekte', 'Indirekte (utenfor kommunen)']]) +
      inp('Utslippskilde (for overlapp)', 'utslippskilde', t.utslippskilde !== undefined ? t.utslippskilde : (mal.utslippskilde || '')) +
      inp('Sektor', 'sektor', t.sektor !== undefined ? t.sektor : (mal.sektor || '')) +
      '</div></fieldset>';
    if (mal.beskrivelse || mal.husk) {
      h += '<div class="vv-callout vv-callout--insight">' + IKON.info + '<div><p class="vv-callout__title">' + esc(mal.navn) + '</p><p class="vv-callout__body">' + esc(mal.beskrivelse || '') + (mal.husk ? ' <strong>Husk:</strong> ' + esc(mal.husk) : '') + '</p></div></div><div class="mt-6"></div>';
    }
    if ((t.effekttype || 'beregnet') === 'beregnet') {
      var felt = C.alleFelt(r.modell);
      GRUPPER.forEach(function (g) {
        var fg = felt.filter(function (f) { return f.gruppe === g[0]; });
        if (!fg.length) return;
        h += '<fieldset><legend>' + g[1] + '</legend>' + fg.map(function (f) { return feltHtml(t, f, r.verdier[f.id], mal); }).join('') + '</fieldset>';
      });
    } else {
      h += '<p>Tiltak med effekttypen «' + esc(C.EFFEKTTYPER[t.effekttype]) + '» rangeres ikke. De vises i en egen liste, slik at politikerne ser dem.</p>';
    }
    h += '<div class="row no-print"><button class="vv-btn vv-btn--secondary" data-act="kort">Vis tiltakskort</button><button class="vv-btn vv-btn--ghost" data-act="slett">Slett tiltaket</button></div>';
    h += '</div><aside class="sticky" aria-label="Resultat">' + resultatPanel(t, r, mal) + '</aside></div>';
    return h;
  }
  function inp(label, id, verdi) { return '<div><label for="f-' + id + '">' + esc(label) + '</label><input type="text" id="f-' + id + '" data-meta="' + id + '" value="' + esc(verdi || '') + '"></div>'; }
  function sel(label, id, verdi, valg) { return '<div><label for="f-' + id + '">' + esc(label) + '</label><select id="f-' + id + '" data-meta="' + id + '">' + valg.map(function (v) { return '<option value="' + esc(v[0]) + '"' + (v[0] === verdi ? ' selected' : '') + '>' + esc(v[1]) + '</option>'; }).join('') + '</select></div>'; }

  function feltHtml(t, f, o, mal) {
    var egen = t.verdier && t.verdier[f.id];
    var utk = state.utkast[t.id + ':' + f.id];
    var v = utk ? utk.v : (egen ? egen.v : '');
    var kilde = utk ? utk.kilde : (egen ? egen.kilde : '');
    var aar = utk ? utk.aar : (egen ? egen.aar : '');
    var kval = utk ? utk.kvalitet : (egen ? egen.kvalitet : 'A');
    var std = '';
    if (o && o.niva === 'parameter') std = 'Standard: ' + n1(o.v) + ' (' + esc(o.kilde || 'kommunens tall') + ')';
    else if (o && o.niva === 'mal') std = 'Standard fra malen: ' + n1(o.v) + ' (' + esc(o.kilde) + ')';
    else if (o && o.niva === 'mangler' && o.ref) std = 'Felles tall mangler. Legg inn under Bibliotek og tall, eller skriv et eget tall her.';
    var id = 'v-' + f.id;
    var h = '<div class="field"><div><label for="' + id + '">' + esc(f.label) + ' <span class="unit">(' + esc(enhetTekst(f.enhet, mal)) + ')</span></label>' +
      (f.paakrevd ? ' <span class="vv-badge">Påkrevd</span>' : '') + '<p class="help">' + esc(f.hjelp) + '</p></div>' +
      '<div><input type="number" step="any" id="' + id + '" data-felt="' + f.id + '" data-del="v" value="' + esc(v) + '" placeholder="' + (o && o.v !== null && o.niva !== 'tiltak' ? esc(n1(o.v)) : '') + '"></div>';
    if (std && !(egen || utk)) h += '<div class="std">' + std + '</div>';
    if (egen || utk) {
      h += '<div class="src"><input class="small-in" type="text" aria-label="Kilde for ' + esc(f.label) + '" placeholder="Kilde (påkrevd)" data-felt="' + f.id + '" data-del="kilde" value="' + esc(kilde) + '">' +
        '<input class="small-in" type="number" aria-label="Årstall" placeholder="År" data-felt="' + f.id + '" data-del="aar" value="' + esc(aar || '') + '">' +
        '<select class="small-in" aria-label="Datakvalitet" data-felt="' + f.id + '" data-del="kvalitet">' + ['A', 'B', 'C'].map(function (k) { return '<option' + (k === kval ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>';
      if (utk && utk.v !== '' && !utk.kilde) h += '<div class="err" role="alert">Skriv kilden for å lagre tallet.</div>';
      else if (egen) h += '<div class="std">Ditt tall' + (egen.kilde ? ' · ' + esc(egen.kilde) : '') + (std ? ' · ' + std.replace('Standard', 'erstatter standard') : '') + '</div>';
    }
    return h + '</div>';
  }

  function resultatPanel(t, r, mal) {
    var h = '<div class="card"><h2 class="h-md">Resultat</h2>';
    if (!r.rangeres) {
      h += '<p class="sentence"><strong>' + esc(r.grunn || 'Ikke rangert') + '.</strong></p>';
      if (r.mangler.length) h += '<p class="small">Disse tallene mangler:</p><ul class="warn">' + r.mangler.map(function (m) { var f = C.alleFelt(r.modell).find(function (x) { return x.id === m; }); return '<li>' + esc(f ? f.label : m) + '</li>'; }).join('') + '</ul>';
      if (r.kwhSpartPerAar > 0) h += '<p class="small">Tiltaket sparer ' + n0(r.kwhSpartPerAar) + ' kWh strøm per år.</p>';
      return h + nasjonal(mal) + '</div>';
    }
    var k = r.kpt.kommune;
    var setning = k < 0 ? 'Tiltaket sparer kommunen ' + n0(Math.abs(C.avrundKpt(k))) + ' kr for hvert tonn CO2e som kuttes.' : 'Hvert tonn CO2e som kuttes, koster kommunen ' + n0(C.avrundKpt(k)) + ' kr.';
    h += '<span class="vv-kpi__label">Kostnad for kommunen</span><div class="result-big">' + kpt(k) + '</div>' +
      '<div class="vv-kpi__range">Spenn ' + n0(C.avrundKpt(r.spenn.lav)) + ' til ' + n0(C.avrundKpt(r.spenn.hoy)) + ' kr/tonn</div>' +
      '<p class="sentence">' + setning + '</p>' +
      '<p><span class="vv-badge vv-badge--info">' + KAT[r.kategori].navn + '</span> <span class="vv-badge">Datakvalitet ' + r.datakvalitet + '</span>' + (r.eksempeltall ? ' <span class="vv-badge vv-badge--negative">Eksempeltall</span>' : '') + '</p>' +
      '<p class="small">' + KAT[r.kategori].budskap + '</p>' +
      trinnFigur(r) +
      '<dl class="small" style="display:grid;grid-template-columns:auto auto;gap:4px 16px;margin:16px 0 0">' +
      '<dt>Utslippskutt</dt><dd class="vv-num" style="margin:0;text-align:right">' + tonn(r.tonnTotalt) + ' tonn over ' + r.n + ' år</dd>' +
      (r.tonnEngangs ? '<dt>Herav engangskutt</dt><dd style="margin:0;text-align:right">' + tonn(r.tonnEngangs) + ' tonn</dd>' : '') +
      '<dt>Investering</dt><dd style="margin:0;text-align:right">' + mill(r.komponenter.investering) + '</dd>' +
      '<dt>Besparelser (nåverdi)</dt><dd style="margin:0;text-align:right">' + mill(r.komponenter.besparelserNv) + '</dd>' +
      (r.komponenter.tilskudd ? '<dt>Tilskudd</dt><dd style="margin:0;text-align:right">' + mill(r.komponenter.tilskudd) + '</dd>' : '') +
      (r.komponenter.samfunnsgevinsterNv ? '<dt>Helse og andre gevinster (nåverdi)</dt><dd style="margin:0;text-align:right">' + mill(r.komponenter.samfunnsgevinsterNv) + '</dd>' : '') +
      (r.kwhSpartPerAar ? '<dt>' + (r.kwhSpartPerAar > 0 ? 'Spart strøm' : 'Økt strømbruk') + '</dt><dd style="margin:0;text-align:right">' + n0(Math.abs(r.kwhSpartPerAar)) + ' kWh per år</dd>' : '') +
      '</dl>';
    if (r.advarsler.length) h += '<ul class="warn">' + r.advarsler.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
    return h + nasjonal(mal) + '</div>';
  }
  function nasjonal(mal) {
    if (!mal.nasjonal) return '';
    return '<p class="muted mt-4">Miljødirektoratets nasjonale anslag (samfunnsøkonomisk): <strong>' + esc(mal.nasjonal.tekst) + '</strong>. Kilde: ' + esc(mal.nasjonal.kilde) + '.</p>';
  }

  // Tre trinn som liggende søyler
  function trinnFigur(r) {
    var rad = [['Brutto', r.kpt.brutto, 'Investering og drift'], ['Netto for kommunen', r.kpt.kommune, 'Etter besparelser og tilskudd'], ['Samfunnsøkonomisk', r.kpt.samfunn, 'Uten avgifter, med helse og andre gevinster']];
    var vals = rad.map(function (x) { return x[1]; });
    var mn = Math.min(0, Math.min.apply(null, vals)), mx = Math.max(0, Math.max.apply(null, vals));
    if (mx === mn) mx = mn + 1;
    var W = 340, L = 0, plotW = W, rowH = 46, H = rad.length * rowH + 8;
    var x = function (v) { return L + (v - mn) / (mx - mn) * plotW; };
    var s = '<figure class="vv-figure" style="padding:16px;margin-top:16px"><p class="h-sm" style="margin:0">Kroner per tonn i tre trinn</p><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kroner per tonn: brutto, netto for kommunen og samfunnsøkonomisk">';
    s += '<line class="vv-axis" x1="' + x(0) + '" x2="' + x(0) + '" y1="0" y2="' + H + '"/>';
    rad.forEach(function (d, i) {
      var y = i * rowH + 18, x0 = x(Math.min(0, d[1])), w = Math.max(2, Math.abs(x(d[1]) - x(0)));
      var focus = i === 1;
      s += '<text x="0" y="' + (y - 4) + '" class="' + (focus ? 'vv-label--strong' : 'vv-label--muted') + '">' + esc(d[0]) + ': ' + esc(n0(C.avrundKpt(d[1]))) + '</text>';
      s += '<rect class="bar-hit ' + (focus ? 'vv-fill-focus' : 'vv-fill-context') + '" x="' + x0 + '" y="' + (y + 2) + '" width="' + w + '" height="14" rx="2" data-tip="<strong>' + esc(d[0]) + '</strong>' + esc(kpt(d[1])) + '<br>' + esc(d[2]) + '"/>';
    });
    return s + '</svg></figure>';
  }

  // ---------- Rangering ----------
  function visRangering(res) {
    var rangert = C.rangering(res);
    var ikke = P.tiltak.map(function (t, i) { return [t, res[i]]; }).filter(function (p) { return !p[1].rangeres; });
    var grupper = C.overlappGrupper(P.tiltak, res);
    var iOverlapp = {}; Object.keys(grupper).forEach(function (k) { grupper[k].forEach(function (id) { iOverlapp[id] = k; }); });
    var lonn = rangert.filter(function (r) { return r.kategori === 'lonnsom'; });
    var lede = rangert.length ? (lonn.length ? lonn.length + ' tiltak sparer kommunen penger og bør gjennomføres uansett. ' : '') + 'Rangeringen viser hvor mye klima kommunen får for pengene. Den er ett grunnlag blant flere.' : 'Ingen tiltak har tall nok til å rangeres ennå.';
    var h = sideTopp('Rangering', lede);
    if (!rangert.length) return h;
    var tiltakAv = {}; P.tiltak.forEach(function (t) { tiltakAv[t.id] = t; });

    // Figur 1: kostnadskurve
    h += figurKort('mac', 'Tiltakene sortert fra billigst til dyrest per tonn',
      'Bredden på hver søyle er tonn CO2e kuttet over levetiden. Høyden er kostnad for kommunen per tonn. Søyler under null sparer penger. Tall over søylene viser plassen i listen under.',
      macFigur(rangert), macTabell(rangert, tiltakAv),
      'Kilde: kommunens egne tall og tiltaksbiblioteket. Metode: Miljødirektoratet M-1084. ' + (P.eksempel ? 'Eksempeltall.' : ''));

    // Prioritert liste
    h += '<div class="section"><h2>Prioritert liste</h2><p class="muted prose">Gruppene følger Miljødirektoratets kostnadsgrenser på 500 og 1 500 kr/tonn. Lønnsomme tiltak sorteres etter størst kutt, de andre etter lavest kostnad per tonn.</p>';
    var nr = 0;
    C.KATEGORIER.forEach(function (k) {
      var g = rangert.filter(function (r) { return r.kategori === k.id; });
      if (!g.length) return;
      h += '<div class="cat-head"><h3>' + k.navn + '</h3><span class="muted">' + esc(k.budskap) + '</span></div>';
      h += '<div class="vv-table-wrap"><table class="vv-table"><thead><tr><th>Nr.</th><th>Tiltak</th><th class="vv-num">Kostnad for kommunen</th><th class="vv-num">Spenn</th><th class="vv-num">Utslippskutt</th><th class="vv-num">Samfunnsøkonomisk</th><th>Merknad</th></tr></thead><tbody>';
      g.forEach(function (r) {
        nr++; var t = tiltakAv[r.id];
        h += '<tr><td><span class="rank">' + nr + '</span></td><th scope="row"><button class="linkbtn" data-velg="' + esc(r.id) + '">' + esc(t.navn) + '</button><div class="muted">' + esc(t.status || '') + ' · ' + (t.omfang || finnMal(t.mal).omfang) + '</div></th>' +
          '<td class="vv-num nowrap"><strong>' + kpt(r.kpt.kommune) + '</strong></td><td class="vv-num nowrap muted">' + n0(C.avrundKpt(r.spenn.lav)) + ' til ' + n0(C.avrundKpt(r.spenn.hoy)) + '</td>' +
          '<td class="vv-num nowrap">' + tonn(r.tonnTotalt) + ' tonn</td><td class="vv-num nowrap">' + kpt(r.kpt.samfunn) + '</td>' +
          '<td>' + (iOverlapp[r.id] ? '<span class="vv-badge vv-badge--negative">Overlapp: ' + esc(iOverlapp[r.id]) + '</span> ' : '') + (r.datakvalitet === 'C' ? '<span class="vv-badge">Grove tall</span> ' : '') + (r.eksempeltall ? '<span class="vv-badge">Eksempeltall</span>' : '') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    });
    if (Object.keys(grupper).length) h += '<p class="small mt-4">Tiltak merket med overlapp påvirker samme utslippskilde. Sjekk at kuttet ikke telles to ganger, og bruk feltet «Justering for overlapp» i tiltaket.</p>';
    h += '</div>';

    // Ikke rangert
    if (ikke.length) {
      h += '<div class="section"><h2>Tiltak som ikke er rangert</h2><p class="muted prose">Disse tiltakene er med i klimabudsjettet, men har ikke tall som kan sammenlignes per tonn.</p><div class="vv-table-wrap"><table class="vv-table"><thead><tr><th>Tiltak</th><th>Grunn</th><th>Merknad</th></tr></thead><tbody>' +
        ikke.map(function (p) { return '<tr><th scope="row"><button class="linkbtn" data-velg="' + esc(p[0].id) + '">' + esc(p[0].navn) + '</button></th><td>' + esc(p[1].grunn) + '</td><td>' + (p[1].kwhSpartPerAar > 0 ? 'Sparer ' + n0(p[1].kwhSpartPerAar) + ' kWh per år' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    }

    // Budsjett
    var ramme = P.innstillinger.budsjett || 0;
    var b = C.budsjett(rangert, ramme);
    var aar = P.innstillinger.maalaar || 2030, maal = P.innstillinger.maalTonnPerAar;
    var iAar = 0; P.tiltak.forEach(function (t, i) { if (b.valgt.indexOf(t.id) >= 0) iAar += C.kuttIAar(res[i], startaar(t, res[i]), aar); });
    h += '<div class="section"><h2>Hvor langt rekker pengene?</h2><div class="row no-print"><label for="budsjett" class="lbl">Ramme for netto kostnad (nåverdi, kr)</label><input id="budsjett" type="number" step="100000" style="max-width:220px" data-innst="budsjett" value="' + esc(ramme) + '"></div>';
    h += '<div class="grid-kpi mt-6">' + kpi('Utslippskutt innenfor rammen', tonn(b.tonn), 'tonn CO2e', b.valgt.length + ' tiltak, over levetiden.') +
      kpi('Kutt i ' + aar, tonn(iAar), 'tonn per år', maal ? n0(iAar / maal * 100) + ' % av målet på ' + tonn(maal) + ' tonn per år.' : 'Sett kuttmål under Innstillinger.') +
      kpi('Netto kostnad', mill(b.kostnad), '', 'Lønnsomme tiltak frigjør penger til de andre.') + '</div>';
    h += '<div class="mt-6">' + figurKort('budsjett', 'Lønnsomme tiltak betaler for en del av de andre',
      'Samlet netto kostnad for kommunen når tiltakene legges til i rangert rekkefølge. Den stiplede linjen er rammen.',
      budsjettFigur(rangert, ramme), '', 'Nåverdi over levetiden. Kilde: kommunens egne tall.') + '</div></div>';
    h += '<div class="row mt-8 no-print"><button class="vv-btn vv-btn--secondary" data-act="csv">Last ned tabellen (CSV)</button><button class="vv-btn vv-btn--secondary" data-act="skriv">Skriv ut</button></div>';
    return h;
  }

  function figurKort(id, tittel, undertittel, figur, tabell, kilde) {
    var vis = state.figurTabell[id] ? 'tabell' : 'figur';
    return '<figure class="vv-figure"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 class="vv-figure__title">' + esc(tittel) + '</h2><p class="vv-figure__subtitle">' + esc(undertittel) + '</p></div>' +
      (tabell ? '<div class="vv-toggle no-print" role="group" aria-label="Visning"><button type="button" data-fig="' + id + '" data-vis="figur" aria-pressed="' + (vis === 'figur') + '">Figur</button><button type="button" data-fig="' + id + '" data-vis="tabell" aria-pressed="' + (vis === 'tabell') + '">Tabell</button></div>' : '') +
      '</div><div class="vv-figure__body">' + (vis === 'tabell' && tabell ? tabell : figur) + '</div><p class="vv-figure__source">' + esc(kilde) + '</p></figure>';
  }

  function macFigur(rangert) {
    var W = 1000, H = 400, ml = 64, mr = 16, mt = 28, mb = 44;
    var tot = rangert.reduce(function (s, r) { return s + r.tonnTotalt; }, 0);
    var vals = rangert.map(function (r) { return r.kpt.kommune; });
    var cap = 6000;
    var ymax = Math.min(cap, Math.max(1600, Math.max.apply(null, vals) * 1.1));
    var ymin = Math.max(-cap, Math.min(0, Math.min.apply(null, vals) * 1.1));
    var kp = C.tall(parametre().karbonpris);
    var g = P.innstillinger.grenser || [500, 1500];
    var X = function (v) { return ml + v / tot * (W - ml - mr); };
    var Y = function (v) { return mt + (ymax - Math.max(ymin, Math.min(ymax, v))) / (ymax - ymin) * (H - mt - mb); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kostnadskurve: tiltakene sortert etter kostnad per tonn">';
    // rutenett og akse
    var steg = niceStep((ymax - ymin) / 6);
    for (var v = Math.ceil(ymin / steg) * steg; v <= ymax; v += steg) {
      s += '<line class="vv-grid" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (ml - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + esc(n0(v)) + '</text>';
    }
    s += '<text x="' + ml + '" y="14" class="vv-label--muted">kr per tonn CO2e</text>';
    // søyler
    var acc = 0;
    rangert.forEach(function (r, i) {
      var x0 = X(acc), x1 = X(acc + r.tonnTotalt); acc += r.tonnTotalt;
      var w = Math.max(1, x1 - x0 - 2), y0 = Y(0), y1 = Y(r.kpt.kommune);
      var top = Math.min(y0, y1), hh = Math.max(1, Math.abs(y1 - y0));
      var t = P.tiltak.find(function (q) { return q.id === r.id; });
      var tipTxt = '<strong>' + esc(i + 1) + '. ' + esc(t.navn) + '</strong>' + esc(kpt(r.kpt.kommune)) + '<br>' + esc(tonn(r.tonnTotalt)) + ' tonn over levetiden<br>' + esc(KAT[r.kategori].navn);
      s += '<rect class="bar-hit vv-fill-context" data-hover-focus x="' + x0 + '" y="' + top + '" width="' + w + '" height="' + hh + '" rx="2" data-tip="' + tipTxt + '" data-velg="' + esc(r.id) + '"/>';
      var cut = r.kpt.kommune > ymax || r.kpt.kommune < ymin;
      var ly = r.kpt.kommune >= 0 ? top - 6 : top + hh + 14;
      if (w > 8) s += '<text x="' + (x0 + w / 2) + '" y="' + ly + '" text-anchor="middle" class="vv-label--strong">' + (i + 1) + (cut ? ': ' + esc(n0(C.avrundKpt(r.kpt.kommune))) : '') + '</text>';
    });
    s += '<line class="vv-axis" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    // referanselinjer
    [[g[0], g[0] + ' kr/tonn'], [g[1], n0(g[1]) + ' kr/tonn']].concat(kp ? [[kp, 'Karbonpris ' + n0(kp) + ' kr/tonn']] : []).forEach(function (rl, ri) {
      if (rl[0] > ymax) return;
      var kb = rl[1].indexOf('Karbon') === 0;
      s += '<line class="vv-ref" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(rl[0]) + '" y2="' + Y(rl[0]) + '" stroke-dasharray="' + (kb ? '6 4' : '0') + '"/><text x="' + (ml + 6 + ri * 190) + '" y="' + (ri === 1 ? Y(rl[0]) + 14 : Y(rl[0]) - 5) + '" text-anchor="start" class="vv-label--muted">' + esc(rl[1]) + '</text>';
    });
    s += '<text x="' + ml + '" y="' + (H - 8) + '">0</text><text x="' + (W - mr) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(tonn(tot)) + ' tonn CO2e kuttet over levetiden</text>';
    if (vals.some(function (v) { return v > ymax || v < ymin; })) s += '<text x="' + ((ml + W) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">Søyler med verdi ved nummeret går utenfor figuren</text>';
    return s + '</svg>';
  }
  function niceStep(x) { var p = Math.pow(10, Math.floor(Math.log10(x))); var f = x / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function macTabell(rangert, tiltakAv) {
    return '<div class="vv-table-wrap"><table class="vv-table"><thead><tr><th>Nr.</th><th>Tiltak</th><th class="vv-num">kr per tonn</th><th class="vv-num">Tonn over levetiden</th><th>Gruppe</th></tr></thead><tbody>' +
      rangert.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><th scope="row">' + esc(tiltakAv[r.id].navn) + '</th><td class="vv-num">' + n0(C.avrundKpt(r.kpt.kommune)) + '</td><td class="vv-num">' + tonn(r.tonnTotalt) + '</td><td>' + KAT[r.kategori].kort + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function budsjettFigur(rangert, ramme) {
    var W = 1000, H = 300, ml = 80, mr = 16, mt = 24, mb = 40;
    var pts = [[0, 0]], acc = 0, cost = 0;
    rangert.forEach(function (r) { acc += r.tonnTotalt; cost += r.nv.kommune; pts.push([acc, cost, r]); });
    var ys = pts.map(function (p) { return p[1]; }).concat([ramme, 0]);
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    var pad = (ymax - ymin) * 0.08 || 1; ymin -= pad; ymax += pad;
    var X = function (v) { return ml + v / acc * (W - ml - mr); };
    var Y = function (v) { return mt + (ymax - v) / (ymax - ymin) * (H - mt - mb); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Samlet netto kostnad når tiltakene legges til i rangert rekkefølge">';
    var steg = niceStep((ymax - ymin) / 5);
    for (var v = Math.ceil(ymin / steg) * steg; v <= ymax; v += steg) s += '<line class="vv-grid" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (ml - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + esc(mill(v).replace(' kr', '')) + '</text>';
    s += '<text x="' + ml + '" y="12" class="vv-label--muted">Samlet netto kostnad (kr)</text>';
    s += '<line class="vv-axis" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    s += '<line class="vv-ref" stroke-dasharray="6 4" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(ramme) + '" y2="' + Y(ramme) + '"/><text x="' + (W - mr) + '" y="' + (Y(ramme) - 6) + '" text-anchor="end" class="vv-label--muted">Ramme ' + esc(mill(ramme)) + '</text>';
    s += '<polyline class="vv-line vv-stroke-focus" points="' + pts.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' ') + '"/>';
    pts.slice(1).forEach(function (p, i) {
      var t = P.tiltak.find(function (q) { return q.id === p[2].id; });
      s += '<circle class="bar-hit vv-fill-focus" cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="5" stroke="#fff" stroke-width="2" data-tip="<strong>' + (i + 1) + '. ' + esc(t.navn) + '</strong>Samlet ' + esc(mill(p[1])) + '<br>Samlet ' + esc(tonn(p[0])) + ' tonn"/>';
    });
    s += '<text x="' + ml + '" y="' + (H - 8) + '">0</text><text x="' + (W - mr) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(tonn(acc)) + ' tonn CO2e kuttet over levetiden</text>';
    return s + '</svg>';
  }

  // ---------- Bibliotek og tall ----------
  function visBibliotek() {
    var pp = parametre();
    var h = sideTopp('Bibliotek og tall', 'Felles tall og tiltaksmaler. Kommunen kan erstatte et felles tall med sitt eget, men må alltid oppgi kilde og årstall.');
    h += '<div class="section"><h2>Felles tall</h2><div class="vv-table-wrap"><table class="vv-table"><thead><tr><th>Tall</th><th class="vv-num">Felles verdi</th><th>Kilde</th><th>Kommunens tall</th></tr></thead><tbody>';
    Object.keys(BIB.parametre).forEach(function (k) {
      var b = BIB.parametre[k], egen = P.parametre[k] || {};
      h += '<tr><th scope="row">' + esc(b.navn) + '<div class="muted">' + esc(b.enhet) + '</div></th><td class="vv-num">' + (b.v === null ? '<span class="vv-badge vv-badge--negative">Mangler</span>' : esc(minus(nf2.format(b.v)))) + '</td><td class="small">' + esc(b.kilde || b.hjelp) + '</td>' +
        '<td style="min-width:300px"><div class="src" style="display:grid;grid-template-columns:100px 1fr 84px;gap:6px">' +
        '<input class="small-in" type="number" step="any" aria-label="Kommunens verdi for ' + esc(b.navn) + '" data-param="' + k + '" data-del="v" value="' + esc(egen.v !== undefined && egen.v !== null ? egen.v : '') + '">' +
        '<input class="small-in" type="text" aria-label="Kilde" placeholder="Kilde (påkrevd)" data-param="' + k + '" data-del="kilde" value="' + esc(egen.kilde || '') + '">' +
        '<input class="small-in" type="number" aria-label="Årstall" placeholder="År" data-param="' + k + '" data-del="aar" value="' + esc(egen.aar || '') + '"></div>' +
        (egen.v !== undefined && egen.v !== null && egen.v !== '' && !egen.kilde ? '<div class="err" style="color:var(--negative-600);font-size:13px;font-weight:600">Skriv kilden for å bruke tallet.</div>' : '') + '</td></tr>';
    });
    h += '</tbody></table></div><p class="vv-table__source">Felles tall uten verdi må legges inn av kommunen før tiltak som bruker dem kan regnes ut.</p></div>';
    h += '<div class="section"><h2>Tiltaksmaler</h2><div class="vv-table-wrap"><table class="vv-table"><thead><tr><th>Mal</th><th>Modell</th><th>Kode</th><th>Nasjonalt anslag</th><th></th></tr></thead><tbody>' +
      maler().map(function (m) { return '<tr><th scope="row">' + esc(m.navn) + (m.egen ? ' <span class="vv-badge vv-badge--info">Kommunens mal</span>' : '') + '<div class="muted">' + esc(m.beskrivelse || '') + '</div></th><td>' + esc(C.MODELLER[m.modell].navn) + '</td><td>' + esc(m.kode || '') + '</td><td class="small">' + esc(m.nasjonal ? m.nasjonal.tekst : '') + '</td><td><button class="vv-btn vv-btn--ghost" data-kopier-mal="' + esc(m.id) + '">Lag egen kopi</button>' + (m.egen ? '<button class="vv-btn vv-btn--ghost" data-slett-mal="' + esc(m.id) + '">Slett</button>' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small mt-4">En egen kopi bruker kommunens egne tall fra et tiltak som standard. Lag kopien fra tiltaket under Tiltak, eller kopier en mal her og fyll inn tall i tiltakene som bruker den.</p></div>';
    h += '<div class="section"><h2>Del tall med andre kommuner</h2><div class="prose"><p>Tall og maler som kommunen har lagt inn, kan sendes til forvalteren av det felles biblioteket. Etter kontroll blir de standard for alle.</p></div><button class="vv-btn vv-btn--secondary" data-act="bidrag">Last ned kommunens tall og maler (JSON)</button></div>';
    return h;
  }

  // ---------- Innstillinger ----------
  function visInnstillinger() {
    var s = P.innstillinger;
    var h = sideTopp('Innstillinger', 'Kommunens mål og rammer. Renten og strømfaktoren endres under Bibliotek og tall.');
    h += '<div class="card"><div class="form-grid">' +
      '<div><label for="i-k">Kommune</label><input id="i-k" type="text" data-prosj="kommune" value="' + esc(P.kommune) + '"></div>' +
      '<div><label for="i-a">Målår</label><input id="i-a" type="number" data-innst="maalaar" value="' + esc(s.maalaar) + '"></div>' +
      '<div><label for="i-m">Kutt som trengs i målåret (tonn CO2e per år)</label><input id="i-m" type="number" data-innst="maalTonnPerAar" value="' + esc(s.maalTonnPerAar || '') + '"></div>' +
      '<div><label for="i-b">Ramme for netto kostnad (kr)</label><input id="i-b" type="number" data-innst="budsjett" value="' + esc(s.budsjett || '') + '"></div>' +
      '</div><p class="muted mt-4">Kostnadsgruppene bruker Miljødirektoratets grenser: 500 og 1 500 kr/tonn.</p></div>';
    h += '<div class="section"><h2>Lagre og dele</h2><div class="prose"><p>Prosjektet lagres automatisk i denne nettleseren. Last ned en fil for å ta vare på det eller dele det med kolleger.</p></div><div class="row">' +
      '<button class="vv-btn vv-btn--primary" data-act="eksport">Last ned prosjektet</button>' +
      '<label class="vv-btn vv-btn--secondary" for="fil-inn">Åpne prosjektfil</label><input id="fil-inn" type="file" accept=".json,application/json" class="sr-only" data-act-fil="prosjekt">' +
      '<button class="vv-btn vv-btn--secondary" data-act="import">Lim inn klimabudsjett</button>' +
      '<button class="vv-btn vv-btn--ghost" data-act="eksempel">Vis eksempelprosjekt</button>' +
      '<button class="vv-btn vv-btn--ghost" data-act="nytt">Start tomt prosjekt</button></div></div>';
    return h;
  }

  // ---------- Metode ----------
  function visMetode() {
    var h = sideTopp('Metode', 'Verktøyet følger Miljødirektoratets metodikk for tiltakskostnader (M-1084), slik at tallene kan sammenlignes med tiltaksarkene i Klimatiltak i Norge.');
    h += '<div class="prose">' +
      '<h2 class="h-lg">Tiltakskostnad</h2><p>Tiltakskostnaden er nåverdien av kostnadene over tiltakets levetid, delt på summen av tonn CO2e som kuttes. Kronene diskonteres, tonnene gjør ikke det. Kort sagt: «Tiltaket koster X kroner og kutter Y tonn.»</p>' +
      '<p><strong>Diskontering</strong> betyr at en krone i dag er mer verdt enn en krone om ti år. Verktøyet bruker 4 % rente de første 40 årene, deretter 3 % og 2 % (Finansdepartementets R-109). Du trenger ikke regne med dette selv.</p>' +
      '<h2 class="h-lg">Tre trinn</h2><p><strong>Brutto</strong> er investering og drift. <strong>Netto for kommunen</strong> trekker fra det kommunen sparer på energi, materiell og vedlikehold, og statlige tilskudd. Dette er hovedtallet. <strong>Samfunnsøkonomisk</strong> tar ut tilskudd og avgifter og legger til helsegevinster og gevinster for innbyggerne.</p>' +
      '<h2 class="h-lg">Kostnadsgrupper</h2><p>Lønnsomme (under 0), lav (0–500), middels (500–1 500) og høy kostnad (over 1 500 kr/tonn). Grensene er Miljødirektoratets. Tallene vises avrundet til nærmeste 100 under 1 000 kr/tonn og nærmeste 500 over.</p>' +
      '<h2 class="h-lg">Usikkerhet</h2><p>Hvert tiltak har et spenn. Når kommunen ikke har egne anslag, brukes ±30 % på kostnader og kutt, som Miljødirektoratet anbefaler.</p>' +
      '<h2 class="h-lg">Hva rangeringen ikke sier</h2><p>Billig per tonn er ikke det samme som stort kutt. Tiltak som gjør andre tiltak mulige, eller som gir langsiktig omstilling, kan være verdt mer enn plassen i listen tilsier.</p>' +
      '<h2 class="h-lg">Kilder</h2><p>Miljødirektoratet: Metodikk for tiltaksanalyser (M-1084) og Klimatiltak i Norge 2026. Helsedirektoratet (2025): helsegevinst per kilometer gange og sykling. EBA og co2pilot: Veileder for klimagassreduksjoner, formålsbygg (2026). Oslo kommune: Klimabudsjett 2024.</p>' +
      '</div>';
    return h;
  }

  // ---------- Dialoger ----------
  function dialogImport() {
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dialog__box"><h2 id="dlg-t" class="h-lg">Lim inn klimabudsjett</h2>' +
      '<div class="prose"><p>Kopier tabellen fra Excel eller Word og lim den inn her. Første rad må være overskrifter. Verktøyet kjenner igjen kolonnene <strong>Sektor, Tiltak, Ansvarlig, Status, Effekt</strong> (tonn CO2e) og <strong>Bevilgning</strong> (kr per år).</p><p class="small">Tekst som «Ikke beregnet» eller «Tilretteleggende» i effektkolonnen blir tatt med som tiltak uten rangering.</p></div>' +
      '<label for="imp" class="lbl">Tabell</label><textarea id="imp" placeholder="Sektor&#9;Tiltak&#9;Ansvarlig&#9;Effekt 2027 (tonn CO2e)"></textarea>' +
      '<div class="row mt-4"><label class="vv-btn vv-btn--ghost" for="csv-inn">Eller velg en CSV-fil</label><input id="csv-inn" type="file" accept=".csv,.txt,text/csv" class="sr-only" data-act-fil="csv"></div>' +
      '<div id="imp-forhand" class="mt-4"></div>' +
      '<div class="row mt-6"><button class="vv-btn vv-btn--primary" data-act="import-ok">Importer</button><button class="vv-btn vv-btn--secondary" data-act="lukk">Avbryt</button></div></div></div>';
  }
  function dialogNytt() {
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-n"><div class="dialog__box"><h2 id="dlg-n" class="h-lg">Velg tiltaksmal</h2><p class="prose">Malen bestemmer hvilke tall skjemaet spør etter. Velg «Egendefinert» hvis kuttet er regnet ut et annet sted.</p><div class="vv-table-wrap"><table class="vv-table"><tbody>' +
      maler().map(function (m) { return '<tr><th scope="row"><button class="linkbtn" data-ny-mal="' + esc(m.id) + '">' + esc(m.navn) + '</button><div class="muted">' + esc(m.beskrivelse || '') + '</div></th><td>' + esc(m.kode || '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="row mt-6"><button class="vv-btn vv-btn--secondary" data-act="lukk">Avbryt</button></div></div></div>';
  }
  function dialogKort(res) {
    var i = P.tiltak.findIndex(function (t) { return t.id === state.valgt; }); if (i < 0) return '';
    var t = P.tiltak[i], r = res[i], mal = finnMal(t.mal);
    var kilder = {}; Object.keys(r.verdier || {}).forEach(function (k) { var o = r.verdier[k]; if (o.v !== null && o.kilde) kilder[o.kilde] = 1; });
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-k"><div class="dialog__box tiltakskort"><p class="vv-kpi__label">Tiltakskort · ' + esc(P.kommune || '') + '</p><h2 id="dlg-k" class="h-lg" style="font-size:28px;line-height:36px">' + esc(t.navn) + '</h2>' +
      '<p class="muted">' + esc(t.ansvarlig || '') + ' · ' + esc(t.status || '') + ' · ' + esc(mal.navn) + (mal.kode ? ' (' + esc(mal.kode) + ')' : '') + '</p>' +
      resultatPanel(t, r, mal) +
      '<div class="mt-4"><p class="h-sm">Om tiltaket</p><p class="small">' + esc(mal.beskrivelse || '') + (mal.husk ? ' ' + esc(mal.husk) : '') + '</p><p class="h-sm">Hvem betaler og hvem får gevinsten</p><p class="small">Kommunen betaler ' + mill(r.komponenter ? r.komponenter.investering : 0) + ' i investering. ' + (r.komponenter && r.komponenter.samfunnsgevinsterNv ? 'Innbyggerne får gevinster verdt ' + mill(r.komponenter.samfunnsgevinsterNv) + ' (nåverdi).' : 'Gevinster for innbyggerne er ikke verdsatt.') + '</p>' +
      '<p class="h-sm">Kilder</p><p class="small">' + (Object.keys(kilder).map(esc).join('; ') || 'Ingen kilder oppgitt.') + '</p></div>' +
      '<div class="row mt-6 no-print"><button class="vv-btn vv-btn--primary" data-act="skriv">Skriv ut</button><button class="vv-btn vv-btn--secondary" data-act="lukk">Lukk</button></div></div></div>';
  }

  // ---------- Import av klimabudsjett ----------
  function parseTabell(tekst) {
    var linjer = tekst.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!linjer.length) return [];
    var sep = linjer[0].indexOf('\t') >= 0 ? '\t' : (linjer[0].split(';').length > linjer[0].split(',').length ? ';' : ',');
    var split = function (l) {
      if (sep === '\t') return l.split('\t');
      var ut = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === '"') q = !q; else if (c === sep && !q) { ut.push(cur); cur = ''; } else cur += c; }
      ut.push(cur); return ut;
    };
    var hode = split(linjer[0]).map(function (h) { return h.trim().toLowerCase(); });
    var finn = function (re) { return hode.findIndex(function (h) { return re.test(h); }); };
    var ix = { sektor: finn(/sektor/), tiltak: finn(/tiltak|virkemid/), ansvarlig: finn(/ansvar/), status: finn(/status/), bevilgning: finn(/bevilg|kostnad|budsjett/), omfang: finn(/direkte|indirekte|omfang/) };
    var effektKol = []; hode.forEach(function (h, i) { if (/effekt|tonn|co2/.test(h)) effektKol.push(i); });
    return linjer.slice(1).map(function (l) {
      var c = split(l).map(function (x) { return x.trim(); });
      var g = function (k) { return ix[k] >= 0 ? c[ix[k]] || '' : ''; };
      var effekt = null, tekstEffekt = '';
      for (var k = effektKol.length - 1; k >= 0; k--) {
        var raw = c[effektKol[k]] || ''; var tall = parseFloat(raw.replace(/\s/g, '').replace(/−/g, '-').replace(',', '.'));
        if (!isNaN(tall)) { effekt = Math.abs(tall); break; } else if (raw) tekstEffekt = raw;
      }
      var bev = parseFloat(g('bevilgning').replace(/\s/g, '').replace(',', '.'));
      var et = effekt !== null ? 'beregnet' : (/tilrettel/i.test(tekstEffekt) ? 'tilretteleggende' : 'ikke-beregnet');
      return { navn: g('tiltak'), sektor: g('sektor'), ansvarlig: g('ansvarlig'), status: /vedtatt/i.test(g('status')) ? 'vedtatt' : (g('status') ? 'foreslått' : 'vedtatt'), effekt: effekt, effekttype: et, bevilgning: isNaN(bev) ? null : bev, omfang: /indirekte/i.test(g('omfang')) ? 'indirekte' : 'direkte' };
    }).filter(function (r) { return r.navn; });
  }
  function importer(rader) {
    var K = 'Fra kommunens klimabudsjett';
    rader.forEach(function (r) {
      var v = {};
      if (r.effekt !== null) v.tonnPerAar = { v: r.effekt, kilde: K, kvalitet: 'C' };
      if (r.bevilgning !== null) v.drift = { v: r.bevilgning, kilde: K + ' (bevilgning per år, tolket som årlig kostnad – sjekk)', kvalitet: 'C' };
      P.tiltak.push({ id: uid(), mal: 'egendefinert', navn: r.navn, sektor: r.sektor, ansvarlig: r.ansvarlig, status: r.status, effekttype: r.effekttype, omfang: r.omfang, verdier: v });
    });
    if (P.eksempel) P.eksempel = false;
  }
  function forhandsvis() {
    var ta = document.getElementById('imp'), box = document.getElementById('imp-forhand');
    if (!ta || !box) return;
    var rader = parseTabell(ta.value);
    box.innerHTML = rader.length ? '<p class="small"><strong>' + rader.length + ' tiltak funnet.</strong> Effekten tolkes som tonn per år. Levetid og kostnader fyller du inn etterpå.</p><div class="vv-table-wrap"><table class="vv-table"><thead><tr><th>Tiltak</th><th>Sektor</th><th class="vv-num">Effekt (tonn/år)</th><th>Type</th></tr></thead><tbody>' +
      rader.slice(0, 8).map(function (r) { return '<tr><td>' + esc(r.navn) + '</td><td>' + esc(r.sektor) + '</td><td class="vv-num">' + (r.effekt === null ? '–' : n1(r.effekt)) + '</td><td>' + esc(C.EFFEKTTYPER[r.effekttype]) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (rader.length > 8 ? '<p class="muted">… og ' + (rader.length - 8) + ' til.</p>' : '') : '';
  }

  // ---------- Nedlasting ----------
  function lastNed(navn, innhold, type) {
    state.fil = { navn: navn, innhold: innhold, type: type };
    state.dialog = dialogFil; render();
  }
  function dialogFil() {
    var f = state.fil;
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-f"><div class="dialog__box"><h2 id="dlg-f" class="h-lg">' + esc(f.navn) + '</h2>' +
      '<p class="prose">Last ned filen, eller kopier innholdet og lim det inn i et regneark eller en tekstfil.</p>' +
      '<label for="fil-innhold" class="lbl">Innhold</label><textarea id="fil-innhold" readonly>' + esc(f.innhold.replace(/^\ufeff/, '')) + '</textarea>' +
      '<p id="fil-status" class="small" role="status"></p>' +
      '<div class="row mt-4"><button class="vv-btn vv-btn--primary" data-act="fil-last">Last ned fil</button><button class="vv-btn vv-btn--secondary" data-act="fil-kopier">Kopier</button><button class="vv-btn vv-btn--ghost" data-act="lukk">Lukk</button></div></div></div>';
  }
  function bekreft(tekst, knapp, ok) {
    state.bekreft = { tekst: tekst, knapp: knapp, ok: ok };
    state.dialog = function () {
      return '<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-b"><div class="dialog__box" style="max-width:560px"><h2 id="dlg-b" class="h-md">Er du sikker?</h2><p>' + esc(state.bekreft.tekst) + '</p><div class="row mt-6"><button class="vv-btn vv-btn--primary" data-act="bekreft-ok">' + esc(state.bekreft.knapp) + '</button><button class="vv-btn vv-btn--secondary" data-act="lukk">Avbryt</button></div></div></div>';
    };
    render();
  }
  function melding(tekst) {
    state.dialog = function () { return '<div class="dialog" role="alertdialog" aria-modal="true"><div class="dialog__box" style="max-width:560px"><p>' + esc(tekst) + '</p><div class="row mt-4"><button class="vv-btn vv-btn--primary" data-act="lukk">OK</button></div></div></div>'; };
    render();
  }
  function csv() {
    var res = beregn(), rangert = C.rangering(res);
    var rows = [['Nr', 'Tiltak', 'Ansvarlig', 'Status', 'Gruppe', 'Kr per tonn (kommunen)', 'Spenn lav', 'Spenn høy', 'Kr per tonn (samfunnsøkonomisk)', 'Tonn over levetiden', 'Netto kostnad (nåverdi, kr)', 'Datakvalitet']];
    rangert.forEach(function (r, i) {
      var t = P.tiltak.find(function (q) { return q.id === r.id; });
      rows.push([i + 1, t.navn, t.ansvarlig || '', t.status || '', KAT[r.kategori].navn, Math.round(r.kpt.kommune), Math.round(r.spenn.lav), Math.round(r.spenn.hoy), Math.round(r.kpt.samfunn), r.tonnTotalt.toFixed(1).replace('.', ','), Math.round(r.nv.kommune), r.datakvalitet]);
    });
    return '﻿' + rows.map(function (r) { return r.map(function (c) { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\n');
  }

  // ---------- Hendelser ----------
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-nav],[data-act],[data-velg],[data-fig],[data-ny-mal],[data-kopier-mal],[data-slett-mal]');
    if (!el) return;
    if (el.dataset.nav) { e.preventDefault(); state.visning = el.dataset.nav; state.valgt = null; state.dialog = null; render(); window.scrollTo(0, 0); return; }
    if (el.dataset.velg) { state.visning = 'tiltak'; state.valgt = el.dataset.velg; state.dialog = null; render(); window.scrollTo(0, 0); return; }
    if (el.dataset.fig) { state.figurTabell[el.dataset.fig] = el.dataset.vis === 'tabell'; render(); return; }
    if (el.dataset.nyMal) {
      var m = finnMal(el.dataset.nyMal), id = uid();
      P.tiltak.push({ id: id, mal: m.id, navn: m.navn, status: 'foreslått', effekttype: 'beregnet', verdier: {} });
      if (P.eksempel) P.eksempel = false;
      lagre(); state.dialog = null; state.visning = 'tiltak'; state.valgt = id; render(); window.scrollTo(0, 0); return;
    }
    if (el.dataset.kopierMal) {
      var src = finnMal(el.dataset.kopierMal), ny = kopi(src);
      ny.id = 'egen-' + uid(); ny.navn = src.navn + ' (kommunens kopi)'; ny.egen = true; ny.nasjonal = src.nasjonal;
      P.egneMaler = P.egneMaler || []; P.egneMaler.push(ny); lagre(); render(); return;
    }
    if (el.dataset.slettMal) { P.egneMaler = (P.egneMaler || []).filter(function (m) { return m.id !== el.dataset.slettMal; }); lagre(); render(); return; }
    var a = el.dataset.act;
    if (a === 'import') { state.dialog = dialogImport; render(); var ta = document.getElementById('imp'); if (ta) ta.focus(); }
    else if (a === 'nytt-tiltak') { state.dialog = dialogNytt; render(); }
    else if (a === 'lukk') { state.dialog = null; render(); }
    else if (a === 'import-ok') { var rader = parseTabell((document.getElementById('imp') || {}).value || ''); if (rader.length) { importer(rader); lagre(); } state.dialog = null; state.visning = 'tiltak'; state.valgt = null; render(); }
    else if (a === 'tilbake') { state.valgt = null; render(); }
    else if (a === 'slett') { bekreft('Tiltaket slettes fra prosjektet. Det kan ikke angres.', 'Slett tiltaket', function () { P.tiltak = P.tiltak.filter(function (t) { return t.id !== state.valgt; }); state.valgt = null; lagre(); }); }
    else if (a === 'bekreft-ok') { var ok = state.bekreft && state.bekreft.ok; state.dialog = null; state.bekreft = null; if (ok) ok(); render(); window.scrollTo(0, 0); }
    else if (a === 'fil-last' && nedlaster) {
      var stt = document.getElementById('fil-status');
      nedlaster.save({ filename: state.fil.navn, data: state.fil.innhold }).then(function () { if (stt) stt.textContent = 'Filen er lagret.'; }, function (err) {
        if (stt) stt.textContent = err && err.code === 'declined' ? 'Nedlastingen ble avbrutt.' : 'Filen kunne ikke lastes ned her. Bruk Kopier i stedet.';
      });
    }
    else if (a === 'fil-last') {
      try { var aa = document.createElement('a'); aa.href = URL.createObjectURL(new Blob([state.fil.innhold], { type: state.fil.type })); aa.download = state.fil.navn; document.body.appendChild(aa); aa.click(); setTimeout(function () { aa.remove(); }, 500); } catch (err) { /* nedlasting ikke tillatt */ }
      var st = document.getElementById('fil-status'); if (st) st.textContent = 'Fikk du ikke filen? Bruk Kopier i stedet.';
    }
    else if (a === 'fil-kopier') {
      var ta2 = document.getElementById('fil-innhold'), st2 = document.getElementById('fil-status');
      var ferdig = function () { if (st2) st2.textContent = 'Kopiert.'; };
      try { navigator.clipboard.writeText(state.fil.innhold.replace(/^\ufeff/, '')).then(ferdig, function () { ta2.select(); if (st2) st2.textContent = 'Merket. Trykk Ctrl+C eller Cmd+C for å kopiere.'; }); } catch (err) { ta2.select(); if (st2) st2.textContent = 'Merket. Trykk Ctrl+C eller Cmd+C for å kopiere.'; }
    }
    else if (a === 'kort') { state.dialog = dialogKort; render(); }
    else if (a === 'skriv') { try { window.print(); } catch (err) { /* utskrift ikke tillatt */ } }
    else if (a === 'csv') { lastNed('rangering.csv', csv(), 'text/csv;charset=utf-8'); }
    else if (a === 'eksport') { lastNed((P.kommune || 'prosjekt').replace(/\s+/g, '-').toLowerCase() + '-klimatiltak.json', JSON.stringify(P, null, 2), 'application/json'); }
    else if (a === 'bidrag') { lastNed('bidrag-til-felles-bibliotek.json', JSON.stringify({ kommune: P.kommune, dato: new Date().toISOString().slice(0, 10), parametre: P.parametre, maler: P.egneMaler }, null, 2), 'application/json'); }
    else if (a === 'eksempel') { var eks = function () { P = kopi(EKS); lagre(); state.visning = 'oversikt'; state.valgt = null; }; if (!P.tiltak.length) { eks(); render(); } else bekreft('Prosjektet erstattes med eksempelprosjektet. Last ned prosjektet først hvis du vil ta vare på det.', 'Vis eksempelet', eks); }
    else if (a === 'nytt') { var tomt = function () { P = tomtProsjekt(); lagre(); state.visning = 'oversikt'; state.valgt = null; }; if (!P.tiltak.length || P.eksempel) { tomt(); render(); } else bekreft('Det du har lagt inn forsvinner fra denne nettleseren. Last ned prosjektet først hvis du vil ta vare på det.', 'Start tomt prosjekt', tomt); }
  });

  app.addEventListener('input', function (e) { if (e.target.id === 'imp') forhandsvis(); });

  app.addEventListener('change', function (e) {
    var el = e.target, d = el.dataset;
    if (d.actFil) { lesFil(el, d.actFil); return; }
    if (d.meta) {
      var t = P.tiltak.find(function (q) { return q.id === state.valgt; }); if (!t) return;
      t[d.meta] = el.value; lagre(); render(); return;
    }
    if (d.felt) {
      var tt = P.tiltak.find(function (q) { return q.id === state.valgt; }); if (!tt) return;
      var key = tt.id + ':' + d.felt;
      var egen = (tt.verdier || {})[d.felt];
      var u = state.utkast[key] || { v: egen ? egen.v : '', kilde: egen ? egen.kilde : '', aar: egen ? egen.aar : '', kvalitet: egen ? egen.kvalitet : 'A' };
      u[d.del] = d.del === 'v' || d.del === 'aar' ? (el.value === '' ? '' : +el.value) : el.value;
      tt.verdier = tt.verdier || {};
      if (u.v === '' || u.v === null) { delete tt.verdier[d.felt]; delete state.utkast[key]; }
      else if (u.kilde) { tt.verdier[d.felt] = { v: u.v, kilde: u.kilde, aar: u.aar || null, kvalitet: u.kvalitet || 'A' }; delete state.utkast[key]; }
      else { state.utkast[key] = u; }
      lagre(); render(); fokus(d.felt, u.v !== '' && !u.kilde ? 'kilde' : d.del); return;
    }
    if (d.param) {
      P.parametre[d.param] = P.parametre[d.param] || {};
      var p = P.parametre[d.param];
      p[d.del] = d.del === 'kilde' ? el.value : (el.value === '' ? null : +el.value);
      if (p.v === null || p.v === undefined) delete P.parametre[d.param];
      else if (!p.kilde) { /* lagres, men brukes ikke før kilden er skrevet */ }
      lagre(); render(); return;
    }
    if (d.innst) { P.innstillinger[d.innst] = el.value === '' ? null : +el.value; lagre(); render(); return; }
    if (d.prosj) { P[d.prosj] = el.value; lagre(); render(); return; }
  });
  function fokus(felt, del) { var f = app.querySelector('[data-felt="' + felt + '"][data-del="' + del + '"]'); if (f) f.focus(); }

  function lesFil(input, type) {
    var f = input.files && input.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      if (type === 'prosjekt') {
        try { var p = JSON.parse(r.result); if (!p || !Array.isArray(p.tiltak)) throw new Error('feil'); P = p; P.innstillinger = P.innstillinger || tomtProsjekt().innstillinger; P.parametre = P.parametre || {}; lagre(); state.visning = 'oversikt'; render(); }
        catch (err) { melding('Filen kunne ikke leses som et prosjekt.'); }
      } else { var ta = document.getElementById('imp'); if (ta) { ta.value = r.result; forhandsvis(); } }
    };
    r.readAsText(f, 'utf-8');
  }

  // Parametre uten kilde skal ikke brukes: filtreres i parametre()
  var _parametre = parametre;
  parametre = function () {
    var p = _parametre();
    Object.keys(P.parametre || {}).forEach(function (k) { var o = P.parametre[k]; if (o && !C.erTom(o) && !o.kilde) p[k] = BIB.parametre[k]; });
    return p;
  };

  // Verktøytips og fokus ved pekerhover
  app.addEventListener('mouseover', function (e) {
    var el = e.target.closest('[data-tip]'); if (!el) return;
    tip.innerHTML = el.getAttribute('data-tip'); tip.style.display = 'block';
    if (el.hasAttribute('data-hover-focus')) { el.classList.remove('vv-fill-context'); el.classList.add('vv-fill-focus'); }
  });
  app.addEventListener('mousemove', function (e) {
    if (tip.style.display !== 'block') return;
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + 290 > window.innerWidth) x = e.clientX - 294;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  app.addEventListener('mouseout', function (e) {
    var el = e.target.closest('[data-tip]'); if (!el) return;
    tip.style.display = 'none';
    if (el.hasAttribute('data-hover-focus')) { el.classList.add('vv-fill-context'); el.classList.remove('vv-fill-focus'); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.dialog) { state.dialog = null; render(); } });

  // Nedlasting i Claude-forhåndsvisning (vanlig nedlasting brukes ellers, f.eks. på GitHub Pages)
  var nedlaster = null;
  try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then(function (d) { nedlaster = d; }, function () {}); } catch (e) { /* ikke i Claude */ }

  render();
})();
