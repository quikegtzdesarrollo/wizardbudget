/* bienvenida.js – Pantalla de bienvenida: tutorial interactivo de las 5 fases y selección de perfil e iglesia.
   Quien aún no tiene acceso solo puede: elegir su perfil e iglesia (pantalla oscurecida) y ver este recorrido. */
const svg = (p, c = 'w-6 h-6') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  f1: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.7 5 5.8"/>',
  f2: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="8" rx="1"/><rect x="10.5" y="5" width="3" height="14" rx="1"/><rect x="16" y="14" width="3" height="5" rx="1"/>',
  f3: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  f4: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  f5: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  pastor: '<path d="M12 3v18M6.5 9h11"/>',
  tesorero: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.5-.9-1.4-1.3-2.5-1.3-1.5 0-2.5.8-2.5 1.9 0 2.7 5 1.3 5 4 0 1.1-1 1.9-2.5 1.9-1.1 0-2-.4-2.5-1.3M12 6.5v1.7M12 15.8v1.7"/>',
  director_mayordomia: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.2C19.5 15.4 12 20 12 20z"/>',
  anciano_asesor: '<path d="M12 3l7.5 3v5.5c0 4.7-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.8-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'
};
const TUT = [
  { n: 1, t: 'Feligresía y UF', lema: 'Reconoce a tu congregación',
    que: ['Sube la lista de Secretaría y el reporte de ECLESIA 7.', 'El sistema agrupa a cada miembro en su unidad financiera (UF); tú ajustas lo que haga falta.', 'Guarda la agrupación: se recordará en los próximos presupuestos.'],
    sube: ['Plantilla 1 · Secretaría', 'Plantilla 2 · ECLESIA 7'], da: 'Miembros agrupados, visitas y UF diezmantes o en dadivosidad.' },
  { n: 2, t: 'Análisis histórico', lema: 'Mira cómo te fue el año anterior',
    que: ['Sube la ejecución mensual: diezmos, gastos, ofrenda de las UF, ofrenda global e ingresos directos.', 'La ofrenda total se divide 60/40: el 60% se queda en la iglesia y el 40% va a la asociación.', 'Los ingresos directos se suman aparte.'],
    sube: ['Plantilla 3 · Ejecución mensual'], da: 'Totales anuales, saldo del año y la base para repartir entre departamentos.' },
  { n: 3, t: 'Departamentos', lema: 'Reparte entre tus ministerios',
    que: ['Carga todos los departamentos actuales con su % asignado, gasto, misceláneos y transferencias.', 'Si el próximo año habrá un departamento nuevo, inclúyelo aunque sea en ceros.', 'Los ingresos se calculan solos según el % de cada uno.'],
    sube: ['Plantilla 5 · Departamentos'], da: 'Saldo final de cada departamento y validación de porcentajes y transferencias.' },
  { n: 4, t: 'Ajustes e inflación', lema: 'Planea el nuevo año',
    que: ['Define la inflación y el crecimiento esperado.', 'Sube el plan de actividades: lo que cada departamento quiere gastar.', 'El sistema marca en rojo lo que pasa del límite indexado; tú decides el monto aprobado.'],
    sube: ['Plantilla 4 · Actividades por departamento'], da: 'Montos aprobados y nuevos porcentajes por departamento.' },
  { n: 5, t: 'Reporte final', lema: 'Presenta y aprueba',
    que: ['Revisa la estadística, el desafío de fe, la proyección y la reestructuración de porcentajes.', 'Captura la propuesta del Concilio y los saldos iniciales.', 'Descarga el Excel o el PDF y envía el presupuesto a revisión para su aprobación.'],
    sube: [], da: 'Reporte oficial listo para la Junta y el Concilio de Mayordomía.' }
];
let tutI = 0, selPerfil = null, selIglesia = '', modalCancelable = false;

function mostrarBienvenida() {
  ir('view-bienvenida'); tutI = 0; renderBienvenida(); renderTutorial();
  const c = contextoSesion;
  if (c.acceso === 'pendiente' && !(c.solicitud?.perfil && c.solicitud?.iglesia_id)) abrirModalPerfil(false);   // primera vez: pantalla oscurecida
}

function renderBienvenida() {
  const c = contextoSesion, u = usuarioSesion, act = c.acceso === 'activo', s = c.solicitud || {};
  $('bv-nombre').textContent = u.nombre || u.email;
  $('bv-rol').textContent = act ? (ROLES[u.rol] || u.rol).toUpperCase() : c.acceso === 'inactivo' ? 'ACCESO DESACTIVADO' : 'ACCESO PENDIENTE';
  const caja = (cls, html) => `<div class="p-4 rounded-xl border text-sm ${cls}">${html}</div>`;
  let est, acc = '';
  if (act) {
    est = caja('bg-emerald-50 border-emerald-200 text-emerald-900', `✅ Tienes acceso como <strong>${ROLES[u.rol]}</strong>${u.rol === 'superadmin' ? '' : ` · Iglesia(s): ${c.iglesias.map(i => esc(i.nombre)).join(', ')}`}.`);
    acc = `<button onclick="entrarAsistente()" class="px-6 py-3 rounded-xl bg-sda-900 text-white font-semibold shadow-lg hover:bg-sda-800 transition">Entrar al asistente →</button>` +
      (u.rol === 'superadmin' ? `<button onclick="abrirAdmin()" class="px-6 py-3 rounded-xl bg-white border border-slate-300 font-semibold hover:bg-slate-50 transition">👥 Administración de usuarios</button>` : '');
  } else if (c.acceso === 'inactivo') {
    est = caja('bg-red-50 border-red-200 text-red-900', '⛔ Tu acceso está desactivado. Contacta al administrador del sistema.');
  } else {
    est = caja('bg-amber-50 border-amber-300 text-amber-900', s.perfil && s.iglesia_id
      ? `⏳ <strong>Tu solicitud está pendiente.</strong> Perfil: <strong>${ROLES[s.perfil]}</strong> · Iglesia: <strong>${esc(s.iglesia_nombre || '')}</strong>. Un administrador revisará tu acceso; mientras tanto puedes conocer el recorrido de abajo.`
      : '⏳ Para solicitar acceso, elige tu perfil y tu iglesia.');
    acc = `<button onclick="verificarEstadoSesion()" class="px-5 py-2.5 rounded-xl bg-sda-900 text-white font-semibold hover:bg-sda-800 transition">↻ Verificar acceso</button>
           <button onclick="abrirModalPerfil(true)" class="px-5 py-2.5 rounded-xl bg-white border border-slate-300 font-semibold hover:bg-slate-50 transition">Cambiar mi selección</button>`;
  }
  $('bv-estado').innerHTML = est; $('bv-acciones').innerHTML = acc;
}

/* ---------- tutorial interactivo ---------- */
function tutIr(i) { tutI = Math.max(0, Math.min(TUT.length - 1, i)); renderTutorial(); }
const tutSig = () => tutIr(tutI + 1), tutAnt = () => tutIr(tutI - 1);
function renderTutorial() {
  const f = TUT[tutI], pct = tutI / (TUT.length - 1) * 80;
  const nodos = TUT.map((x, i) => `<button onclick="tutIr(${i})" class="relative z-10 w-1/5 flex flex-col items-center group" aria-label="Fase ${x.n}: ${x.t}">
      <span class="w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${i === tutI ? 'bg-sda-900 text-white border-sky-300 scale-125 shadow-lg tut-pulso' : i < tutI ? 'bg-sda-600 text-white border-white' : 'bg-white text-slate-400 border-slate-200 group-hover:border-sky-300'}">${svg(IC['f' + x.n], 'w-5 h-5')}</span>
      <span class="mt-3 text-[11px] sm:text-xs font-semibold text-center ${i === tutI ? 'text-sda-900' : 'text-slate-500'}">${x.t}</span></button>`).join('');
  const puntos = TUT.map((_, i) => `<span class="w-2 h-2 rounded-full transition-all ${i === tutI ? 'bg-sda-900 w-5' : 'bg-slate-300'}"></span>`).join('');
  $('bv-tutorial').innerHTML = `<div class="bg-white/90 rounded-2xl shadow-xl border border-slate-200 p-5 sm:p-8">
    <div class="relative flex justify-between pb-2"><div class="absolute top-6 left-[10%] right-[10%] h-1 bg-slate-200 rounded"></div><div class="absolute top-6 left-[10%] h-1 bg-sda-600 rounded transition-all duration-500" style="width:${pct}%"></div>${nodos}</div>
    <div class="tut-fade mt-8 grid md:grid-cols-5 gap-6">
      <div class="md:col-span-2 flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-br from-sda-900 to-sda-600 text-white">
        <span class="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center">${svg(IC['f' + f.n], 'w-11 h-11')}</span>
        <p class="mt-4 text-xs uppercase tracking-widest text-sky-200">Fase ${f.n} de ${TUT.length}</p><h3 class="text-2xl font-bold mt-1">${f.t}</h3><p class="text-sky-100 mt-2">${f.lema}</p></div>
      <div class="md:col-span-3 space-y-4">
        <div><h4 class="text-sm font-bold text-slate-700 mb-2">Qué haces aquí</h4><ul class="space-y-2">${f.que.map(q => `<li class="flex gap-2 text-sm text-slate-600"><span class="mt-0.5 text-emerald-500">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'w-4 h-4')}</span>${q}</li>`).join('')}</ul></div>
        ${f.sube.length ? `<div><h4 class="text-sm font-bold text-slate-700 mb-2">Qué subes</h4><div class="flex flex-wrap gap-2">${f.sube.map(s => `<span class="px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold">⬆ ${s}</span>`).join('')}</div></div>` : ''}
        <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900"><strong>Qué obtienes:</strong> ${f.da}</div></div></div>
    <div class="mt-6 flex items-center justify-between"><button onclick="tutAnt()" ${tutI ? '' : 'disabled'} class="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40">← Anterior</button>
      <div class="flex items-center gap-1.5">${puntos}</div>
      <button onclick="tutSig()" ${tutI < TUT.length - 1 ? '' : 'disabled'} class="px-4 py-2 rounded-lg bg-sda-900 text-white text-sm font-semibold hover:bg-sda-800 disabled:opacity-40">Siguiente →</button></div></div>`;
}
document.addEventListener('keydown', e => {
  const v = $('view-bienvenida'); if (!v || v.classList.contains('hidden') || !$('modal-perfil').classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') tutSig(); if (e.key === 'ArrowLeft') tutAnt();
});

/* ---------- selección de perfil e iglesia (pantalla oscurecida) ---------- */
function abrirModalPerfil(cancelable) {
  const s = contextoSesion.solicitud || {}; selPerfil = s.perfil || null; selIglesia = s.iglesia_id || ''; modalCancelable = !!cancelable;
  renderModalPerfil(); $('modal-perfil').classList.remove('hidden'); document.body.classList.add('overflow-hidden');
}
function cerrarModalPerfil() { $('modal-perfil').classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }
function renderModalPerfil() {
  const cat = contextoSesion.catalogo_iglesias || [];
  const tarjetas = PERFILES.map(p => `<button type="button" onclick="selPerfil='${p}';renderModalPerfil()" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${selPerfil === p ? 'border-sda-600 bg-sky-50 text-sda-900 ring-2 ring-sky-300 scale-[1.03]' : 'border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-slate-50'}">${svg(IC[p], 'w-8 h-8')}<span class="text-sm font-semibold text-center">${ROLES[p]}</span></button>`).join('');
  $('modal-perfil').innerHTML = `<div class="tut-fade bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 sm:p-8 space-y-5">
    <div class="text-center"><div class="mx-auto w-14 h-14 rounded-full bg-sda-900 text-white flex items-center justify-center">${svg(IC.f1, 'w-7 h-7')}</div>
      <h2 class="mt-3 text-xl font-bold text-slate-900">Antes de comenzar</h2><p class="text-sm text-slate-500">Cuéntanos quién eres para solicitar tu acceso al sistema.</p></div>
    <div><p class="text-sm font-semibold text-slate-700 mb-2">1. ¿Cuál es tu perfil?</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${tarjetas}</div></div>
    <div><p class="text-sm font-semibold text-slate-700 mb-2">2. ¿A qué iglesia perteneces?</p>
      ${cat.length ? `<select onchange="selIglesia=this.value;renderModalPerfil()" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="">— Selecciona tu iglesia —</option>${cat.map(i => `<option value="${i.id}" ${i.id === selIglesia ? 'selected' : ''}>${esc(i.nombre)}</option>`).join('')}</select>`
        : '<p class="text-sm text-amber-700">Aún no hay iglesias registradas. Contacta al administrador del sistema.</p>'}</div>
    <div class="flex justify-end gap-3 pt-2">${modalCancelable ? '<button onclick="cerrarModalPerfil()" class="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50">Cancelar</button>' : ''}
      <button onclick="confirmarPerfil()" ${selPerfil && selIglesia ? '' : 'disabled'} class="px-5 py-2 rounded-lg bg-sda-900 text-white text-sm font-semibold hover:bg-sda-800 disabled:opacity-40 disabled:cursor-not-allowed">Continuar →</button></div></div>`;
}
async function confirmarPerfil() {
  const { error } = await supabaseClient.rpc('guardar_solicitud', { p_perfil: selPerfil, p_iglesia: selIglesia });
  if (error) return alert('No se pudo guardar tu selección: ' + error.message);
  const ig = (contextoSesion.catalogo_iglesias || []).find(i => i.id === selIglesia);
  contextoSesion.solicitud = { perfil: selPerfil, iglesia_id: selIglesia, iglesia_nombre: ig?.nombre || '' };
  cerrarModalPerfil(); renderBienvenida();
}
