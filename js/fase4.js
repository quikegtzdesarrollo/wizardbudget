/* fase4.js – Inflación, crecimiento, Plantilla 4 (actividades), límite indexado y montos autorizados por actividad.
   El monto autorizado se ajusta ACTIVIDAD por actividad (inicia con el importe de la Plantilla 4, campo `ap` de cada actividad).
   El monto aprobado del DEPARTAMENTO es la suma de los montos autorizados de sus actividades y no se edita. */
let f4Abiertos = new Set();   // índices de departamentos con el panel de actividades abierto (se conserva entre renders)
const apAct = a => a.ap == null ? num(a.importe) : num(a.ap);     // monto autorizado de una actividad (por defecto, su importe)
function toggleF4(i, abierto) { abierto ? f4Abiertos.add(i) : f4Abiertos.delete(i); }
async function cargarP4(e) {
  try {
    const filas = await leerExcel(e.target.files[0], 'p4');
    const ajustadas = S.f4.acts.filter(a => a.ap != null && num(a.ap) !== num(a.importe)).length;
    if (ajustadas && !confirm(`Hay ${ajustadas} actividad(es) con monto autorizado ajustado a mano.\n\nAl cargar la Plantilla 4 se reemplazan todas las actividades y esos ajustes se pierden. ¿Continuar?`)) return render();
    S.f4.acts = filas;
  } catch (x) { alert(x.message); }
  render();
}
function calc4() {
  const rows = calc3().map(d => {
    const A = S.f4.acts.map((a, i) => ({ a, i })).filter(x => norm(x.a.departamento) === norm(d.nombre));   // actividades del departamento (con su índice)
    const est = sum(A, x => num(x.a.importe)), ap = sum(A, x => apAct(x.a)), lim = d.sf * (1 + S.f4.infl / 100);   // Límite indexado = Saldo final N-1 × (1+infl)
    return { ...d, est, lim, ap, acts: A, com: S.f4.ap[d.id]?.c || '', rojo: est > lim };
  });
  const tot = sum(rows, r => r.ap);
  return rows.map(r => ({ ...r, pctN: tot ? r.ap / tot * 100 : 0, tot }));   // Cierre: recalcula % sobre el total aprobado
}
function f4() {
  const R = calc4(), huerf = [...new Set(S.f4.acts.map(a => a.departamento))].filter(n => !S.f3.deps.some(d => norm(d.nombre) === norm(n)));
  const cfg = `<div class="grid sm:grid-cols-2 gap-4"><div class="p-4 border rounded-xl"><label class="text-sm font-semibold">% Inflación (default 5.00)</label><div class="mt-1">${inp('f4.infl', S.f4.infl, 'w-28')}</div></div>
    <div class="p-4 border rounded-xl"><label class="text-sm font-semibold">% Crecimiento proyectado de Ofrenda</label><div class="mt-1">${inp('f4.crec', S.f4.crec, 'w-28')}</div></div></div>`;
  const rows = R.map((r, i) => {
    const filasAct = r.acts.map(x => `<tr class="border-t border-slate-100"><td class="px-3 py-1.5 text-left">${esc(String(x.a.actividad || '').trim() || '(sin descripción)')}</td>${td(money(num(x.a.importe)), 'text-slate-500')}
      <td class="px-3 text-right">${inp(`f4.acts.${x.i}.ap`, apAct(x.a), 'w-28')}</td></tr>`).join('');
    const detalle = `<tr class="${r.rojo ? 'bg-red-50' : ''}"><td colspan="6" class="px-3 pb-2 pt-0"><details ${f4Abiertos.has(i) ? 'open' : ''} ontoggle="toggleF4(${i}, this.open)">
      <summary class="cursor-pointer select-none text-xs font-semibold text-sda-900 py-1">Actividades (${r.acts.length}) · monto autorizado ${money(r.ap)}</summary>
      ${r.acts.length ? `<table class="min-w-full text-xs mt-1"><thead class="text-slate-500"><tr><th class="px-3 py-1 text-left">Actividad</th><th class="px-3 py-1 text-right">Importe Plantilla 4</th><th class="px-3 py-1 text-right">Monto autorizado</th></tr></thead>
        <tbody>${filasAct}</tbody><tfoot><tr class="font-bold border-t border-slate-200"><td class="px-3 py-1.5 text-left">Total del departamento</td>${td(money(r.est), 'text-slate-500')}${td(money(r.ap))}</tr></tfoot></table>`
        : '<p class="px-3 py-2 text-xs text-slate-500">Este departamento no tiene actividades. Cárgalas en la Plantilla 4.</p>'}</details></td></tr>`;
    return `<tr class="${r.rojo ? 'bg-red-50' : ''}"><td class="px-3 py-2 font-medium ${r.rojo ? 'text-red-700' : ''}">${esc(r.nombre)}${r.rojo ? ' 🔴' : ''}</td>${td(money(r.est))}${td(money(r.lim))}
      ${td(money(r.ap), 'font-bold')}<td class="px-3">${inp(`f4.ap.${r.id}.c`, r.com, 'w-48 text-left', 1)}</td>${td(pc(r.pctN), 'font-semibold')}</tr>` + detalle;
  }).join('');
  return cfg + zona('p4', 'cargarP4', S.f4.acts.length && S.f4.acts.length + ' actividades', 'Plantilla 4 · Actividades por departamento') +
    (!R.length ? alerta(false, 'Aún no hay departamentos: cárgalos primero en la Fase 3.') : '') + (huerf.length ? alerta(false, 'Departamentos del archivo que no están en la Fase 3: ' + huerf.map(esc).join(', ')) : '') +
    `<p class="text-xs text-slate-600">Abre las <strong>Actividades</strong> de cada departamento para ajustar el monto autorizado actividad por actividad. El <strong>monto aprobado</strong> del departamento es la suma de sus actividades y no se edita.</p>` +
    tabla(['Departamento', 'Gasto estimado (Σ actividades)', 'Límite indexado N', 'Monto aprobado (Σ autorizado)', 'Comentario', '% nuevo'], rows,
      `<tr><td class="px-3 py-2">TOTAL</td>${td(money(sum(R, r => r.est)))}${td('')}${td(money(sum(R, r => r.ap)))}${td('')}${td('100.00%')}</tr>`) +
    `<p class="text-xs text-slate-500">En rojo: gasto estimado mayor al límite indexado. Se muestra como alerta (pendiente confirmar si se sustituye por la regla de la Proyección).</p>`;
}
