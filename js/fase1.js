/* fase1.js – Conciliación de feligresía y UF (Plantillas 1 y 2) */
async function cargarP1(e) {
  try {
    const rows = await leerExcel(e.target.files[0], 'p1'), cod = r => String(r.categoria).trim().toUpperCase();
    const mal = rows.map((r, i) => [i + 2, cod(r)]).filter(([, c]) => !CATEGORIAS[c]);
    if (mal.length) throw new Error(`Categoría no válida en ${mal.length} fila(s). Códigos permitidos: ${Object.keys(CATEGORIAS).join(', ')}. Primer caso: fila ≈ ${mal[0][0]} = "${mal[0][1]}".`);
    S.f1.sec = rows.map(r => ({ ...r, categoria: cod(r) })); S.f1.vinc = {};
  } catch (x) { alert(x.message); }
  render();
}
async function cargarP2(e) { try { S.f1.ecl = await leerExcel(e.target.files[0], 'p2'); S.f1.vinc = {}; } catch (x) { alert(x.message); } render(); }

const usados1 = () => new Set(Object.values(S.f1.vinc).flat());
/** Fuzzy matching: % de palabras del nombre de la UF presentes en el nombre del miembro (sin acentos/mayúsculas). */
function sug(i) {
  const t = norm(S.f1.ecl[i].nombre_uf).split(/\s+/).filter(x => x.length > 2), u = usados1();
  return S.f1.sec.map((m, j) => [j, t.length ? t.filter(x => norm(m.nombre_completo).split(/\s+/).includes(x)).length / t.length : 0])
    .filter(([j, s]) => s >= .5 && !u.has(j)).sort((a, b) => b[1] - a[1]).slice(0, 3);
}
function vincular(i, j) { if (j === '' || isNaN(+j)) return; (S.f1.vinc[i] ??= []).push(+j); render(); }
function desvincular(i, j) { S.f1.vinc[i] = S.f1.vinc[i].filter(x => x !== j); render(); }
function aceptarSugerencias() {          // acepta coincidencias fuertes (≥ 80 %)
  S.f1.ecl.forEach((_, i) => sug(i).filter(([, s]) => s >= .8).forEach(([j]) => { if (!usados1().has(j)) (S.f1.vinc[i] ??= []).push(j); })); render();
}
/** Resumen de conciliación (insumo de la Sección 1 de la Fase 5) */
function stats1() {
  const U = S.f1.ecl, n = i => (S.f1.vinc[i] || []).length, meses = (k, v) => U.filter(u => si(u[k === 'd' ? 'diezma' : 'ofrenda']) && num(u[k === 'd' ? 'meses_diezmo' : 'meses_ofrenda']) === v).length;
  return { miembros: S.f1.sec.length, vinc: sum(U, (_, i) => 0) + Object.values(S.f1.vinc).reduce((s, a) => s + a.length, 0), uf: U.length,
    visitas: U.filter((_, i) => !n(i)).length, diez: U.filter(u => si(u.diezma)).length, dad: U.filter(u => si(u.ofrenda)).length,
    dMes: [12, 11, 10].map(v => meses('d', v)), oMes: [12, 11, 10].map(v => meses('o', v)) };
}
function f1() {
  const M = S.f1.sec, U = S.f1.ecl, u = usados1(), s = stats1();
  let h = `<div class="grid md:grid-cols-2 gap-4">${zona('p1', 'cargarP1', M.length && M.length + ' miembros', 'Plantilla 1 · Secretaría')}${zona('p2', 'cargarP2', U.length && U.length + ' UF', 'Plantilla 2 · ECLESIA 7')}</div>`;
  if (!M.length || !U.length) return h + `<p class="text-sm text-slate-500">Sube ambos archivos para iniciar la vinculación.</p>`;
  h += `<div class="grid grid-cols-2 lg:grid-cols-5 gap-3">${card('# Miembros', s.miembros)}${card('Miembros vinculados', s.vinc, 'emerald')}${card('# Visitas (UF sin miembros)', s.visitas, 'amber')}${card('# UF', s.uf)}${card('UF diezmantes / dadivosidad', s.diez + ' / ' + s.dad, 'sky')}</div>
    <div class="flex items-center justify-between"><p class="text-sm text-slate-500">Relación 1 UF → N miembros. 💡 = sugerencia (clic para vincular).</p>
    <button onclick="aceptarSugerencias()" class="px-3 py-1.5 text-sm font-semibold rounded-lg bg-sda-900 text-white">Aceptar sugerencias fuertes</button></div>`;
  const rows = U.map((x, i) => { const l = S.f1.vinc[i] || [];
    return `<tr class="align-top"><td class="px-3 py-2 font-medium">${esc(x.nombre_uf)}</td><td class="px-3">${si(x.diezma) ? '✅' : '—'}</td><td class="px-3">${si(x.ofrenda) ? '✅' : '—'}</td>
    <td class="px-3 py-2">${l.map(j => `<span class="inline-flex gap-1 bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 mr-1">${esc(M[j].nombre_completo)}<button onclick="desvincular(${i},${j})">×</button></span>`).join('')}
      ${sug(i).map(([j]) => `<button onclick="vincular(${i},${j})" class="border border-dashed border-amber-400 text-amber-700 rounded-full px-2 py-0.5 mr-1">💡 ${esc(M[j].nombre_completo)}</button>`).join('')}
      <select onchange="vincular(${i},this.value)" class="border rounded"><option value="">+ vincular…</option>${M.map((m, j) => u.has(j) ? '' : `<option value="${j}">${esc(m.nombre_completo)}</option>`).join('')}</select></td>
    <td class="px-3 text-center">${l.length}</td><td class="px-3"><span class="px-2 py-0.5 rounded-full font-bold ${l.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${l.length ? 'Miembro' : 'Visita'}</span></td></tr>`; }).join('');
  return h + `<div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="min-w-full divide-y text-xs"><thead class="bg-slate-50 font-semibold text-left"><tr><th class="px-3 py-2">UF (ECLESIA 7)</th><th class="px-3">Diezma</th><th class="px-3">Ofrenda</th><th class="px-3">Miembros vinculados</th><th class="px-3"># Miembros</th><th class="px-3">Clasificación</th></tr></thead><tbody class="divide-y bg-white">${rows}</tbody></table></div>`;
}
