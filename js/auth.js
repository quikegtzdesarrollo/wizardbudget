/** js/auth.js - Autenticación (Google OAuth). El acceso lo decide Supabase (RPC mi_contexto), pero NUNCA se expulsa a nadie por no tener acceso:
 *  toda persona que inicia sesión llega a la pantalla de bienvenida.
 *  'activo'   → en la bienvenida se habilita el botón «Entrar al asistente» (según su rol e iglesias)
 *  'pendiente'/'inactivo' → solo ve la bienvenida (y, si está pendiente, elige perfil e iglesia); el botón permanece deshabilitado
 *  'error'    → no se pudo verificar el acceso (falla del servidor): igual llega a la bienvenida, con el detalle y un botón para reintentar. */
let usuarioSesion = null;      // {id?,email,nombre,rol|null}
let iglesiasUsuario = [];      // iglesias asignadas [{id,nombre}]
let contextoSesion = null;     // respuesta completa de mi_contexto()

document.addEventListener('DOMContentLoaded', verificarEstadoSesion);

async function loginWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname } });   // funciona también en GitHub Pages con subruta
  if (error) mostrarErrorLogin('No se pudo conectar con el servicio de autenticación.');
}

/** Error que Supabase devuelve en la URL cuando Google/Supabase rechaza el inicio de sesión antes de crear la sesión
 *  (p. ej. registros nuevos deshabilitados en Supabase Auth). */
function errorEnUrl() {
  const p = new URLSearchParams(location.hash.replace(/^#/, '') + '&' + location.search.replace(/^\?/, ''));
  return p.get('error_description') || p.get('error') || '';
}

/** Contexto mínimo para poder mostrar la bienvenida cuando mi_contexto falla. */
function contextoDeRespaldo(session, detalle) {
  const u = session.user, m = u.user_metadata || {}, email = (u.email || '').toLowerCase();
  return { acceso: 'error', errorVerificacion: detalle, usuario: { email, nombre: m.full_name || m.name || email.split('@')[0], rol: null },
    iglesias: [], solicitud: {}, catalogo_iglesias: [] };
}

async function verificarEstadoSesion() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    const e = errorEnUrl();
    if (e) { history.replaceState(null, '', location.pathname); return mostrarErrorLogin('No se pudo iniciar sesión con Google: ' + e); }
    return mostrarPantallaLogin();
  }
  let { data: ctx, error } = await supabaseClient.rpc('mi_contexto');
  if (error || !ctx) {                      // no se cierra la sesión: se llega a la bienvenida con el detalle del problema
    console.error('mi_contexto falló:', error);
    ctx = contextoDeRespaldo(session, error?.message || 'El servidor no devolvió información de acceso.');
  }
  contextoSesion = ctx; usuarioSesion = ctx.usuario; iglesiasUsuario = ctx.iglesias || [];
  if (ctx.acceso === 'activo') cargarInterfazUsuario();
  mostrarBienvenida();
}

function cargarInterfazUsuario() {
  $('user-name').textContent = usuarioSesion.nombre || usuarioSesion.email;
  $('user-role').textContent = (ROLES[usuarioSesion.rol] || usuarioSesion.rol).toUpperCase();
  $('select-iglesia-activa').innerHTML = iglesiasUsuario.map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('');
  document.querySelectorAll('.solo-superadmin').forEach(b => b.classList.toggle('hidden', usuarioSesion.rol !== 'superadmin'));
}

async function logout() { await supabaseClient.auth.signOut(); usuarioSesion = null; location.reload(); }
async function cerrarSesionForzada() { await supabaseClient.auth.signOut(); usuarioSesion = null; }

function mostrarPantallaLogin() { ir('view-login'); }
function mostrarErrorLogin(m) {
  ir('view-login'); const b = document.getElementById('login-error');
  if (b) { b.querySelector('h3').textContent = 'No se pudo iniciar sesión'; b.querySelector('.text-red-700').textContent = m; b.classList.remove('hidden'); }
}
