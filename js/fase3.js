/* fase3.js – Presupuesto por departamento + CATÁLOGO de departamentos de la iglesia.
   Catálogo (tabla catalogo_departamentos, por iglesia): define qué departamentos existen y cuáles están HABILITADOS.
     · Habilitado    → aparece en la tabla de esta fase (en ceros si es nuevo en el presupuesto).
     · Deshabilitado → sale de la tabla de este presupuesto; sigue en el catálogo y se puede volver a habilitar. Nunca se borra.
     · Crear         → se agrega al catálogo (habilitado) y a la tabla.
   Los valores (%, gasto, transferencias…) se guardan con cada presupuesto, por nombre; el catálogo no guarda montos.
   La Plantilla 5 sigue cargando valores: sus departamentos nuevos se registran en el catálogo y los deshabilitados se omiten.
   Ingresos (60%)  = Ofrenda local 60% anual × % asignado                (sin ingresos directos)
   Ing. directos   = Total de ingresos directos (Fase 2) × % asignado     (se calcula, no se captura) */
function calc3() {
  const t = calc2().t;
  return S.f3.deps.map((d, i) => {
    const ing = t.loc * d.pct / 100, dir = t.dir * d.pct / 100, tg = d.gasto + d.misc;
    return { ...d, i, ing, dir, tg, sp: ing - d.gasto, ss: ing - tg, sf: ing - tg + dir + d.ent - d.sal };
  });
}

/* ---------- catálogo de departamentos ---------- */
let CAT = [];              // [{clave, nombre, activo, orden}] de la iglesia activa
let catAbierto = false;    // el panel colapsable conserva su estado aunque la pantalla se vuelva a dibujar
const enCat = n => CAT.find(c => c.clave === norm(n));
const conValores = d => !!(d.pct || d.gasto || d.misc || d.ent || d.sal);

async function cargarCatalogo(ig) {
  CAT = [];
  const { data, error } = await supabaseClient.from('catalogo_departamentos').select('clave,nombre,activo,orden').eq('iglesia_id', ig).order('orden').order('nombre');
  if (error) return console.warn('catalogo_departamentos no disponible:', error.message);
  CAT = data || [];
}
async function guardarCatalogo(items, silencioso) {
  const { error } = await supabaseClient.rpc('guardar_catalogo_departamentos', { p_iglesia: S.iglesia, p_items: items });
  if (error) { if (!silencioso) alert('No se pudo guardar el catálogo: ' + error.message); else console.warn(error.message); return false; }
  return true;
}
/** Borradores anteriores: registra en el catálogo los departamentos de la tabla que aún no estén (no cambia los ya existentes). */
async function sincronizarCatalogoConBorrador() {
  if (!puedeEditar()) return;
  const falt = S.f3.deps.filter(d => !CAT.some(c => 'd:' + c.clave === d.id));
  if (!falt.length) return;
  const items = falt.map((d, i) => ({ clave: norm(d.nombre), nombre: d.nombre, activo: true, orden: CAT.length + i + 1 }));
  if (await guardarCatalogo(items, true)) CAT.push(...items);
}

async function crearDepCatalogo() {
  const el = $('nuevo-dep-cat'), n = el.value.trim(); if (!n) return alert('Ingresa el nombre del departamento.');
  const ex = enCat(n);
  if (ex) return alert(ex.activo ? 'Ya existe un departamento con ese nombre.' : `«${ex.nombre}» ya está en el catálogo pero deshabilitado. Habilítalo con su interruptor.`);
  const it = { clave: norm(n), nombre: n, activo: true, orden: CAT.length + 1 };
  if (!(await guardarCatalogo([it]))) return;
  CAT.push(it);
  S.f3.deps.push(nuevoDep(idDep(n), n)); catAbierto = true; render();
}
/** Habilita o deshabilita el departamento CAT[i]. Habilitar lo agrega a la tabla; deshabilitar lo quita (con confirmación si ya tiene valores). */
async function alternarDepCatalogo(i, activar) {
  const c = CAT[i]; if (!c) return;
  const d = S.f3.deps.find(x => x.id === 'd:' + c.clave);
  if (!activar && d && conValores(d) && !confirm(`«${c.nombre}» tiene valores capturados en este presupuesto.\n\nAl deshabilitarlo se quitará de la tabla y se perderán esos valores. ¿Continuar?`)) return render();
  if (!(await guardarCatalogo([{ ...c, activo: activar }]))) return render();
  c.activo = activar;
  if (activar && !d) S.f3.deps.push(nuevoDep('d:' + c.clave, c.nombre));
  if (!activar && d) S.f3.deps.splice(S.f3.deps.indexOf(d), 1);
  catAbierto = true; render();
}
/** Botón × de la tabla: equivale a deshabilitar el departamento en el catálogo. */
function quitarDep(i) {
  const d = S.f3.deps[i], k = CAT.findIndex(c => 'd:' + c.clave === d.id);
  if (k < 0) return alert('Este departamento no está en el catálogo; vuelve a cargar la pantalla.');
  if (!conValores(d) && !confirm(`¿Deshabilitar «${d.nombre}»? Saldrá de esta tabla y podrás volver a habilitarlo desde el catálogo.`)) return;
  alternarDepCatalogo(k, false);
}

function panelCatalogo() {
  const hab = CAT.filter(c => c.activo).length;
  const filas = CAT.map((c, i) => `<label class="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-100 text-sm ${c.activo ? '' : 'text-slate-400'}">
      <span>${esc(c.nombre)}</span>
      <span class="flex items-center gap-2 text-xs"><span class="px-2 py-0.5 rounded-full font-bold ${c.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}">${c.activo ? 'Habilitado' : 'Deshabilitado'}</span>
        <input type="checkbox" ${c.activo ? 'checked' : ''} onchange="alternarDepCatalogo(${i}, this.checked)" aria-label="Habilitar ${esc(c.nombre)}"></span></label>`).join('');
  return `<details ${catAbierto ? 'open' : ''} ontoggle="catAbierto=this.open" class="border border-slate-200 rounded-xl bg-white">
    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-semibold flex items-center justify-between"><span>🗂 Catálogo de departamentos</span>
      <span class="text-xs font-normal text-slate-500">${hab} habilitados de ${CAT.length}</span></summary>
    <div class="border-t border-slate-200">
      <p class="px-4 py-2 text-xs text-slate-500">Habilitar agrega el departamento a la tabla; deshabilitar lo quita de este presupuesto (no se borra y puedes volver a habilitarlo). Los presupuestos ya enviados a revisión o aprobados no cambian.</p>
      <div class="max-h-64 overflow-y-auto">${filas || '<p class="px-4 py-3 text-sm text-slate-500">El catálogo está vacío. Crea un departamento aquí abajo o carga la Plantilla 5: sus departamentos se registrarán solos.</p>'}</div>
      <div class="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200 rounded-b-xl">
        <input id="nuevo-dep-cat" placeholder="Nombre del nuevo departamento…" onkeydown="if(event.key==='Enter')crearDepCatalogo()" class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
        <button onclick="crearDepCatalogo()" class="px-3 py-1.5 bg-sda-900 text-white text-sm font-semibold rounded-lg">+ Crear departamento</button></div></div></details>`;
}

/** Carga la Plantilla 5: cada fila es un departamento (nombre + valores). Reemplaza la tabla actual.
    Los nombres nuevos se registran en el catálogo; los deshabilitados en el catálogo se omiten; los habilitados que no vengan en el archivo se agregan en ceros. */
async function cargarP5(e) {
  try {
    const rows = (await leerExcel(e.target.files[0], 'p5')).filter(r => Object.values(r).some(v => String(v).trim() !== ''));
    if (!rows.length) throw new Error('El archivo no trae departamentos.');
    const campos = ['porcentaje_asignado', 'gasto', 'miscelaneos', 'transferencias_entrada', 'transferencias_salida'];
    const esNum = v => v === '' || v == null || typeof v === 'number' || !isNaN(parseFloat(String(v).replace(/[$,\s]/g, '')));
    const mal = rows.flatMap((r, i) => campos.filter(c => !esNum(r[c])).map(c => `fila ≈ ${i + 2} (${c} = "${r[c]}")`));
    if (mal.length) throw new Error(`Hay ${mal.length} valor(es) que no son números. Primer caso: ${mal[0]}.`);
    const sin = rows.findIndex(r => String(r.departamento).trim() === '');
    if (sin >= 0) throw new Error(`Falta el nombre del departamento en la fila ≈ ${sin + 2}.`);
    const vistos = {}, rep = []; rows.forEach(r => { const k = idDep(r.departamento); if (vistos[k]) rep.push(String(r.departamento).trim()); vistos[k] = 1; });
    if (rep.length) throw new Error('Hay departamentos repetidos en el archivo: ' + [...new Set(rep)].join(', ') + '.');
    const omitidos = rows.filter(r => enCat(r.departamento)?.activo === false).map(r => String(r.departamento).trim());
    const validas = rows.filter(r => enCat(r.departamento)?.activo !== false);
    if (!validas.length) throw new Error('Todos los departamentos del archivo están deshabilitados en el catálogo. Habilítalos primero.');
    if (S.f3.deps.length && !confirm(`⚠ Se reemplazará TODA la lista actual (${S.f3.deps.length} departamento(s), incluidos los cambios hechos a mano en la pantalla) por los ${validas.length} departamento(s) del archivo.\n\n¿Continuar?`)) return;
    const deps = validas.map(r => ({ ...nuevoDep(idDep(r.departamento), String(r.departamento).trim()), pct: num(r.porcentaje_asignado), gasto: num(r.gasto),
      misc: num(r.miscelaneos), ent: num(r.transferencias_entrada), sal: num(r.transferencias_salida) }));
    const nuevos = deps.filter(d => !enCat(d.nombre)).map((d, i) => ({ clave: norm(d.nombre), nombre: d.nombre, activo: true, orden: CAT.length + i + 1 }));
    if (nuevos.length && await guardarCatalogo(nuevos, true)) CAT.push(...nuevos);
    const extras = CAT.filter(c => c.activo && !deps.some(d => d.id === 'd:' + c.clave)).map(c => nuevoDep('d:' + c.clave, c.nombre));
    S.f3.deps = [...deps, ...extras]; S.f3.carga = validas.length;
    const avisos = [];
    if (omitidos.length) avisos.push(`Se omitieron ${omitidos.length} departamento(s) deshabilitado(s) en el catálogo: ${omitidos.join(', ')}.`);
    if (extras.length) avisos.push(`Se agregaron en ceros ${extras.length} departamento(s) habilitado(s) del catálogo que no venían en el archivo: ${extras.map(d => d.nombre).join(', ')}.`);
    if (avisos.length) alert(avisos.join('\n\n'));
  } catch (x) { alert(x.message); }
  render();
}

function f3() {
  const R = calc3(), t2 = calc2().t, tp = sum(R, r => r.pct), te = sum(R, r => r.ent), ts = sum(R, r => r.sal);
  const aviso = `<div class="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">⚠ <strong>Carga TODOS los departamentos actuales</strong> de la iglesia. Si el próximo año habrá un departamento nuevo, créalo en el catálogo o inclúyelo en el archivo, aunque sea con ceros: no tuvo presupuesto ni movimientos en el año actual. Los departamentos <strong>habilitados</strong> del catálogo siempre aparecen en la tabla; los <strong>deshabilitados</strong> no se cargan. Estos mismos departamentos pasan a la Fase 4 para los ajustes.</div>`;
  const carga = aviso + panelCatalogo() + zona('p5', 'cargarP5', S.f3.carga && S.f3.carga + ' departamentos cargados', 'Plantilla 5 · Departamentos: % asignado, gasto, misceláneos y transferencias') +
    `<p class="text-xs text-slate-500">Después de cargar puedes seguir editando los valores en la tabla.</p>`;
  if (!R.length) return carga + `<p class="text-sm text-slate-500">Aún no hay departamentos. Habilita o crea departamentos en el catálogo, o carga la Plantilla 5 para comenzar.</p>`;
  const rows = R.map(d => `<tr><td class="px-3 py-2 font-medium">${esc(d.nombre)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.pct`, d.pct, 'w-16')}</td>${td(money(d.ing), 'text-sky-800')}
    <td class="px-3 text-right">${inp(`f3.deps.${d.i}.gasto`, d.gasto)}</td>${td(money(d.sp))}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.misc`, d.misc)}</td>${td(money(d.tg), 'text-rose-700')}${td(money(d.ss))}
    ${td(money(d.dir), 'text-sky-800')}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.ent`, d.ent)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.sal`, d.sal)}</td>
    ${td(money(d.sf), 'font-bold bg-sky-50 ' + (d.sf >= 0 ? 'text-emerald-700' : 'text-rose-700'))}<td class="px-3 text-center"><button onclick="quitarDep(${d.i})" class="text-rose-600" title="Deshabilitar en el catálogo (sale de esta tabla)">×</button></td></tr>`).join('');
  return carga + alerta(Math.abs(tp - 100) < .01, `Σ % asignado = ${pc(tp)} ${Math.abs(tp - 100) < .01 ? '' : '(debe ser 100%)'}`) +
    alerta(Math.abs(te - ts) < .01, Math.abs(te - ts) < .01 ? 'Transferencias entrantes y salientes balanceadas.' : `Entrantes (${money(te)}) ≠ Salientes (${money(ts)}).`) +
    (t2.loc ? `<p class="text-xs text-slate-500">Base de reparto: Ofrenda local 60% anual ${money(t2.loc)} (Ingresos) e ingresos directos totales ${money(t2.dir)} (Ing. directos, calculados), ambos × % asignado.</p>` : alerta(false, 'Aún no hay datos de la Fase 2: carga la ejecución mensual para calcular Ingresos e Ing. directos.')) +
    tabla(['Departamento', '% Asig.', 'Ingresos (60%)', 'Gasto', 'Saldo parcial', 'Misceláneos', 'Total gastos', 'Saldo semifinal', 'Ing. directos (calc.)', 'Transf. entr.', 'Transf. sal.', 'Saldo final', ''], rows,
      `<tr><td class="px-3 py-2">TOTALES</td>${td(pc(tp))}${td(money(sum(R, r => r.ing)))}${td('')}${td('')}${td('')}${td(money(sum(R, r => r.tg)))}${td('')}${td(money(sum(R, r => r.dir)))}${td(money(te))}${td(money(ts))}${td(money(sum(R, r => r.sf)))}${td('')}</tr>`);
}
