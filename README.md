# Workout

Een offline webapp (PWA) voor krachttraining, als alternatief voor Strong. Gemaakt voor de iPhone, maar werkt in elke moderne browser. Alle gegevens blijven op je toestel.

## Functies

- **Workouts loggen**: sets met gewicht, herhalingen, optioneel RPE, en type set (opwarm, drop, tot falen). Je vorige prestatie staat naast elke set. Tik op gewicht of herhalingen voor grote +/−-knoppen; veeg een set naar links om hem te verwijderen (met ongedaan maken).
- **Opwarmset**: compound-oefeningen (squat, deadlift, presses, rows…) krijgen automatisch één opwarmset van ~60% × 8 die meerekent met je werkgewicht. Per oefening in te stellen (automatisch, altijd, nooit).
- **Rusttimer**: start automatisch na elke werkset, als ring met de volgende set erbij. Standaard 2:00 bij compound- en 1:30 bij isolatie-oefeningen; per oefening aan te passen tijdens de workout of in de template. In een superset is de rust kort tussen de oefeningen en langer na de laatste oefening van de ronde. Aan het eind klinkt een bel, klankschaal of ding-dong; je muziek gaat dan even zachter (Audio Session API, Safari 16.4+). De timer loopt goed door als de app even op de achtergrond staat.
- **Weergave**: licht en donker thema op basis van een eigen design system (perkament, inkt, één teal accent, Inter); volgt standaard de instelling van je iPhone.
- **Templates**: routines met aantal sets en eventueel een eigen herhalingsbereik per oefening. Je kunt ook een afgeronde workout opslaan als template, of hem herhalen.
- **Progressive overload**: bij het starten van een workout vult de app per oefening een voorstel in voor gewicht en herhalingen, met uitleg waarom (zie hieronder).
- **Geschiedenis en statistieken**: records (zwaarste gewicht, geschatte 1RM, volume), grafieken per oefening, PR's per workout en werksets per spiergroep per week.
- **Programma-import**: een trainingsprogramma als JSON-bestand (bijvoorbeeld gemaakt in Cowork) wordt een set templates, met sets, herhalingen, doel-RPE, rust per oefening, opwarmsets en supersets. Zie [Programma's importeren](#programmas-importeren).
- **Strong-import**: zowel de oude export (puntkomma, lbs/kg-kolom) als de nieuwe (`Weight (kg)`, `Duration (sec)`, regels voor de rusttimer). Opnieuw importeren is veilig.
- **Back-up**: JSON-back-up maken en terugzetten, en exporteren als CSV.
- **Werkt offline** dankzij een service worker. Staat de app op je beginscherm, dan werkt hij als een gewone app.

## Progressive overload: hoe het werkt

De engine (`src/lib/progression.ts`) past **dubbele progressie met RIR-autoregulatie** toe:

1. **Herhalingen erbij.** Elke oefening heeft een herhalingsbereik (bv. 8–12). Zolang je de bovengrens niet haalt, blijft het gewicht gelijk en is het doel per set één herhaling meer. Progressie in herhalingen levert vergelijkbare winst in spiermassa en kracht op als progressie in gewicht (Plotkin et al., 2022).
2. **Gewicht omhoog.** Haal je op alle werksets de bovengrens, en ging je niet tot falen (RPE < 9,5), dan gaat het gewicht ~2,5% (bovenlichaam) of ~5% (onderlichaam) omhoog, minimaal één gewichtsstap. Dit volgt het ACSM (2009): verhoog 2–10% zodra je 1–2 herhalingen boven het doel haalt. Het doelaantal herhalingen op het nieuwe gewicht wordt geschat met de Epley-formule.
3. **Veel te makkelijk?** Zat je 2 of meer herhalingen boven het bereik, dan rekent de engine via je geschatte 1RM terug naar een passend gewicht, met een maximum van +10%.
4. **Inspanning.** Vul je RPE in, dan houdt de engine daar rekening mee. Standaard mik je op 2 herhalingen in reserve (RIR), in te stellen van 0 tot 4 (Zourdos et al., 2016; Helms et al., 2016).
5. **Deload.** Drie sessies zonder vooruitgang op hetzelfde gewicht, of twee sessies onder de ondergrens: ~10% lichter en daarna opnieuw opbouwen.
6. **Terugkeer.** Meer dan 4 weken een oefening niet gedaan? Dan start je op ~90%.
7. **Volume.** Bij Geschiedenis zie je je werksets per spiergroep in de laatste 7 dagen, met ~10 sets per week als richtlijn (Schoenfeld et al., 2017).

Per oefening kun je bij Oefeningen → Bewerk het herhalingsbereik, de kleinste gewichtsstap en "onderlichaam" aanpassen.

### Bronnen

- American College of Sports Medicine (2009). Progression models in resistance training for healthy adults. *Med Sci Sports Exerc*, 41(3), 687–708. https://doi.org/10.1249/MSS.0b013e3181915670
- Plotkin, D. et al. (2022). Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. *PeerJ*, 10, e14142. https://doi.org/10.7717/peerj.14142
- Zourdos, M. C. et al. (2016). Novel resistance training–specific rating of perceived exertion scale measuring repetitions in reserve. *J Strength Cond Res*, 30(1), 267–275. https://doi.org/10.1519/JSC.0000000000001049
- Helms, E. R., Cronin, J., Storey, A., & Zourdos, M. C. (2016). Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. *Strength Cond J*, 38(4), 42–49. https://doi.org/10.1519/SSC.0000000000000218
- Schoenfeld, B. J., Ogborn, D., & Krieger, J. W. (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci*, 35(11), 1073–1082. https://doi.org/10.1080/02640414.2016.1210197

## Installeren op je iPhone

1. Open de app-URL in **Safari** (bij GitHub Pages is dat `https://<gebruikersnaam>.github.io/workout-app/`).
2. Tik op de deelknop en kies **Zet op beginscherm**.
3. Open de app vanaf je beginscherm.

## Je Strong-geschiedenis importeren

1. In Strong: **Profiel → tandwiel → Export Strong Data**. Bewaar het CSV-bestand in de Bestanden-app.
2. In deze app: **Instellingen → Strong CSV kiezen**.

Oefeningen met een bekende Strong-naam (bv. "Bench Press (Barbell)") worden automatisch gekoppeld. Andere oefeningen worden aangemaakt, waarbij de app spiergroep en uitrusting raadt; dat kun je later aanpassen.

> **Let op:** de gegevens staan alleen op dit toestel, in de opslag van de browser. Maak af en toe een back-up via Instellingen, vooral voordat je de app of Safari-gegevens verwijdert.

## Programma's importeren

**Instellingen → Programma (JSON) kiezen.** Je ziet eerst een voorbeeld waarin elke oefeningnaam aan een oefening uit je bibliotheek wordt gekoppeld. Klopt een koppeling niet, kies dan een andere, of laat een nieuwe oefening aanmaken. Koppel waar mogelijk aan een bestaande oefening, zodat je geschiedenis en de progressievoorstellen doorlopen. Opnieuw importeren werkt de templates van dat programma bij in plaats van ze te dupliceren.

Formaat (`schema_version: 1`):

```json
{
  "schema_version": 1,
  "program": { "name": "Mijn programma" },
  "workouts": [
    {
      "id": "dag-a",
      "name": "Dag A",
      "exercises": [
        {
          "order": 1,
          "name": "Leg Press",
          "working_sets": 3,
          "reps": { "min": 6, "max": 8 },
          "warmup_sets": { "min": 2, "max": 3 },
          "early_set_rpe": { "min": 7, "max": 7 },
          "last_set_rpe": { "min": 8, "max": 8 },
          "rest_seconds": { "min": 120, "max": 180 },
          "superset_group": null,
          "last_set_technique": null,
          "substitutions": ["Dumbbell Lunge"],
          "note": "Optionele toelichting"
        }
      ]
    }
  ]
}
```

Verplicht zijn `schema_version`, `program.name`, en per workout `name` en `exercises`, met per oefening `name`, `working_sets` en `reps`. Hoe de rest wordt gebruikt:

| Veld | In de app |
|---|---|
| `reps` | herhalingsbereik voor de progressie (dubbele progressie) |
| `early_set_rpe`, `last_set_rpe` | doel-RPE (midden van het bereik); de progressie telt alleen RPE die minstens 1 punt hoger uitvalt dan gepland als "te zwaar", zodat een geplande RPE 10 op de laatste set verhogen niet blokkeert |
| `rest_seconds` | rusttimer na een set van deze oefening (ondergrens van het bereik; met +15 s verleng je) |
| `warmup_sets` | aantal opwarmsets (ondergrens) dat bij de start wordt toegevoegd zodra er een werkgewicht bekend is |
| `superset_group` | oefeningen met hetzelfde nummer worden als superset A, B, … getoond |
| `note`, `substitutions`, `last_set_technique` | als notitie bij de oefening |

Andere velden (zoals `source`, `warmup_protocol`, `deload`) worden genegeerd. De deload-planning van een programma voert de app niet automatisch uit; de engine doet wel zelf een deload bij stagnatie.

## Ontwikkelen

```bash
npm install
npm run dev        # ontwikkelserver
npm test           # unittests (progressie-engine, Strong- en programma-import, templates)
npm run build      # productie-build in dist/
```

Stack: Vite, React, TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Lettertype Inter (OFL) via @fontsource; iconen uit Tabler Icons (MIT).

## Publiceren via GitHub Pages

De workflow `.github/workflows/deploy.yml` test en bouwt bij elke push naar `main` en publiceert de app op GitHub Pages. Eenmalig instellen: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Voor een privé-repo is GitHub Pages alleen beschikbaar met een betaald GitHub-abonnement. Maak de repo anders openbaar (je trainingsgegevens staan niet in de repo, alleen de code), of gebruik een host als Netlify of Cloudflare Pages.
