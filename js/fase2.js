/* fase2.js – Histórico N-1 (Plantilla 3). Fórmulas v2: remesa → ofrenda 100% → 60% + ingresos directos */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nMes = v => { const x = norm(v), i = MESES.indexOf(x === 'setiembre' ? 'septiembre' : x); return i >= 0 ? i + 1 : (String(v).trim() !== '' && Number.isInteger(+v) ? +v : NaN); };
async function cargarP3(e) {
  try {
    const rows = await leerExcel(e.target.files[0], 'p3'), ms = rows.map(r => nMes(r.mes));
    const bad = ms.findIndex(m => !(m >= 1 && m <= 12)); if (bad >= 0) throw new Error(`Mes no válido en la fila ≈ ${bad + 2} ("${rows[bad].mes}"). Usa 1 a 12 o el nombre del mes.`);
    const dup = ms.find((m, i) => ms.indexOf(m) !== i); if (dup) throw new Error(`El mes ${dup} aparece más de una vez.`);
    S.f2.m = rows.map((r, i) => ({ ...r, mes: ms[i] })).sort((a, b) => a.mes - b.mes);
  } catch (x) { alert(x.message); }
  render();
}
function calc2() {
  const m = S.f2.m.map(r => {
    const r40 = num(r.remesa_40), ofg = num(r.remesa_ofg ?? r.ofg);
    const r20 = r40 * 0.5, r16 = r40 * 0.4, r4 = r40 * 0.1;                          // desglose calculado: solo para mostrar
    const o100 = r40 * 2.5 + ofg, rem = o100 * 0.4;                                  // Ofrenda total = remesa_40 ÷ 0.4 + OFG completo; remesa = 40% de todo
    const loc = o100 * 0.6, dir = num(r.ingresos_directos), o60 = loc + dir, gas = num(r.gastos);   // los ingresos directos NO se dividen
    return { mes: r.mes, diez: num(r.diezmos), r20, r16, r4, ofg, rem, o100, loc, dir, o60, gas, sal: o60 - gas };
  });
  const t = {}; ['diez', 'r20', 'r16', 'r4', 'ofg', 'rem', 'o100', 'loc', 'dir', 'o60', 'gas', 'sal'].forEach(k => t[k] = sum(m, x => x[k]));
  return { m, t };
}
function f2() {
  const { m, t } = calc2(), z = zona('p3', 'cargarP3', m.length && m.length + ' meses', 'Plantilla 3 · Ejecución mensual ECLESIA 7 (año N-1)');
  if (!m.length) return z;
  const falt = MESES.map((_, i) => i + 1).filter(n => !m.some(r => r.mes === n));
  return z + (falt.length ? alerta(false, `Faltan meses en el archivo: ${falt.map(n => MESES[n - 1]).join(', ')}. Los promedios mensuales siempre se calculan entre 12.`) : '') + `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${card('Diezmos', money(t.diez), 'slate', 'Prom. mensual ' + money(t.diez / 12))}${card('Ofrenda 60% (con directos)', money(t.o60), 'sky', 'Prom. mensual ' + money(t.o60 / 12))}
    ${card('Gastos', money(t.gas), 'rose', 'Prom. mensual ' + money(t.gas / 12))}${card('Saldo anual neto', money(t.sal), t.sal >= 0 ? 'emerald' : 'red')}</div>` +
    tabla(['Mes', 'Diezmos', 'Remesa 20%', 'Remesa 16%', 'Remesa 4%', 'OFG (depósito)', 'Remesa total (40%)', 'Ofrenda 100%', 'Ofrenda local 60%', 'Ing. directos', 'Ofrenda 60% mes', 'Gastos', 'Saldo mensual'],
      m.map(r => `<tr><td class="px-3 py-2 font-medium">${esc(r.mes)}</td>${td(money(r.diez))}${td(money(r.r20), 'text-slate-500')}${td(money(r.r16), 'text-slate-500')}${td(money(r.r4), 'text-slate-500')}${td(money(r.ofg), 'text-slate-500')}${td(money(r.rem))}${td(money(r.o100))}${td(money(r.loc), 'text-sky-800')}${td(money(r.dir))}${td(money(r.o60), 'font-semibold')}${td(money(r.gas), 'text-rose-700')}${td(money(r.sal), r.sal >= 0 ? 'text-emerald-700' : 'text-rose-700')}</tr>`).join(''),
      `<tr><td class="px-3 py-2">TOTAL ANUAL</td>${td(money(t.diez))}${td(money(t.r20))}${td(money(t.r16))}${td(money(t.r4))}${td(money(t.ofg))}${td(money(t.rem))}${td(money(t.o100))}${td(money(t.loc))}${td(money(t.dir))}${td(money(t.o60))}${td(money(t.gas))}${td(money(t.sal))}</tr>`) +
    `<p class="text-xs text-slate-500">Ofrenda 100% = remesa_40 × 2.5 + OFG, y todo se divide 60/40 (60% se queda en la iglesia, 40% va a la asociación). Remesa 20%, 16% y 4% se calculan del remesa_40 (50 %, 40 % y 10 %) y solo se muestran. Los ingresos directos no se dividen 60/40: entran directo a un departamento y se suman aparte.</p>`;
}
