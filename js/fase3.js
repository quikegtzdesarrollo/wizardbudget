/* fase3.js – Catálogo departamental, carga por plantilla (Plantilla 5), % asignado y cadena de saldos.
   Ingresos (60%)  = Ofrenda local 60% anual × % asignado          (sin ingresos directos)
   Ing. directos   = Total de ingresos directos (Fase 2) × % asignado   (se calcula, no se captura) */
function calc3() {
  const t = calc2().t;
  return S.f3.deps.map((d, i) => { if (!d.activo) return null;
    const ing = t.loc * d.pct / 100, dir = t.dir * d.pct / 100, tg = d.gasto + d.misc;
    return { ...d, i, ing, dir, tg, sp: ing - d.gasto, ss: ing - tg, sf: ing - tg + dir + d.ent - d.sal }; }).filter(Boolean);
}
async function agregarDep() {
  const n = $('nuevo-dep').value.trim(); if (!n) return alert('Ingresa el nombre del departamento.');
  const { data, error } = await supabaseClient.from('departamentos').insert({ iglesia_id: S.iglesia, nombre: n }).select('id,nombre').single();
  if (error) return alert(error.code === '23505' ? 'Ya existe un departamento con ese nombre.' : error.message);
  S.f3.deps.push(nuevoDep(data.id, data.nombre)); render();
}
async function toggleDep(i, v) {
  const { error } = await supabaseClient.from('departamentos').update({ activo: v }).eq('id', S.f3.deps[i].id);
  if (error) return alert(error.message);
  S.f3.deps[i].activo = v; render();
}

/** Carga la Plantilla 5 POR ORDEN DE FILA: fila 1 = primer departamento activo de la pantalla, fila 2 = el segundo, etc. */
async function cargarP5(e) {
  try {
    const rows = await leerExcel(e.target.files[0], 'p5'), act = S.f3.deps.filter(d => d.activo);
    const campos = ['porcentaje_asignado', 'gasto', 'miscelaneos', 'transferencias_entrada', 'transferencias_salida'];
    const esNum = v => v === '' || v == null || typeof v === 'number' || !isNaN(parseFloat(String(v).replace(/[$,\s]/g, '')));
    const mal = rows.flatMap((r, i) => campos.filter(c => !esNum(r[c])).map(c => `fila ≈ ${i + 2} (${c} = "${r[c]}")`));
    if (mal.length) throw new Error(`Hay ${mal.length} valor(es) que no son números. Primer caso: ${mal[0]}.`);
    const n = Math.min(rows.length, act.length), avisos = [];
    if (rows.length !== act.length) avisos.push(`El archivo trae ${rows.length} fila(s) y la pantalla tiene ${act.length} departamento(s) activo(s). Se cargarán las primeras ${n} por orden.`);
    const dif = rows.slice(0, n).map((r, i) => [i + 2, r.departamento, act[i].nombre]).filter(([, a, b]) => String(a ?? '').trim() !== '' && norm(a) !== norm(b));
    if (dif.length) avisos.push(`El departamento de control no coincide con el de la pantalla en ${dif.length} fila(s). Ejemplo, fila ${dif[0][0]}: archivo "${dif[0][1]}" y pantalla "${dif[0][2]}". Recuerda que la carga es por ORDEN de fila, no por nombre.`);
    if (avisos.length && !confirm(avisos.join('\n\n') + '\n\n¿Cargar de todos modos?')) return;
    rows.slice(0, n).forEach((r, i) => Object.assign(act[i], { pct: num(r.porcentaje_asignado), gasto: num(r.gasto), misc: num(r.miscelaneos), ent: num(r.transferencias_entrada), sal: num(r.transferencias_salida) }));
    S.f3.carga = n;
  } catch (x) { alert(x.message); }
  render();
}

function f3() {
  const R = calc3(), t2 = calc2().t, tp = sum(R, r => r.pct), te = sum(R, r => r.ent), ts = sum(R, r => r.sal);
  const cat = `<details class="border border-slate-200 rounded-xl p-3"><summary class="cursor-pointer text-sm font-semibold">Catálogo de departamentos (activar / desactivar / agregar)</summary>
    <div class="mt-3 flex flex-wrap gap-3">${S.f3.deps.map((d, i) => `<label class="text-sm flex items-center gap-1"><input type="checkbox" ${d.activo ? 'checked' : ''} onchange="toggleDep(${i},this.checked)">${esc(d.nombre)}</label>`).join('')}</div>
    <div class="mt-3 flex gap-2"><input id="nuevo-dep" placeholder="Nuevo departamento…" class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"><button onclick="agregarDep()" class="px-3 py-1.5 bg-sda-900 text-white text-sm font-semibold rounded-lg">+ Agregar</button></div></details>`;
  const carga = zona('p5', 'cargarP5', S.f3.carga && S.f3.carga + ' departamentos cargados', 'Plantilla 5 · % asignado, gasto, misceláneos y transferencias por departamento') +
    `<p class="text-xs text-slate-500 -mt-3">⚠ La carga es por <strong>orden de fila</strong>: la fila 1 del archivo corresponde al primer departamento activo de la tabla, la fila 2 al segundo, y así sucesivamente. La plantilla se descarga ya con los departamentos en el orden actual. Después de cargar, puedes seguir editando los valores en la tabla.</p>`;
  const rows = R.map(d => `<tr><td class="px-3 py-2 font-medium">${esc(d.nombre)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.pct`, d.pct, 'w-16')}</td>${td(money(d.ing), 'text-sky-800')}
    <td class="px-3 text-right">${inp(`f3.deps.${d.i}.gasto`, d.gasto)}</td>${td(money(d.sp))}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.misc`, d.misc)}</td>${td(money(d.tg), 'text-rose-700')}${td(money(d.ss))}
    ${td(money(d.dir), 'text-sky-800')}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.ent`, d.ent)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.sal`, d.sal)}</td>
    ${td(money(d.sf), 'font-bold bg-sky-50 ' + (d.sf >= 0 ? 'text-emerald-700' : 'text-rose-700'))}</tr>`).join('');
  return cat + carga + alerta(Math.abs(tp - 100) < .01, `Σ % asignado = ${pc(tp)} ${Math.abs(tp - 100) < .01 ? '' : '(debe ser 100%)'}`) +
    alerta(Math.abs(te - ts) < .01, Math.abs(te - ts) < .01 ? 'Transferencias entrantes y salientes balanceadas.' : `Entrantes (${money(te)}) ≠ Salientes (${money(ts)}).`) +
    (t2.loc ? `<p class="text-xs text-slate-500">Base de reparto: Ofrenda local 60% anual ${money(t2.loc)} (Ingresos) e ingresos directos totales ${money(t2.dir)} (Ing. directos, calculados), ambos × % asignado.</p>` : alerta(false, 'Aún no hay datos de la Fase 2: carga la ejecución mensual para calcular Ingresos e Ing. directos.')) +
    tabla(['Departamento', '% Asig.', 'Ingresos (60%)', 'Gasto', 'Saldo parcial', 'Misceláneos', 'Total gastos', 'Saldo semifinal', 'Ing. directos (calc.)', 'Transf. entr.', 'Transf. sal.', 'Saldo final'], rows,
      `<tr><td class="px-3 py-2">TOTALES</td>${td(pc(tp))}${td(money(sum(R, r => r.ing)))}${td('')}${td('')}${td('')}${td(money(sum(R, r => r.tg)))}${td('')}${td(money(sum(R, r => r.dir)))}${td(money(te))}${td(money(ts))}${td(money(sum(R, r => r.sf)))}</tr>`);
}
