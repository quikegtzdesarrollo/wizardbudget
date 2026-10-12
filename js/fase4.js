/* fase4.js – Inflación, crecimiento, Plantilla 4 (actividades), límite indexado y montos aprobados */
async function cargarP4(e) { try { S.f4.acts = await leerExcel(e.target.files[0], 'p4'); } catch (x) { alert(x.message); } render(); }
function setAp(id, k, v) { S.f4.ap[id] = { ...(S.f4.ap[id] || {}), [k]: k === 'v' ? num(v) : v }; render(); }
function calc4() {
  const est = n => sum(S.f4.acts.filter(a => norm(a.departamento) === norm(n)), a => num(a.importe));
  const rows = calc3().map(d => { const e = est(d.nombre), lim = d.sf * (1 + S.f4.infl / 100);   // Límite indexado = Saldo operativo N-1 × (1+infl)
    return { ...d, est: e, lim, ap: S.f4.ap[d.id]?.v ?? e, com: S.f4.ap[d.id]?.c || '', rojo: e > lim }; });
  const tot = sum(rows, r => r.ap);
  return rows.map(r => ({ ...r, pctN: tot ? r.ap / tot * 100 : 0, tot }));   // Cierre: recalcula % sobre el total aprobado
}
function f4() {
  const R = calc4(), huerf = [...new Set(S.f4.acts.map(a => a.departamento))].filter(n => !S.f3.deps.some(d => norm(d.nombre) === norm(n)));
  const cfg = `<div class="grid sm:grid-cols-2 gap-4"><div class="p-4 border rounded-xl"><label class="text-sm font-semibold">% Inflación (default 5.00)</label><div class="mt-1">${inp('f4.infl', S.f4.infl, 'w-28')}</div></div>
    <div class="p-4 border rounded-xl"><label class="text-sm font-semibold">% Crecimiento proyectado de Ofrenda</label><div class="mt-1">${inp('f4.crec', S.f4.crec, 'w-28')}</div></div></div>`;
  const rows = R.map(r => `<tr class="${r.rojo ? 'bg-red-50' : ''}"><td class="px-3 py-2 font-medium ${r.rojo ? 'text-red-700' : ''}">${esc(r.nombre)}${r.rojo ? ' 🔴' : ''}</td>${td(money(r.est))}${td(money(r.lim))}
    <td class="px-3 text-right">${inp(`f4.ap.${r.id}.v`, r.ap)}</td><td class="px-3">${inp(`f4.ap.${r.id}.c`, r.com, 'w-48 text-left', 1)}</td>${td(pc(r.pctN), 'font-semibold')}</tr>`).join('');
  return cfg + zona('p4', 'cargarP4', S.f4.acts.length && S.f4.acts.length + ' actividades', 'Plantilla 4 · Actividades por departamento') +
    (!R.length ? alerta(false, 'Aún no hay departamentos: cárgalos primero en la Fase 3.') : '') + (huerf.length ? alerta(false, 'Departamentos del archivo que no están en la Fase 3: ' + huerf.map(esc).join(', ')) : '') +
    tabla(['Departamento', 'Gasto estimado (Σ actividades)', 'Límite indexado N', 'Monto aprobado', 'Comentario', '% nuevo'], rows,
      `<tr><td class="px-3 py-2">TOTAL</td>${td(money(sum(R, r => r.est)))}${td('')}${td(money(sum(R, r => r.ap)))}${td('')}${td('100.00%')}</tr>`) +
    `<p class="text-xs text-slate-500">En rojo: gasto estimado mayor al límite indexado. Se muestra como alerta (pendiente confirmar si se sustituye por la regla de la Proyección).</p>`;
}
