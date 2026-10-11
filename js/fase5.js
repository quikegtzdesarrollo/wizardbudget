/* fase5.js – Pantalla resultante (Secciones 1-5) y exportación */
function calc5() {
  const c2 = calc2().t, pry = c2.o60 * (1 + S.f4.crec / 100);          // Proyección Ofrenda 60% N
  const rows = calc4().map(r => { const p = S.f5.pct[r.id] ?? r.pctN; return { ...r, pctC: p, gpp: pry * p / 100 }; });   // % Concilio es captura
  return { c2, pry, rows, tEst: sum(rows, r => r.est), tG: sum(rows, r => r.gpp), tP: sum(rows, r => r.pctC) };
}
const sec = (t, b) => `<section><h3 class="text-sm font-bold text-sda-900 uppercase mb-3 border-l-4 border-sda-900 pl-2">${t}</h3>${b}</section>`;
function f5() {
  const s = stats1(), c = calc5(), d = S.f5.dig, A = S.aN1, N = S.aN, ig = $('select-iglesia-activa')?.selectedOptions[0]?.text || '';
  const inc = c.c2.gas ? (c.tEst - c.c2.gas) / c.c2.gas * 100 : 0, mat = (a, m) => `${td(money(a))}${td(money(a / 12), 'text-slate-500')}`;
  const s1 = sec('Sección 1: Estadística', `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${card('# Miembros reales (Secretaría)', s.miembros)}${card('# Unidades financieras', s.uf)}${card('Miembros vinculados / Visitas', s.vinc + ' / ' + s.visitas, 'amber')}
    ${card('Unidades diezmantes', s.diez, 'emerald', `12m: ${s.dMes[0]} · 11m: ${s.dMes[1]} · 10m: ${s.dMes[2]}`)}${card('Unidades en dadivosidad', s.dad, 'sky', `12m: ${s.oMes[0]} · 11m: ${s.oMes[1]} · 10m: ${s.oMes[2]}`)}</div>`);
  const fila = (l, a, k) => `<tr><td class="px-3 py-2">${l}</td><td class="px-3 text-right font-mono">${a ?? '—'}</td><td class="px-3 text-right">${k ? inp('f5.dig.' + k, d[k], 'w-20') : ''}</td></tr>`;
  const s2 = sec(`Sección 2: Desafío de Fe ${N}`, tabla(['Campo', `Automático (${A})`, 'Captura manual'], 
    fila(`Miembros que diezmaron ${A}`, s.diez) + fila(`Miembros que ofrendaron ${A}`, s.dad) + fila(`Miembros que diezmarán ${N}`, null, 'dn') + fila(`Miembros que ofrendarán ${N}`, null, 'on') +
    fila('Aumentar # miembros en fidelidad', null, 'af') + fila('Aumentar # miembros en dadivosidad', null, 'ad')));
  const s3 = sec(`Sección 3: Proyección ${N}`, `<div class="grid lg:grid-cols-2 gap-4">
    ${tabla([`Proyección ${N}`, 'Anual', 'Mensual'], `<tr><td class="px-3 py-2">Ofrenda 60%</td>${mat(c.pry)}</tr><tr><td class="px-3 py-2">Gastos (Σ gasto por %)</td>${mat(c.tG)}</tr>`)}
    ${tabla([`Referencia ${A}`, 'Anual', 'Mensual'], `<tr><td class="px-3 py-2">Diezmos</td>${mat(c.c2.diez)}</tr><tr><td class="px-3 py-2">Ofrenda 60%</td>${mat(c.c2.o60)}</tr><tr><td class="px-3 py-2">Gastos</td>${mat(c.c2.gas)}</tr>`)}</div>
    <p class="text-sm mt-2">% incremento de gasto estimado vs ${A}: <strong>${pc(inc)}</strong> <span class="text-xs text-slate-500">(informativo)</span></p>`);
  const r4 = c.rows.map(r => `<tr><td class="px-3 py-2 font-medium">${esc(r.nombre)}</td>${td(pc(r.pct))}${td(money(r.est))}${td(pc(c.tEst ? r.est / c.tEst * 100 : 0))}${td(money(r.gpp), 'font-bold text-sky-900')}
    <td class="px-3 text-right"><span class="no-print">${inp('f5.pct.' + r.id, +r.pctC.toFixed(2), 'w-20')}</span></td></tr>`).join('');
  const s4 = sec(`Sección 4: Reestructuración de porcentajes · ${esc(ig)}`, tabla(['Departamento', `% asignado ${A}`, `Gasto estimado ${N}`, '% representativo', 'Gasto por % (Proy. × %)', 'Propuesta % Concilio (captura)'], r4,
    `<tr><td class="px-3 py-2">TOTALES</td>${td(pc(sum(c.rows, r => r.pct)))}${td(money(c.tEst))}${td('100.00%')}${td(money(c.tG))}${td(pc(c.tP))}</tr>`) +
    `<div class="mt-2">${alerta(Math.abs(c.tP - 100) < .01, `Σ Propuesta % Concilio = ${pc(c.tP)}`)}</div>` +
    (c.tG < c.tEst ? `<div class="mt-2">${alerta(false, `Total gasto estimado (${money(c.tEst)}) supera la proyección (${money(c.pry)}).`)}</div>` : ''));
  const firmas = `<section class="pt-6 border-t mt-8"><div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center text-xs">${['Pastor Distrital', 'Tesorero', 'Primer Anciano', 'Director de Mayordomía'].map(x => `<div class="border-t border-slate-400 pt-2 mt-12"><p class="font-bold">${x}</p><p class="text-slate-500">Firma / Sello</p></div>`).join('')}</div></section>`;
  // Sección 5: Saldos iniciales (fuera del PDF oficial hasta confirmar)
  const D = calc3(), g = (id, k) => S.f5.sb.d[id]?.[k] || 0, tj = sum(D, x => g(x.id, 'j'));
  const s5 = sec(`Sección 5: Saldos iniciales ${N}`, `<div class="flex flex-wrap gap-4 mb-3 text-sm items-center"><label>Fecha de corte ${inp('f5.sb.fecha', S.f5.sb.fecha, 'w-32', 1)}</label><label>Saldo base a distribuir ${inp('f5.sb.base', S.f5.sb.base, 'w-32')}</label></div>` +
    tabla(['Departamento', 'Saldo a fecha de corte', 'Ajustes', 'Nuevo saldo propuesto (Concilio)', '% aprobado Junta', 'Saldo aprobado Junta'],
      D.map(x => `<tr><td class="px-3 py-2 font-medium">${esc(x.nombre)}</td><td class="px-3 text-right">${inp(`f5.sb.d.${x.id}.c`, g(x.id, 'c'))}</td><td class="px-3 text-right">${inp(`f5.sb.d.${x.id}.a`, g(x.id, 'a'))}</td>${td(money(g(x.id, 'c') - g(x.id, 'a')))}
        <td class="px-3 text-right">${inp(`f5.sb.d.${x.id}.j`, g(x.id, 'j'), 'w-16')}</td>${td(money(S.f5.sb.base * g(x.id, 'j') / 100), 'font-bold')}</tr>`).join(''),
      `<tr><td class="px-3 py-2">TOTAL</td>${td(money(sum(D, x => g(x.id, 'c'))))}${td(money(sum(D, x => g(x.id, 'a'))))}${td(money(sum(D, x => g(x.id, 'c') - g(x.id, 'a'))))}${td(pc(tj))}${td(money(S.f5.sb.base * tj / 100))}</tr>`) +
    `<div class="mt-2">${alerta(Math.abs(tj - 100) < .01, Math.abs(tj - 100) < .01 ? 'Σ % aprobado = 100%.' : `Σ % aprobado = ${pc(tj)}; diferencia ${pc(100 - tj)}.`)}</div>`);
  return `<div class="flex flex-wrap gap-3 justify-between items-center border-b pb-3"><p class="text-sm text-slate-500">Resumen ejecutivo para la Junta de Iglesia y el Concilio de Mayordomía.</p>
    <div class="flex gap-3"><button onclick="exportarExcel()" class="keep px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50">📊 Descargar Excel</button>
    <button onclick="exportarPDF()" class="keep px-4 py-2 bg-sda-900 text-white rounded-lg text-sm font-semibold">📄 Exportar Reporte Oficial PDF</button></div></div>
    <div id="reporte" class="space-y-8 bg-white p-2"><div class="text-center"><h2 class="text-xl font-bold">Presupuesto Operativo Anual ${N}</h2><p class="text-sm text-slate-600">${esc(ig)} · Iglesia Adventista del Séptimo Día</p></div>${s1}${s2}${s3}${s4}${firmas}</div>${s5}`;
}
function exportarPDF() {
  const el = $('reporte'); el.querySelectorAll('.no-print').forEach(n => n.style.display = 'none');
  html2pdf().set({ margin: .4, filename: `Presupuesto_${S.aN}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } }).from(el).save()
    .then(() => el.querySelectorAll('.no-print').forEach(n => n.style.display = ''));
}
function exportarExcel() {
  const c = calc5(), s = stats1(), wb = XLSX.utils.book_new(), add = (n, a) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n);
  add('Estadística', [['Miembros', s.miembros], ['UF', s.uf], ['Vinculados', s.vinc], ['Visitas', s.visitas], ['UF diezmantes', s.diez], ['UF dadivosidad', s.dad]]);
  add('Histórico N-1', [['Mes', 'Diezmos', 'Ofrenda UF', 'Ofrenda Global', 'Ofrenda 100%', 'Ofrenda local 60%', 'Remesa 40%', 'Ing. directos', 'Ofrenda 60% mes', 'Gastos', 'Saldo'], ...calc2().m.map(r => [r.mes, r.diez, r.uf, r.ofg, r.o100, r.loc, r.rem, r.dir, r.o60, r.gas, r.sal])]);
  add('Proyección', [['Concepto', 'Anual', 'Mensual'], ['Ofrenda 60% N', c.pry, c.pry / 12], ['Gastos N', c.tG, c.tG / 12], ['Diezmos N-1', c.c2.diez, c.c2.diez / 12], ['Ofrenda 60% N-1', c.c2.o60, c.c2.o60 / 12], ['Gastos N-1', c.c2.gas, c.c2.gas / 12]]);
  add('Reestructuración', [['Departamento', '% anterior', 'Gasto estimado', '% representativo', 'Gasto por %', '% Concilio'], ...c.rows.map(r => [r.nombre, r.pct, r.est, c.tEst ? r.est / c.tEst * 100 : 0, r.gpp, r.pctC])]);
  add('Saldos iniciales', [['Departamento', 'Saldo corte', 'Ajustes', 'Nuevo propuesto', '% Junta', 'Saldo aprobado'], ...calc3().map(x => { const d = S.f5.sb.d[x.id] || {}; return [x.nombre, d.c || 0, d.a || 0, (d.c || 0) - (d.a || 0), d.j || 0, S.f5.sb.base * (d.j || 0) / 100]; })]);
  XLSX.writeFile(wb, `Presupuesto_${S.aN}.xlsx`);
}
