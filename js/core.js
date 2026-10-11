/* core.js – estado global, utilidades, plantillas (spec 3.2), navegación y persistencia */
function nuevoDep(id, nombre) { return { id, nombre, activo: true, pct: 0, gasto: 0, misc: 0, dir: 0, ent: 0, sal: 0 }; }
const S = {
  fase: 1, aN: new Date().getFullYear() + 1, aN1: new Date().getFullYear(), pid: null, estado: 'borrador', iglesia: '',
  f1: { sec: [], ecl: [], asig: {}, origen: {}, vista: 'miembros', q: '', soloSin: false, pag: 0 },            // vinc: {indiceUF: [indiceMiembro,...]}
  f2: { m: [] },
  f3: { deps: ['Ministerio de la Juventud', 'Ministerio Infantil y del Adolescente', 'Escuela Sabática', 'Mayordomía Cristiana',
               'Ministerio de la Mujer', 'Evangelismo y Misión Global', 'Servicios e Infraestructura'].map((n, i) => nuevoDep('dep-' + (i + 1), n)) },
  f4: { infl: 5, crec: 0, acts: [], ap: {} },    // ap: {depId: {v, c}}
  f5: { dig: { dn: 0, on: 0, af: 0, ad: 0 }, pct: {}, sb: { base: 0, fecha: '', d: {} } }
};

const S0 = structuredClone(S);   // estado inicial limpio (al cambiar de iglesia/año)
/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const num = v => parseFloat(v) || 0;
const money = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const pc = n => (n || 0).toFixed(2) + '%';
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const si = v => v === true || norm(v) === 'si';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Categorías de miembro: en los archivos se capturan los CÓDIGOS; en pantallas y reportes se muestra la etiqueta completa. */
const CATEGORIAS = { A: 'Adulto', JA: 'Joven', MYA: 'Niño/Adolescente' };
const etiquetaCategoria = c => CATEGORIAS[String(c ?? '').trim().toUpperCase()] || String(c ?? '');
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

/** Asigna S[path] (numérico por defecto, texto si txt) y vuelve a renderizar. Crea objetos intermedios. */
function set(path, val, txt) {
  const k = path.split('.'); let o = S;
  k.slice(0, -1).forEach(x => o = (o[x] ??= {}));
  o[k.at(-1)] = txt ? val : num(val); render();
}
const inp = (path, v, w = 'w-24', txt) =>
  `<input ${txt ? 'type="text"' : 'type="number" step="0.01"'} value="${esc(v)}" onchange="set('${path}',this.value${txt ? ',1' : ''})" class="${w} px-1.5 py-1 text-right border border-slate-300 rounded font-mono text-xs">`;
const card = (l, v, c = 'slate', sub = '') => `<div class="p-3 bg-${c}-50 border border-${c}-200 rounded-lg"><div class="text-xs uppercase font-bold text-${c}-600">${l}</div><div class="text-lg font-bold text-slate-900">${v}</div>${sub ? `<div class="text-xs text-${c}-600">${sub}</div>` : ''}</div>`;
const alerta = (ok, msg) => `<div class="p-3 rounded-lg border text-sm ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-900'}">${ok ? '✅' : '⚠️'} ${msg}</div>`;
const th = (cols) => `<thead class="bg-slate-50 font-semibold text-slate-700"><tr>${cols.map((c, i) => `<th class="px-3 py-2 ${i ? 'text-right' : 'text-left'}">${c}</th>`).join('')}</tr></thead>`;
const tabla = (cols, rows, foot = '') => `<div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="min-w-full divide-y divide-slate-200 text-xs">${th(cols)}<tbody class="divide-y divide-slate-100 bg-white">${rows}</tbody>${foot ? `<tfoot class="bg-slate-100 font-bold border-t-2 border-slate-300">${foot}</tfoot>` : ''}</table></div>`;
const td = (v, cls = '') => `<td class="px-3 py-2 text-right font-mono ${cls}">${v}</td>`;

/* ---------- plantillas descargables (spec 3.2) ---------- */
const PLANT = {
  p1: { n: 'Secretaria', c: ['nombre_completo', 'categoria'], i: ['Nombre completo', 'Código: ' + Object.entries(CATEGORIAS).map(([k, v]) => `${k} = ${v}`).join(' | ')],
        ley: Object.entries(CATEGORIAS) },
  p2: { n: 'ECLESIA7_UF', c: ['nombre_uf', 'meses_diezmo', 'meses_ofrenda'],
        i: ['Nombre de la UF (una persona o un grupo, p. ej. un matrimonio)', 'Meses del año con diezmo (0 a 12). Más de 0 = unidad diezmante', 'Meses del año con ofrenda (0 a 12). Más de 0 = unidad en dadivosidad'] },
  p3: { n: 'Ejecucion_Mensual', opc: ['ofrenda_bruta', 'porcentaje_ofrendas'],
        c: ['mes', 'diezmos', 'ofrenda_bruta', 'gastos', 'porcentaje_ofrendas', 'desglose_remesa_20', 'desglose_remesa_16', 'desglose_remesa_4', 'desglose_remesa_ofg', 'ingresos_directos'],
        i: ['1 a 12', 'Monto', 'Opcional (por confirmar)', 'Monto', 'Opcional (por confirmar)', 'Monto', 'Monto', 'Monto', 'Monto OFG (no es porcentaje); 0 si vacío', 'Monto'] },
  p4: { n: 'Actividades_Departamento', c: ['departamento', 'mes', 'actividad', 'importe'], i: ['Nombre igual al catálogo de Fase 3', '1 a 12', 'Descripción', 'Monto'] }
};
function descargarPlantilla(k) {
  const p = PLANT[k], wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([p.c]), 'Plantilla');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Columna', 'Formato / valores permitidos'], ...p.c.map((c, i) => [c, p.i[i]])]), 'Instrucciones');
  XLSX.writeFile(wb, `Plantilla_${p.n}.xlsx`);
}
/** Lee un archivo y valida que traiga las columnas de la plantilla antes de procesarlo. */
async function leerExcel(f, k) {
  if (!f) throw new Error('No se seleccionó archivo.');
  const ws = (wb => wb.Sheets[wb.SheetNames[0]])(XLSX.read(await f.arrayBuffer(), { type: 'array' }));
  const h = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []).map(x => String(x).trim()), p = PLANT[k];
  const falt = p.c.filter(c => !h.includes(c) && !(p.opc || []).includes(c));
  if (falt.length) throw new Error('El archivo no coincide con la plantilla. Faltan columnas: ' + falt.join(', '));
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
const zona = (k, fn, ok, titulo) => `<div class="border-2 border-dashed ${ok ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300'} rounded-lg p-4">
  <div class="font-semibold text-sm">${titulo}</div>
  <div class="mt-2 flex flex-wrap items-center gap-4 text-sm">
    <label class="cursor-pointer text-sda-600 font-semibold">⬆ Subir .xlsx / .csv<input type="file" accept=".xlsx,.csv" class="sr-only" onchange="${fn}(event)"></label>
    <button onclick="descargarPlantilla('${k}')" class="text-slate-600 underline">⬇ Descargar plantilla</button>
    ${ok ? `<span class="text-emerald-700 text-xs font-bold">✓ ${ok}</span>` : ''}</div></div>`;

/* ---------- navegación ---------- */
const FASES = [
  ['Feligresía y UF', 'Conciliación de Feligresía y Unidades Financieras (UF)', 'Carga Secretaría y ECLESIA 7, vincula UF ↔ miembros y revisa el resumen.', () => f1()],
  ['Análisis Histórico', 'Análisis Histórico de Ingresos, Gastos y Saldos (N-1)', 'Carga la ejecución mensual de ECLESIA 7 del año evaluado.', () => f2()],
  ['Departamentos', 'Presupuesto Operativo por Departamentos', 'Catálogo, % asignado y cadena de saldos por departamento.', () => f3()],
  ['Inflación y Ajustes', 'Formulación, Ajuste e Inflación del Nuevo Presupuesto (N)', 'Parámetros globales, actividades por departamento y montos aprobados.', () => f4()],
  ['Reporte Final', 'Pantalla Resultante y Exportación', 'Resumen ejecutivo para la Junta y el Concilio de Mayordomía.', () => f5()]
];
function render() {
  $('stepper').innerHTML = FASES.map((f, i) => { const n = i + 1;
    return `<li class="md:flex-1"><button onclick="irAFase(${n})" class="flex w-full flex-col border-t-4 pt-2 text-left ${n === S.fase ? 'border-amber-500' : n < S.fase ? 'border-sda-600' : 'border-slate-200 opacity-60'}"><span class="text-xs font-bold uppercase text-slate-500">Fase ${n}</span><span class="text-sm font-semibold">${f[0]}</span></button></li>`; }).join('');
  const f = FASES[S.fase - 1];
  $('fase-titulo').textContent = `Fase ${S.fase}: ${f[1]}`; $('fase-descripcion').textContent = f[2];
  $('estado-lbl').textContent = S.estado; $('wizard-step-content').innerHTML = f[3]();
  $('btn-ant').disabled = S.fase === 1; aplicarPermisos(); $('btn-sig').textContent = S.fase === 5 ? 'Finalizar' : 'Siguiente Fase →';
}
function irAFase(n) { S.fase = n; render(); window.scrollTo(0, 0); }
function faseAnterior() { if (S.fase > 1) irAFase(S.fase - 1); }
async function faseSiguiente() {
  if (puedeEditar() && !(await guardarBorrador(true))) return;           // UPSERT al avanzar (spec 3.1)
  S.fase < 5 ? irAFase(S.fase + 1) : alert('Presupuesto guardado. Exporta el Excel o el PDF desde esta pantalla.');
}

/* ---------- permisos por rol y estado ---------- */
const ROLES_EDIT = ['superadmin', 'tesorero', 'secretario'];
const puedeEditar = () => S.estado === 'borrador' && ROLES_EDIT.includes(usuarioSesion?.rol);
function aplicarPermisos() {
  const ro = !puedeEditar(), r = usuarioSesion?.rol, e = S.estado;
  if (ro) $('wizard-step-content').querySelectorAll('input,select,textarea,button:not(.keep)').forEach(x => x.disabled = true);
  $('btn-guardar').classList.toggle('hidden', ro);
  const b = (t, n, c) => `<button onclick="cambiarEstado('${n}')" class="rounded-lg px-4 py-2 text-sm font-semibold ${c}">${t}</button>`;
  let h = '';
  if (S.pid) {
    if (e === 'borrador' && ROLES_EDIT.includes(r) && S.fase === 5) h = b('Enviar a revisión', 'en_revision', 'bg-amber-500 text-white');
    if (e === 'en_revision') {
      if (['superadmin', 'tesorero', 'junta'].includes(r)) h += b('Aprobar', 'aprobado', 'bg-emerald-600 text-white');
      if (['superadmin', 'tesorero'].includes(r)) h += b('Reabrir borrador', 'borrador', 'bg-slate-200');
    }
    if (e === 'aprobado' && r === 'superadmin') h = b('Reabrir borrador', 'borrador', 'bg-slate-200');
  }
  $('acciones-estado').innerHTML = h;
}

/* ---------- persistencia (RPC de Supabase: ver supabase/setup.sql) ---------- */
async function guardarBorrador(silencioso) {
  if (!puedeEditar()) return true;
  try {
    const { pid, estado, iglesia, ...datos } = S;
    const { data, error } = await supabaseClient.rpc('guardar_borrador', { p_iglesia: S.iglesia, p_id: S.pid, p_anio_evaluado: S.aN1,
      p_anio_pres: S.aN, p_fase: S.fase, p_infl: S.f4.infl, p_crec: S.f4.crec, p_datos: datos });
    if (error) throw error;
    S.pid = data; if (!silencioso) alert('Borrador guardado.'); return true;
  } catch (e) { console.error(e); alert('No se pudo guardar: ' + (e.code === '23505' ? 'ya existe un presupuesto para ese año.' : e.message)); return false; }
}
async function cargarCatalogo(ig) {      // catálogo real de departamentos (UUID) + valores capturados por id
  const { data, error } = await supabaseClient.from('departamentos').select('id,nombre,activo').eq('iglesia_id', ig).order('orden').order('nombre');
  if (error) throw error;
  const prev = Object.fromEntries(S.f3.deps.map(d => [d.id, d]));
  S.f3.deps = data.map(d => ({ ...nuevoDep(d.id, d.nombre), ...(prev[d.id] || {}), nombre: d.nombre, activo: d.activo }));
}
async function initWizard() {
  const sa = $('select-anio'), y = new Date().getFullYear();
  if (!sa.options.length) sa.innerHTML = [y, y + 1, y + 2].map(a => `<option value="${a}" ${a === y + 1 ? 'selected' : ''}>Presupuesto ${a}</option>`).join('');
  const ig = $('select-iglesia-activa').value, a = +sa.value;
  Object.assign(S, structuredClone(S0), { iglesia: ig, aN: a, aN1: a - 1 });
  try {
    const { data, error } = await supabaseClient.rpc('cargar_borrador', { p_iglesia: ig, p_anio: a });
    if (error) throw error;
    if (data) Object.assign(S, data.datos, { pid: data.id, estado: data.estado, fase: data.fase_actual, aN1: data.anio_evaluado, aN: data.anio_presupuestado, iglesia: ig });
    await cargarCatalogo(ig);
    await cargarMemoriaUF(ig);
  } catch (e) { console.error(e); alert('No se pudo cargar la información: ' + e.message); }
  render();
}
const cambiarIglesia = () => initWizard(), cambiarAnio = () => initWizard();

/* ---------- cierre: envía a Supabase los resultados calculados para validar y materializar ---------- */
function payloadCierre() {
  const c = calc5(), raw = S.f2.m, sb = S.f5.sb.d;
  const historico = calc2().m.map((r, i) => ({ mes: num(r.mes) || i + 1, diezmos: r.diez, remesa_20: num(raw[i].desglose_remesa_20), remesa_16: num(raw[i].desglose_remesa_16),
    remesa_4: num(raw[i].desglose_remesa_4), remesa_ofg: num(raw[i].desglose_remesa_ofg), ofrenda_100: r.o100, ofrenda_local_60: r.loc,
    ingresos_directos: r.dir, ofrenda_60_mes: r.o60, gastos: r.gas, saldo_mensual: r.sal }));
  const departamentos = c.rows.map(r => { const s = sb[r.id] || {};
    return { departamento_id: r.id, porcentaje_asignado: r.pct, ingresos: r.ing, gasto: r.gasto, gastos_miscelaneos: r.misc, ingresos_directos: r.dir,
      transf_entrantes: r.ent, transf_salientes: r.sal, saldo_final: r.sf, gasto_estimado: r.est, limite_indexado: r.lim, monto_aprobado: r.ap, comentario: r.com,
      porcentaje_concilio: r.pctC, gasto_por_porcentaje: r.gpp, saldo_corte: s.c || 0, ajustes: s.a || 0, porcentaje_junta: s.j || 0,
      saldo_aprobado_junta: S.f5.sb.base * (s.j || 0) / 100 }; });
  const resumen = { estadistica: stats1(), desafio_fe: S.f5.dig, proyeccion: { ofrenda60_n: c.pry, gastos_n: c.tG, total_gasto_estimado: c.tEst },
    saldos: { base: S.f5.sb.base, fecha_corte: S.f5.sb.fecha }, inflacion: S.f4.infl, crecimiento: S.f4.crec };
  return { historico, departamentos, resumen };
}
async function cambiarEstado(nuevo) {
  if (nuevo === 'en_revision' && !(await guardarBorrador(true))) return;
  if (!confirm(`¿Cambiar el presupuesto a "${nuevo}"?`)) return;
  const p = nuevo === 'en_revision' ? payloadCierre() : {};
  const { error } = await supabaseClient.rpc('cambiar_estado', { p_id: S.pid, p_nuevo: nuevo, p_resumen: p.resumen ?? null, p_historico: p.historico ?? null, p_departamentos: p.departamentos ?? null });
  if (error) return alert(error.message);
  S.estado = nuevo; render();
}
// auth.js llama a mostrarPantallaWizard() al autorizar: se extiende para arrancar el wizard
const _mostrarWizard = mostrarPantallaWizard;
mostrarPantallaWizard = function () { _mostrarWizard(); initWizard(); };
