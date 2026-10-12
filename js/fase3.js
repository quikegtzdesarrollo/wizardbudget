/* fase3.js – Presupuesto por departamento. NO hay catálogo guardado: los departamentos (nombre y valores) vienen de la Plantilla 5 o se agregan a mano,
   y de aquí pasan a la Fase 4 para los ajustes.
   Ingresos (60%)  = Ofrenda local 60% anual × % asignado                (sin ingresos directos)
   Ing. directos   = Total de ingresos directos (Fase 2) × % asignado     (se calcula, no se captura) */
function calc3() {
  const t = calc2().t;
  return S.f3.deps.map((d, i) => {
    const ing = t.loc * d.pct / 100, dir = t.dir * d.pct / 100, tg = d.gasto + d.misc;
    return { ...d, i, ing, dir, tg, sp: ing - d.gasto, ss: ing - tg, sf: ing - tg + dir + d.ent - d.sal };
  });
}
function agregarDep() {
  const n = $('nuevo-dep').value.trim(); if (!n) return alert('Ingresa el nombre del departamento.');
  if (S.f3.deps.some(d => d.id === idDep(n))) return alert('Ya existe un departamento con ese nombre.');
  S.f3.deps.push(nuevoDep(idDep(n), n)); render();
}
function quitarDep(i) { if (confirm(`¿Quitar "${S.f3.deps[i].nombre}" de la lista?`)) { S.f3.deps.splice(i, 1); render(); } }

/** Carga la Plantilla 5: cada fila es un departamento (nombre + valores). Reemplaza la lista actual. */
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
    if (S.f3.deps.length && !confirm(`⚠ Se reemplazará TODA la lista actual (${S.f3.deps.length} departamento(s), incluidos los cambios hechos a mano en la pantalla) por los ${rows.length} departamento(s) del archivo.\n\n¿Continuar?`)) return;
    S.f3.deps = rows.map(r => ({ ...nuevoDep(idDep(r.departamento), String(r.departamento).trim()), pct: num(r.porcentaje_asignado), gasto: num(r.gasto),
      misc: num(r.miscelaneos), ent: num(r.transferencias_entrada), sal: num(r.transferencias_salida) }));
    S.f3.carga = rows.length;
  } catch (x) { alert(x.message); }
  render();
}

function f3() {
  const R = calc3(), t2 = calc2().t, tp = sum(R, r => r.pct), te = sum(R, r => r.ent), ts = sum(R, r => r.sal);
  const aviso = `<div class="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">⚠ <strong>Carga TODOS los departamentos actuales</strong> de la iglesia. Si el próximo año habrá un departamento nuevo, inclúyelo también, aunque sea con ceros: no tuvo presupuesto ni movimientos en el año actual. Los nombres se cargan desde el archivo (no se guarda un catálogo) y estos mismos departamentos pasan a la Fase 4 para los ajustes.</div>`;
  const carga = aviso + zona('p5', 'cargarP5', S.f3.carga && S.f3.carga + ' departamentos cargados', 'Plantilla 5 · Departamentos: % asignado, gasto, misceláneos y transferencias') +
    `<div class="flex gap-2 items-center"><input id="nuevo-dep" placeholder="Agregar departamento a mano…" class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"><button onclick="agregarDep()" class="px-3 py-1.5 bg-sda-900 text-white text-sm font-semibold rounded-lg">+ Agregar</button><span class="text-xs text-slate-500">Después de cargar puedes seguir editando los valores en la tabla.</span></div>`;
  if (!R.length) return carga + `<p class="text-sm text-slate-500">Aún no hay departamentos. Carga la Plantilla 5 para comenzar.</p>`;
  const rows = R.map(d => `<tr><td class="px-3 py-2 font-medium">${esc(d.nombre)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.pct`, d.pct, 'w-16')}</td>${td(money(d.ing), 'text-sky-800')}
    <td class="px-3 text-right">${inp(`f3.deps.${d.i}.gasto`, d.gasto)}</td>${td(money(d.sp))}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.misc`, d.misc)}</td>${td(money(d.tg), 'text-rose-700')}${td(money(d.ss))}
    ${td(money(d.dir), 'text-sky-800')}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.ent`, d.ent)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.sal`, d.sal)}</td>
    ${td(money(d.sf), 'font-bold bg-sky-50 ' + (d.sf >= 0 ? 'text-emerald-700' : 'text-rose-700'))}<td class="px-3 text-center"><button onclick="quitarDep(${d.i})" class="text-rose-600" title="Quitar de la lista">×</button></td></tr>`).join('');
  return carga + alerta(Math.abs(tp - 100) < .01, `Σ % asignado = ${pc(tp)} ${Math.abs(tp - 100) < .01 ? '' : '(debe ser 100%)'}`) +
    alerta(Math.abs(te - ts) < .01, Math.abs(te - ts) < .01 ? 'Transferencias entrantes y salientes balanceadas.' : `Entrantes (${money(te)}) ≠ Salientes (${money(ts)}).`) +
    (t2.loc ? `<p class="text-xs text-slate-500">Base de reparto: Ofrenda local 60% anual ${money(t2.loc)} (Ingresos) e ingresos directos totales ${money(t2.dir)} (Ing. directos, calculados), ambos × % asignado.</p>` : alerta(false, 'Aún no hay datos de la Fase 2: carga la ejecución mensual para calcular Ingresos e Ing. directos.')) +
    tabla(['Departamento', '% Asig.', 'Ingresos (60%)', 'Gasto', 'Saldo parcial', 'Misceláneos', 'Total gastos', 'Saldo semifinal', 'Ing. directos (calc.)', 'Transf. entr.', 'Transf. sal.', 'Saldo final', ''], rows,
      `<tr><td class="px-3 py-2">TOTALES</td>${td(pc(tp))}${td(money(sum(R, r => r.ing)))}${td('')}${td('')}${td('')}${td(money(sum(R, r => r.tg)))}${td('')}${td(money(sum(R, r => r.dir)))}${td(money(te))}${td(money(ts))}${td(money(sum(R, r => r.sf)))}${td('')}</tr>`);
}
