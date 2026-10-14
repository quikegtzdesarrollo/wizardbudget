/** js/auth.js - Autenticación (Google OAuth). El acceso lo decide Supabase (RPC mi_contexto):
 *  'activo'   → puede usar el asistente según su rol e iglesias
 *  'pendiente'/'inactivo' → solo ve la pantalla de bienvenida (y, si está pendiente, elige perfil e iglesia). */
let usuarioSesion = null;      // {id?,email,nombre,rol|null}
let iglesiasUsuario = [];      // iglesias asignadas [{id,nombre}]
let contextoSesion = null;     // respuesta completa de mi_contexto()

document.addEventListener('DOMContentLoaded', verificarEstadoSesion);

async function loginWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname } });   // funciona también en GitHub Pages con subruta
  if (error) mostrarErrorLogin('No se pudo conectar con el servicio de autenticación.');
}

async function verificarEstadoSesion() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return mostrarPantallaLogin();
  const { data: ctx, error } = await supabaseClient.rpc('mi_contexto');
  if (error || !ctx) { console.error(error?.message); await cerrarSesionForzada(); return mostrarErrorLogin('Ocurrió un error al verificar tu acceso.'); }
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
function mostrarErrorLogin(m) { ir('view-login'); const b = document.getElementById('login-error'); if (b) { b.querySelector('.text-red-700').textContent = m; b.classList.remove('hidden'); } }
