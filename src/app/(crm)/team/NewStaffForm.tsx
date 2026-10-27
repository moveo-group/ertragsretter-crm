'use client';

import { useActionState, useState } from 'react';
import { createStaff, type CreateStaffState } from './actions';

type PermDef = { key: string; column: string; label: string; hint: string };
type Preset = { label: string; perms: string[] };

export function NewStaffForm({ permissions, presets }: { permissions: PermDef[]; presets: Record<string, Preset> }) {
  const [state, action, pending] = useActionState<CreateStaffState, FormData>(createStaff, {});
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(permissions.map((p) => [p.key, presets.aussendienst.perms.includes(p.key)])),
  );
  const applyPreset = (k: string) =>
    setChecked(Object.fromEntries(permissions.map((p) => [p.key, presets[k].perms.includes(p.key)])));

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {state.ok && (
        <div className="notice" role="status" style={{ background: 'var(--green-bg)', color: 'var(--green-fg)' }}>
          Konto für <strong>{state.email}</strong> angelegt. Startpasswort: <code style={{ fontSize: 15, fontWeight: 700 }}>{state.password}</code><br />
          Bitte persönlich weitergeben – es wird nur jetzt angezeigt. Unter „Mein Konto“ lässt es sich ändern.
        </div>
      )}
      {state.error && <div className="notice" role="alert" style={{ background: 'var(--red-bg)', color: 'var(--red-fg)' }}>{state.error}</div>}

      <div className="field"><label htmlFor="full_name">Name</label><input id="full_name" name="full_name" required /></div>
      <div className="field"><label htmlFor="email">E-Mail (Login)</label><input id="email" name="email" type="email" required /></div>
      <div className="field">
        <label htmlFor="role">Funktion</label>
        <select id="role" name="role" defaultValue="field">
          <option value="field">Außendienst</option><option value="office">Büro</option><option value="admin">Inhaber / Leitung</option>
        </select>
      </div>

      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend className="strong" style={{ fontSize: 13, padding: '0 6px' }}>Zugriffsrechte</legend>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="tiny" style={{ alignSelf: 'center' }}>Vorlage:</span>
          {Object.entries(presets).map(([k, p]) => (
            <button key={k} type="button" className="btn btn-sm" onClick={() => applyPreset(k)}>{p.label}</button>
          ))}
        </div>
        {permissions.map((p) => (
          <label key={p.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
            <input type="checkbox" name={p.column} checked={checked[p.key]} onChange={(e) => setChecked({ ...checked, [p.key]: e.target.checked })} style={{ marginTop: 3 }} />
            <span><span className="strong">{p.label}</span><br /><span className="tiny">{p.hint}</span></span>
          </label>
        ))}
      </fieldset>

      <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="can_work_alone" /> darf kleinere Anlagen allein anfahren</label>
      <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" name="is_drone_pilot" /> Drohnenpilot (Thermografieflüge)</label>

      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Wird angelegt …' : 'Mitarbeiter anlegen'}</button>
    </form>
  );
}
