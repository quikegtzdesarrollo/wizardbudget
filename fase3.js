/* fase3.js – Catálogo departamental, % asignado y cadena de saldos (captura manual, sin plantilla) */
function calc3() {
  const o60 = calc2().t.o60;
  return S.f3.deps.map((d, i) => { if (!d.activo) return null;
    const ing = o60 * d.pct / 100, tg = d.gasto + d.misc;
    return { ...d, i, ing, tg, sp: ing - d.gasto, ss: ing - tg, sf: ing - tg + d.dir + d.ent - d.sal }; }).filter(Boolean);
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
function f3() {
  const R = calc3(), tp = sum(R, r => r.pct), te = sum(R, r => r.ent), ts = sum(R, r => r.sal);
  const cat = `<details class="border border-slate-200 rounded-xl p-3"><summary class="cursor-pointer text-sm font-semibold">Catálogo de departamentos (activar / desactivar / agregar)</summary>
    <div class="mt-3 flex flex-wrap gap-3">${S.f3.deps.map((d, i) => `<label class="text-sm flex items-center gap-1"><input type="checkbox" ${d.activo ? 'checked' : ''} onchange="toggleDep(${i},this.checked)">${esc(d.nombre)}</label>`).join('')}</div>
    <div class="mt-3 flex gap-2"><input id="nuevo-dep" placeholder="Nuevo departamento…" class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"><button onclick="agregarDep()" class="px-3 py-1.5 bg-sda-900 text-white text-sm font-semibold rounded-lg">+ Agregar</button></div></details>`;
  const rows = R.map(d => `<tr><td class="px-3 py-2 font-medium">${esc(d.nombre)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.pct`, d.pct, 'w-16')}</td>${td(money(d.ing), 'text-sky-800')}
    <td class="px-3 text-right">${inp(`f3.deps.${d.i}.gasto`, d.gasto)}</td>${td(money(d.sp))}<td class="px-3 text-right">${inp(`f3.deps.${d.i}.misc`, d.misc)}</td>${td(money(d.tg), 'text-rose-700')}${td(money(d.ss))}
    <td class="px-3 text-right">${inp(`f3.deps.${d.i}.dir`, d.dir)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.ent`, d.ent)}</td><td class="px-3 text-right">${inp(`f3.deps.${d.i}.sal`, d.sal)}</td>
    ${td(money(d.sf), 'font-bold bg-sky-50 ' + (d.sf >= 0 ? 'text-emerald-700' : 'text-rose-700'))}</tr>`).join('');
  return cat + alerta(Math.abs(tp - 100) < .01, `Σ % asignado = ${pc(tp)} ${Math.abs(tp - 100) < .01 ? '' : '(debe ser 100%)'}`) +
    alerta(Math.abs(te - ts) < .01, Math.abs(te - ts) < .01 ? 'Transferencias entrantes y salientes balanceadas.' : `Entrantes (${money(te)}) ≠ Salientes (${money(ts)}).`) +
    (calc2().t.o60 ? '' : alerta(false, 'Aún no hay Ofrenda 60% anual: carga la Fase 2 para calcular los Ingresos.')) +
    tabla(['Departamento', '% Asig.', 'Ingresos (60%)', 'Gasto', 'Saldo parcial', 'Misceláneos', 'Total gastos', 'Saldo semifinal', 'Ing. directos', 'Transf. entr.', 'Transf. sal.', 'Saldo final'], rows,
      `<tr><td class="px-3 py-2">TOTALES</td>${td(pc(tp))}${td(money(sum(R, r => r.ing)))}${td('')}${td('')}${td('')}${td(money(sum(R, r => r.tg)))}${td('')}${td('')}${td(money(te))}${td(money(ts))}${td(money(sum(R, r => r.sf)))}</tr>`);
}
