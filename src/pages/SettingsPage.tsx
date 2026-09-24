import { useEffect, useRef, useState } from 'react';
import { db, requestPersistentStorage } from '../db';
import type { Settings } from '../types';
import { NumInput } from '../components/NumInput';
import { toast } from '../components/Toast';
import { download, exportBackup, exportCsv, importStrong, restoreBackup, type Backup } from '../lib/backup';
import { REFERENCES } from '../lib/progression';

export function SettingsPage({ settings }: { settings: Settings }) {
  const strongInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const set = (p: Partial<Settings>) => db.settings.put({ ...settings, ...p });

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const onStrong = async (file: File) => {
    setBusy(true);
    try {
      const r = await importStrong(await file.text());
      toast(`${r.added} workouts geïmporteerd${r.duplicates ? `, ${r.duplicates} al aanwezig` : ''}${r.newExercises ? `, ${r.newExercises} nieuwe oefeningen` : ''}.`);
    } catch (e) {
      toast(`Import mislukt: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onBackup = async (file: File) => {
    try {
      const b = JSON.parse(await file.text()) as Backup;
      if (!confirm(`Back-up van ${b.exportedAt?.slice(0, 10)} terugzetten? Bestaande items met hetzelfde ID worden overschreven.`)) return;
      await restoreBackup(b);
      toast('Back-up teruggezet.');
    } catch (e) {
      toast(`Terugzetten mislukt: ${(e as Error).message}`);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <>
      <header className="page"><h1>Instellingen</h1></header>

      <h2>Training</h2>
      <div className="card stack">
        <div className="spread">
          <label htmlFor="rest">Rusttijd (seconden)</label>
          <div style={{ width: 90 }}><NumInput className="field" decimal={false} value={settings.restSeconds} onChange={(v) => v && set({ restSeconds: v })} /></div>
        </div>
        <div className="spread">
          <span>Geluid bij einde rust</span>
          <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
        </div>
      </div>

      <h2>Progressive overload</h2>
      <div className="card stack">
        <div className="spread">
          <span>Automatisch voorstel bij nieuwe workout</span>
          <input type="checkbox" checked={settings.progressionEnabled} onChange={(e) => set({ progressionEnabled: e.target.checked })} />
        </div>
        <div>
          <label className="lbl">Herhalingen in reserve (RIR) op werksets</label>
          <div className="chips">
            {[0, 1, 2, 3, 4].map((r) => (
              <button key={r} className={`chip ${settings.targetRir === r ? 'on' : ''}`} onClick={() => set({ targetRir: r })}>
                {r} RIR (RPE {10 - r})
              </button>
            ))}
          </div>
        </div>
        <details>
          <summary>Hoe werkt het?</summary>
          <div className="small" style={{ marginTop: 8 }}>
            <p><b>Dubbele progressie.</b> Elke oefening heeft een herhalingsbereik (bv. 8–12). Je houdt hetzelfde gewicht en probeert elke keer één herhaling meer per set. Progressie in herhalingen geeft vergelijkbare winst in spiermassa en kracht als progressie in gewicht (Plotkin et al., 2022).</p>
            <p><b>Gewicht omhoog.</b> Haal je op alle werksets de bovengrens, dan gaat het gewicht ~2,5% (bovenlichaam) of ~5% (onderlichaam) omhoog, minimaal één gewichtsstap. Het doel voor herhalingen op het nieuwe gewicht schat de app via je 1RM (ACSM, 2009: +2–10% zodra je boven het doel uitkomt). Ging het veel makkelijker, dan rekent de app via je geschatte 1RM terug (max. +10%).</p>
            <p><b>Inspanning.</b> Vul optioneel RPE in (10 = niets meer in de tank, 8 = nog 2 herhalingen over). Werksets rond 1–3 RIR geven een goede prikkel met beperkte vermoeidheid (Zourdos et al., 2016; Helms et al., 2016). Was de vorige keer RPE 9,5–10, dan verhoogt de app niet.</p>
            <p><b>Deload.</b> Drie sessies zonder vooruitgang op hetzelfde gewicht, of twee keer onder de ondergrens: ~10% lichter en opnieuw opbouwen. Na meer dan 4 weken pauze start je op ~90%.</p>
            <p><b>Volume.</b> Bij Geschiedenis zie je je werksets per spiergroep per week; ~10 of meer per week geeft meer spiergroei dan minder (Schoenfeld et al., 2017).</p>
            <p><b>Bronnen</b></p>
            <ul>
              {REFERENCES.map((r) => (
                <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.short}</a>: {r.title}. <i>{r.source}</i>.</li>
              ))}
            </ul>
          </div>
        </details>
      </div>

      <h2>Gegevens</h2>
      <div className="card stack">
        <div>
          <b>Importeren uit Strong</b>
          <p className="small muted" style={{ margin: '4px 0 8px' }}>
            In Strong: Profiel → tandwiel → <i>Export Strong Data</i>. Bewaar het CSV-bestand in Bestanden en kies het hier. Opnieuw importeren is veilig: dubbele workouts worden overgeslagen.
          </p>
          <button className="btn primary block" disabled={busy} onClick={() => strongInput.current?.click()}>{busy ? 'Bezig…' : 'Strong CSV kiezen'}</button>
          <input ref={strongInput} type="file" accept=".csv,text/csv,text/comma-separated-values" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onStrong(f); }} />
        </div>
        <div className="row">
          <button className="btn grow" onClick={async () => download(`workout-backup-${stamp}.json`, JSON.stringify(await exportBackup()), 'application/json')}>Back-up maken</button>
          <button className="btn grow" onClick={() => backupInput.current?.click()}>Back-up terugzetten</button>
          <input ref={backupInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onBackup(f); }} />
        </div>
        <button className="btn block" onClick={async () => download(`workouts-${stamp}.csv`, await exportCsv(), 'text/csv')}>Exporteren als CSV</button>
        <p className="small muted" style={{ margin: 0 }}>
          Alle gegevens staan alleen op dit toestel.{' '}
          {persisted ? 'Permanente opslag is actief.' : (
            <>Maak regelmatig een back-up. <button className="btn ghost small" onClick={async () => setPersisted(await requestPersistentStorage())}>Permanente opslag aanvragen</button></>
          )}
        </p>
      </div>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 24 }}>Workout · versie {__APP_VERSION__}</p>
    </>
  );
}
