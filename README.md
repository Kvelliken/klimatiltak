# Klimatiltak og kostnad

Et åpent verktøy for kommuner som vil finne de mest kostnadseffektive klimatiltakene i klimabudsjettet. Kommunen legger inn tiltakene sine og får ut kostnad per tonn CO2e, med indirekte effekter på energi, materiell, vedlikehold og helse. Til slutt får kommunen en prioritert liste over hva som gir mest klima for pengene.

**Status:** prototype, versjon 0.1.0 (18. november 2026). Tallene i eksempelprosjektet er oppdiktet.

## Bruk

Åpne `index.html` i en nettleser, eller publiser repoet på GitHub Pages: gå til *Settings → Pages*, velg grenen `main` og mappen `/ (root)`.

Det trengs ingen server og ingen innlogging. Alle tall lagres bare i brukerens nettleser. Prosjektet kan lastes ned som en JSON-fil og deles med kolleger.

## Metode

Verktøyet følger Miljødirektoratets *Metodikk for tiltaksanalyser* (M-1084):

```
Tiltakskostnad = nåverdi av (investering + drift − besparelser − tilskudd) / sum tonn CO2e kuttet
```

- Kronene diskonteres med 4 % de første 40 årene, deretter 3 % og 2 % (R-109). Tonnene diskonteres ikke.
- Tre trinn: brutto, netto for kommunen (hovedtallet) og samfunnsøkonomisk (uten avgifter og tilskudd, med helsegevinster).
- Kostnadsgrupper: lønnsomme (under 0), lav (0–500), middels (500–1 500) og høy (over 1 500 kr/tonn).
- Usikkerhet: ±30 % på kostnader og kutt når kommunen ikke har egne anslag.

## Tall og kilder

`src/js/bibliotek.js` er det felles tiltaksbiblioteket. Et tall står der bare hvis det har en kilde. Ellers står det som «mangler», og kommunen legger inn eget tall. Biblioteket finnes også som åpen JSON i `data/bibliotek.json`.

Tall kan legges inn på tre nivåer:

1. **I ett tiltak.** Kommunens eget tall, for eksempel fra et anbud.
2. **I kommunens bibliotek.** Kommunens egne faktorer, priser og kopier av maler.
3. **I det felles biblioteket.** Kommunen laster ned bidraget sitt fra appen og sender det inn som en pull request eller sak her. En forvalter kontrollerer det før det blir standard.

Et tall kan ikke brukes uten kilde.

## Struktur

| Fil | Innhold |
| --- | --- |
| `index.html` | Ferdig bygget app i én fil |
| `src/js/calc.js` | Beregningskjernen, uten avhengigheter |
| `src/js/bibliotek.js` | Felles tall og tiltaksmaler |
| `src/js/eksempel.js` | Eksempelprosjekt med oppdiktede tall |
| `src/js/app.js` | Brukergrensesnittet |
| `src/css/` | Designsystemet Vargvind (tokens og komponenter) og appens stiler |
| `fonts/` | Inter og Cormorant Garamond (SIL Open Font License) |
| `test/calc.test.js` | Tester mot håndregnede tall |
| `build.js` | Bygger `index.html` og `data/bibliotek.json` |

## Utvikling

```
node test/calc.test.js   # kjør testene
node build.js            # bygg index.html på nytt
```

Krever Node 18 eller nyere. Ingen pakker må installeres.

## Lisens

Koden er lisensiert under MIT-lisensen. Skriftene har egne lisenser i `fonts/`.
