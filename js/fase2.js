/* fase2.js – Histórico N-1 (Plantilla 3). Fórmulas v2: remesa → ofrenda 100% → 60% + ingresos directos */
async function cargarP3(e) { try { S.f2.m = await leerExcel(e.target.files[0], 'p3'); } catch (x) { alert(x.message); } render(); }
function calc2() {
  const m = S.f2.m.map(r => {
    const rem = num(r.desglose_remesa_20) + num(r.desglose_remesa_16) + num(r.desglose_remesa_4) + num(r.desglose_remesa_ofg);   // Remesa 40 %
    const o100 = rem * 100 / 40, loc = o100 * 0.6, dir = num(r.ingresos_directos), o60 = loc + dir, gas = num(r.gastos);
    return { mes: r.mes, diez: num(r.diezmos), rem, o100, loc, dir, o60, gas, sal: o60 - gas };
  });
  const t = {}; ['diez', 'rem', 'o100', 'loc', 'dir', 'o60', 'gas', 'sal'].forEach(k => t[k] = sum(m, x => x[k]));
  return { m, t };
}
function f2() {
  const { m, t } = calc2(), z = zona('p3', 'cargarP3', m.length && m.length + ' meses', 'Plantilla 3 · Ejecución mensual ECLESIA 7 (año N-1)');
  if (!m.length) return z;
  return z + `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${card('Diezmos', money(t.diez), 'slate', 'Prom. mensual ' + money(t.diez / 12))}${card('Ofrenda 60% (con directos)', money(t.o60), 'sky', 'Prom. mensual ' + money(t.o60 / 12))}
    ${card('Gastos', money(t.gas), 'rose', 'Prom. mensual ' + money(t.gas / 12))}${card('Saldo anual neto', money(t.sal), t.sal >= 0 ? 'emerald' : 'red')}</div>` +
    tabla(['Mes', 'Diezmos', 'Remesa 40%', 'Ofrenda 100%', 'Ofrenda local 60%', 'Ing. directos', 'Ofrenda 60% mes', 'Gastos', 'Saldo mensual'],
      m.map(r => `<tr><td class="px-3 py-2 font-medium">${esc(r.mes)}</td>${td(money(r.diez))}${td(money(r.rem), 'text-slate-500')}${td(money(r.o100))}${td(money(r.loc), 'text-sky-800')}${td(money(r.dir))}${td(money(r.o60), 'font-semibold')}${td(money(r.gas), 'text-rose-700')}${td(money(r.sal), r.sal >= 0 ? 'text-emerald-700' : 'text-rose-700')}</tr>`).join(''),
      `<tr><td class="px-3 py-2">TOTAL ANUAL</td>${td(money(t.diez))}${td(money(t.rem))}${td(money(t.o100))}${td(money(t.loc))}${td(money(t.dir))}${td(money(t.o60))}${td(money(t.gas))}${td(money(t.sal))}</tr>`) +
    `<p class="text-xs text-slate-500">OFG se suma siempre a la remesa (0 si está vacío). <code>ofrenda_bruta</code> y <code>porcentaje_ofrendas</code> son opcionales: no intervienen en el cálculo (pendiente por confirmar).</p>`;
}
