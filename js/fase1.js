/* fase1.js – Conciliación de feligresía y UF: agrupación de miembros en Unidades Financieras.
   Modelo: S.f1.asig = { nombreMiembroNormalizado: nombreUFNormalizado | null }  (null = quitado a propósito).
   Se identifica por NOMBRE (no por posición), así la agrupación sobrevive a recargar o reordenar los archivos. */
let MEM1 = {};                       // memoria guardada de la iglesia: {miembro_key: uf_key}
let TK = { m: [], u: [] };           // palabras de cada nombre, en caché
const PAG1 = 40;
const kM = m => norm(m.nombre_completo), kU = u => norm(u.nombre_uf);
const toks = s => norm(s).split(/\s+/).filter(t => t.length > 2);   // ignora "de", "y", "la"…

async function cargarMemoriaUF(ig) {
  MEM1 = {};
  const { data, error } = await supabaseClient.from('agrupaciones_uf').select('miembro_key,uf_key').eq('iglesia_id', ig);
  if (error) return console.warn('agrupaciones_uf no disponible:', error.message);
  (data || []).forEach(r => MEM1[r.miembro_key] = r.uf_key);
}
function tk() {
  if (TK.m.length !== S.f1.sec.length) TK.m = S.f1.sec.map(m => toks(m.nombre_completo));
  if (TK.u.length !== S.f1.ecl.length) TK.u = S.f1.ecl.map(u => toks(u.nombre_uf));
}

/* ---------- carga de archivos ---------- */
async function cargarP1(e) {
  try {
    const rows = await leerExcel(e.target.files[0], 'p1'), cod = r => String(r.categoria).trim().toUpperCase();
    const mal = rows.map((r, i) => [i + 2, cod(r)]).filter(([, c]) => !CATEGORIAS[c]);
    if (mal.length) throw new Error(`Categoría no válida en ${mal.length} fila(s). Códigos permitidos: ${Object.keys(CATEGORIAS).join(', ')}. Primer caso: fila ≈ ${mal[0][0]} = "${mal[0][1]}".`);
    S.f1.sec = rows.map(r => ({ ...r, categoria: cod(r) })); TK.m = [];
  } catch (x) { alert(x.message); }
  tras1();
}
async function cargarP2(e) { try { S.f1.ecl = await leerExcel(e.target.files[0], 'p2'); TK.u = []; } catch (x) { alert(x.message); } tras1(); }
function tras1() { S.f1.pag = 0; autoAgrupar(); render(); }

/* ---------- algoritmo de agrupación ---------- */
// Cobertura: qué fracción de las palabras del nombre del MIEMBRO aparece en el nombre de la UF (sirve para matrimonios: "Pérez García Juan y María").
const cov = (mi, ui) => { const a = TK.m[mi]; return a.length ? a.filter(t => TK.u[ui].includes(t)).length / a.length : 0; };
const mejores = mi => S.f1.ecl.map((_, ui) => [ui, cov(mi, ui)]).filter(([, s]) => s >= .6).sort((a, b) => b[1] - a[1] || TK.u[a[0]].length - TK.u[b[0]].length);

/** Por defecto agrupa: (1) lo guardado antes para la iglesia, (2) coincidencias exactas y únicas. No pisa decisiones manuales. */
function autoAgrupar() {
  const { sec, ecl, asig, origen } = S.f1; if (!sec.length || !ecl.length) return;
  tk();
  const uk = {}; ecl.forEach((u, i) => uk[kU(u)] ??= i);
  const mk = new Set(sec.map(kM));
  Object.keys(asig).forEach(k => { if (!mk.has(k) || (asig[k] && !(asig[k] in uk))) { delete asig[k]; delete origen[k]; } });   // limpia obsoletos
  sec.forEach((m, mi) => {
    const k = kM(m); if (k in asig) return;
    if (MEM1[k] && MEM1[k] in uk) { asig[k] = MEM1[k]; origen[k] = 'memoria'; return; }
    const b = mejores(mi), t = b[0];
    if (t && t[1] === 1 && (!b[1] || b[1][1] < 1 || TK.u[b[1][0]].length > TK.u[t[0]].length)) { asig[k] = kU(ecl[t[0]]); origen[k] = 'auto'; }
  });
}
function derivar() {
  const { sec, ecl, asig } = S.f1, uk = {}; ecl.forEach((u, i) => uk[kU(u)] ??= i);
  const porUF = ecl.map(() => []); let sin = 0;
  sec.forEach((m, mi) => { const u = uk[asig[kM(m)]]; u === undefined ? sin++ : porUF[u].push(mi); });
  return { uk, porUF, sin };
}
/** Resumen de conciliación (lo usan la Fase 1, la Sección 1 de la Fase 5 y el cierre) */
function stats1() {
  const U = S.f1.ecl, { porUF, sin } = derivar(), n = S.f1.sec.length;
  const m = (c, v) => U.filter(u => si(u[c === 'd' ? 'diezma' : 'ofrenda']) && num(u[c === 'd' ? 'meses_diezmo' : 'meses_ofrenda']) === v).length;
  return { miembros: n, vinc: n - sin, sinUF: sin, uf: U.length, visitas: porUF.filter(l => !l.length).length,
    diez: U.filter(u => si(u.diezma)).length, dad: U.filter(u => si(u.ofrenda)).length, dMes: [12, 11, 10].map(v => m('d', v)), oMes: [12, 11, 10].map(v => m('o', v)) };
}

/* ---------- acciones ---------- */
function asignar(mi, v) { const k = kM(S.f1.sec[mi]); S.f1.asig[k] = v === '' ? null : kU(S.f1.ecl[+v]); S.f1.origen[k] = 'manual'; render(); }
function restablecer1() {
  if (!confirm('Se descartarán los cambios manuales y se volverá a lo guardado / sugerido automáticamente. ¿Continuar?')) return;
  S.f1.asig = {}; S.f1.origen = {}; autoAgrupar(); render();
}
async function guardarAgrupacion() {
  const { sec, ecl, asig } = S.f1; if (!sec.length || !ecl.length) return;
  const nom = {}; ecl.forEach(u => nom[kU(u)] ??= u.nombre_uf);
  const par = {}; sec.forEach(m => { const k = kM(m); if (asig[k]) par[k] = { miembro_key: k, miembro_nombre: m.nombre_completo, uf_key: asig[k], uf_nombre: nom[asig[k]] }; });
  if (!(await guardarBorrador(true))) return;
  const { error } = await supabaseClient.rpc('guardar_agrupaciones', { p_iglesia: S.iglesia, p_pares: Object.values(par), p_claves: sec.map(kM) });
  if (error) return alert('No se pudo guardar la agrupación: ' + error.message);
  sec.forEach(m => delete MEM1[kM(m)]); Object.values(par).forEach(p => MEM1[p.miembro_key] = p.uf_key);
  alert(`Agrupación guardada: ${Object.keys(par).length} miembros agrupados.`);
}

/* ---------- pantalla ---------- */
function f1() {
  const M = S.f1.sec, U = S.f1.ecl;
  let h = `<div class="grid md:grid-cols-2 gap-4">${zona('p1', 'cargarP1', M.length && M.length + ' miembros', 'Plantilla 1 · Secretaría')}${zona('p2', 'cargarP2', U.length && U.length + ' UF', 'Plantilla 2 · ECLESIA 7')}</div>`;
  if (!M.length || !U.length) return h + `<p class="text-sm text-slate-500">Sube ambos archivos para agrupar a los miembros en sus Unidades Financieras.</p>`;
  tk(); const s = stats1(), d = derivar(), v = S.f1.vista;
  const tab = (id, t) => `<button onclick="S.f1.vista='${id}';render()" class="keep px-3 py-1.5 text-sm font-semibold rounded-lg ${v === id ? 'bg-sda-900 text-white' : 'bg-slate-100'}">${t}</button>`;
  h += `<div class="grid grid-cols-2 lg:grid-cols-6 gap-3">${card('# Miembros', s.miembros)}${card('Agrupados en una UF', s.vinc, 'emerald')}${card('Miembros sin UF', s.sinUF, 'amber')}${card('# UF', s.uf)}${card('UF sin miembros (Visitas)', s.visitas, 'amber')}${card('UF diezmantes / dadivosidad', s.diez + ' / ' + s.dad, 'sky')}</div>
    <div class="flex flex-wrap items-center justify-between gap-3"><div class="flex gap-2">${tab('miembros', 'Por miembro')}${tab('uf', 'Por UF')}</div>
    <div class="flex gap-2"><button onclick="restablecer1()" class="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100">↺ Restablecer sugerencias</button>
    <button onclick="guardarAgrupacion()" class="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white">💾 Guardar agrupación</button></div></div>`;
  return h + (v === 'uf' ? vistaUF(d) : vistaMiembros(d));
}
const chip1 = (o, asignado) => !asignado ? (o === 'manual' ? ['Quitado', 'bg-slate-100 text-slate-600'] : ['Sin UF', 'bg-amber-100 text-amber-800'])
  : o === 'manual' ? ['Manual', 'bg-violet-100 text-violet-800'] : o === 'memoria' ? ['Guardada', 'bg-sky-100 text-sky-800'] : ['Automática', 'bg-emerald-100 text-emerald-800'];

function vistaMiembros(d) {
  const { sec, ecl, asig, origen, q, soloSin } = S.f1, qn = norm(q);
  let idx = sec.map((_, i) => i).filter(i => (!qn || kM(sec[i]).includes(qn)) && (!soloSin || !asig[kM(sec[i])]));
  const tot = idx.length, pgs = Math.max(1, Math.ceil(tot / PAG1)), p = Math.min(S.f1.pag, pgs - 1);
  idx = idx.slice(p * PAG1, (p + 1) * PAG1);
  const ord = ecl.map((u, i) => [i, u.nombre_uf]).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es'));
  const rows = idx.map(i => {
    const m = sec[i], k = kM(m), cur = d.uk[asig[k]], sug = cur === undefined ? mejores(i).slice(0, 3) : [], [t, c] = chip1(origen[k], cur !== undefined);
    const otros = cur === undefined ? '' : d.porUF[cur].filter(x => x !== i).map(x => esc(sec[x].nombre_completo)).join(', ');
    return `<tr class="align-top"><td class="px-3 py-2 font-medium">${esc(m.nombre_completo)}</td><td class="px-3 py-2">${esc(etiquetaCategoria(m.categoria))}</td>
      <td class="px-3 py-2"><select onchange="asignar(${i},this.value)" class="border rounded px-1 py-1 max-w-xs"><option value="">— Sin UF —</option>
        ${sug.length ? `<optgroup label="💡 Sugeridas">${sug.map(([u, sc]) => `<option value="${u}">${esc(ecl[u].nombre_uf)} (${Math.round(sc * 100)}%)</option>`).join('')}</optgroup>` : ''}
        <optgroup label="Todas las UF">${ord.map(([u, n]) => `<option value="${u}" ${u === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup></select>
        ${otros ? `<div class="text-slate-500 mt-1">También en la UF: ${otros}</div>` : ''}</td>
      <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full font-bold ${c}">${t}</span></td>
      <td class="px-3 py-2">${cur !== undefined ? `<button onclick="asignar(${i},'')" class="text-rose-600 underline">Quitar de la UF</button>` : ''}</td></tr>`; }).join('');
  const nav = `<div class="flex items-center justify-between text-xs text-slate-500"><span>${tot ? `Mostrando ${p * PAG1 + 1}–${Math.min(tot, (p + 1) * PAG1)} de ${tot}` : 'Sin resultados'}</span>
    <div class="flex gap-2"><button ${p ? '' : 'disabled'} onclick="S.f1.pag=${p - 1};render()" class="keep px-2 py-1 border rounded disabled:opacity-40">← Anterior</button>
    <button ${p < pgs - 1 ? '' : 'disabled'} onclick="S.f1.pag=${p + 1};render()" class="keep px-2 py-1 border rounded disabled:opacity-40">Siguiente →</button></div></div>`;
  return `<div class="flex flex-wrap items-center gap-4 text-sm"><input type="search" value="${esc(q)}" placeholder="Buscar miembro…" onchange="S.f1.q=this.value;S.f1.pag=0;render()" class="keep px-3 py-1.5 border border-slate-300 rounded-lg">
    <label class="flex items-center gap-1"><input type="checkbox" class="keep" ${soloSin ? 'checked' : ''} onchange="S.f1.soloSin=this.checked;S.f1.pag=0;render()">Solo miembros sin UF</label></div>${nav}
    <div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="min-w-full divide-y text-xs"><thead class="bg-slate-50 font-semibold text-left"><tr><th class="px-3 py-2">Miembro (Secretaría)</th><th class="px-3">Categoría</th><th class="px-3">Unidad financiera (ECLESIA 7)</th><th class="px-3">Origen</th><th class="px-3"></th></tr></thead><tbody class="divide-y bg-white">${rows}</tbody></table></div>${nav}`;
}
function vistaUF(d) {
  const { sec, ecl } = S.f1;
  const rows = ecl.map((u, i) => { const l = d.porUF[i];
    return `<tr class="align-top"><td class="px-3 py-2 font-medium">${esc(u.nombre_uf)}</td><td class="px-3">${si(u.diezma) ? '✅' : '—'}</td><td class="px-3">${si(u.ofrenda) ? '✅' : '—'}</td>
    <td class="px-3 py-2">${l.map(j => `<span class="inline-flex gap-1 bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 mr-1 mb-1">${esc(sec[j].nombre_completo)}<button onclick="asignar(${j},'')" title="Quitar de la UF">×</button></span>`).join('')}</td>
    <td class="px-3 text-center">${l.length}</td><td class="px-3"><span class="px-2 py-0.5 rounded-full font-bold ${l.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${l.length ? 'Miembro' : 'Visita'}</span></td></tr>`; }).join('');
  return `<p class="text-sm text-slate-500">Vista de consulta: para agregar miembros a una UF usa la pestaña «Por miembro».</p><div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="min-w-full divide-y text-xs"><thead class="bg-slate-50 font-semibold text-left"><tr><th class="px-3 py-2">UF (ECLESIA 7)</th><th class="px-3">Diezma</th><th class="px-3">Ofrenda</th><th class="px-3">Miembros agrupados</th><th class="px-3"># Miembros</th><th class="px-3">Clasificación</th></tr></thead><tbody class="divide-y bg-white">${rows}</tbody></table></div>`;
}
