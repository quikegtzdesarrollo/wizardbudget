/* admin.js – Módulo del superadmin: personas que han iniciado sesión, y alta / edición de su acceso (rol e iglesias). */
const ADM = { usuarios: [], iglesias: [], filtro: 'todos', q: '' };
const ESTADOS = { pendiente: ['Pendiente', 'bg-amber-100 text-amber-800'], activo: ['Con acceso', 'bg-emerald-100 text-emerald-800'], inactivo: ['Desactivado', 'bg-slate-200 text-slate-600'] };
const fechaHora = v => v ? new Date(v).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';

async function abrirAdmin() {
  if (usuarioSesion?.rol !== 'superadmin') return;
  ir('view-admin'); await cargarAdmin();
}
async function cargarAdmin() {
  $('adm-tabla').innerHTML = '<p class="p-6 text-sm text-slate-500">Cargando…</p>';
  const [u, g] = await Promise.all([supabaseClient.rpc('admin_listar_usuarios'), supabaseClient.from('iglesias').select('id,nombre,activa').order('nombre')]);
  if (u.error || g.error) { $('adm-tabla').innerHTML = `<p class="p-6 text-sm text-red-700">No se pudo cargar: ${esc((u.error || g.error).message)}</p>`; return; }
  ADM.usuarios = u.data || []; ADM.iglesias = g.data || []; renderAdmin();
}
function renderAdmin() {
  const ig = Object.fromEntries(ADM.iglesias.map(i => [i.id, i.nombre])), cuenta = e => ADM.usuarios.filter(u => u.estado === e).length, q = norm(ADM.q);
  const lista = ADM.usuarios.map((u, i) => ({ u, i })).filter(({ u }) => (ADM.filtro === 'todos' || u.estado === ADM.filtro) && (!q || norm(u.nombre + ' ' + u.email).includes(q)));
  const chip = (id, t) => `<button onclick="ADM.filtro='${id}';renderAdmin()" class="px-3 py-1.5 rounded-full text-sm font-semibold ${ADM.filtro === id ? 'bg-sda-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${t}</button>`;
  const filas = lista.map(({ u, i }) => { const [t, c] = ESTADOS[u.estado];
    return `<tr class="align-top hover:bg-slate-50"><td class="px-3 py-3"><div class="font-medium">${esc(u.nombre || '—')}</div><div class="text-xs text-slate-500">${esc(u.email)}</div></td>
      <td class="px-3 py-3">${u.perfil_solicitado ? `<div>${ROLES[u.perfil_solicitado]}</div><div class="text-xs text-slate-500">${esc(u.iglesia_solicitada || 'sin iglesia')}</div>` : '<span class="text-slate-400">Sin solicitud</span>'}</td>
      <td class="px-3 py-3 text-xs text-slate-600">${fechaHora(u.ultimo_login)}</td>
      <td class="px-3 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-bold ${c}">${t}</span></td>
      <td class="px-3 py-3">${u.rol ? ROLES[u.rol] : '—'}</td>
      <td class="px-3 py-3 text-xs">${u.rol === 'superadmin' ? 'Todas' : (u.iglesias || []).map(id => esc(ig[id] || '?')).join(', ') || '—'}</td>
      <td class="px-3 py-3 text-right"><button onclick="abrirEditor(${i})" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${u.estado === 'pendiente' ? 'bg-sda-900 text-white hover:bg-sda-800' : 'border border-slate-300 hover:bg-slate-100'}">${u.estado === 'pendiente' ? 'Dar acceso' : 'Editar'}</button></td></tr>`; }).join('');
  $('adm-tabla').innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div class="flex flex-wrap gap-2">${chip('todos', `Todos (${ADM.usuarios.length})`)}${chip('pendiente', `Pendientes (${cuenta('pendiente')})`)}${chip('activo', `Con acceso (${cuenta('activo')})`)}${chip('inactivo', `Desactivados (${cuenta('inactivo')})`)}</div>
    <div class="flex gap-2"><input type="search" value="${esc(ADM.q)}" placeholder="Buscar nombre o correo…" onchange="ADM.q=this.value;renderAdmin()" class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"><button onclick="cargarAdmin()" class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50">↻ Actualizar</button></div></div>
    <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white"><table class="min-w-full divide-y text-sm"><thead class="bg-slate-50 text-left text-xs font-semibold text-slate-600"><tr><th class="px-3 py-2">Persona</th><th class="px-3">Solicitó</th><th class="px-3">Último acceso</th><th class="px-3">Estado</th><th class="px-3">Rol asignado</th><th class="px-3">Iglesias asignadas</th><th class="px-3"></th></tr></thead>
    <tbody class="divide-y">${filas || '<tr><td colspan="7" class="px-3 py-8 text-center text-slate-500">No hay personas con ese filtro.</td></tr>'}</tbody></table></div>`;
}
function abrirEditor(i) {
  const u = ADM.usuarios[i], sel = new Set(u.iglesias?.length ? u.iglesias : (u.iglesia_solicitada_id ? [u.iglesia_solicitada_id] : []));
  const rol = u.rol || (PERFILES.includes(u.perfil_solicitado) ? u.perfil_solicitado : 'tesorero');
  $('modal-usuario').innerHTML = `<div class="tut-fade bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
    <div><h3 class="text-lg font-bold text-slate-900">${u.estado === 'pendiente' ? 'Dar acceso' : 'Editar acceso'}</h3><p class="text-sm text-slate-500">${esc(u.email)}</p></div>
    ${u.perfil_solicitado ? `<p class="text-xs p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">Solicitó: <strong>${ROLES[u.perfil_solicitado]}</strong> · ${esc(u.iglesia_solicitada || 'sin iglesia')}</p>` : ''}
    <label class="block text-sm font-semibold text-slate-700">Nombre<input id="ed-nombre" value="${esc(u.nombre || '')}" class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal"></label>
    <label class="block text-sm font-semibold text-slate-700">Rol<select id="ed-rol" class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === rol ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div><p class="text-sm font-semibold text-slate-700">Iglesias</p><div id="ed-iglesias" class="mt-1 max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1">${ADM.iglesias.map(g => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" value="${g.id}" ${sel.has(g.id) ? 'checked' : ''}> ${esc(g.nombre)}${g.activa ? '' : ' (inactiva)'}</label>`).join('') || '<p class="text-sm text-slate-500">No hay iglesias registradas.</p>'}</div>
      <p class="text-xs text-slate-500 mt-1">El superadministrador ve todas las iglesias; para los demás roles asigna al menos una.</p></div>
    <label class="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" id="ed-activo" ${u.estado === 'inactivo' ? '' : 'checked'}> Acceso activo</label>
    <div class="flex justify-end gap-3 pt-2"><button onclick="cerrarEditor()" class="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
      <button onclick="guardarAcceso(${i})" class="px-5 py-2 rounded-lg bg-sda-900 text-white text-sm font-semibold hover:bg-sda-800">Guardar</button></div></div>`;
  $('modal-usuario').classList.remove('hidden'); document.body.classList.add('overflow-hidden');
}
function cerrarEditor() { $('modal-usuario').classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }
async function guardarAcceso(i) {
  const u = ADM.usuarios[i], ids = [...document.querySelectorAll('#ed-iglesias input:checked')].map(c => c.value);
  const { error } = await supabaseClient.rpc('admin_guardar_acceso', { p_email: u.email, p_nombre: $('ed-nombre').value, p_rol: $('ed-rol').value, p_iglesias: ids, p_activo: $('ed-activo').checked });
  if (error) return alert('No se pudo guardar: ' + error.message);
  cerrarEditor(); await cargarAdmin();
}
