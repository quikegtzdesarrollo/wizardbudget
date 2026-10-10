/** js/auth.js - Autenticación (Google OAuth) y control de acceso: la allowlist se valida en Supabase (RPC mi_contexto) */
let usuarioSesion = null;      // {id,email,nombre,rol}
let iglesiasUsuario = [];      // [{id,nombre}]

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
  if (error) { console.error(error.message); await cerrarSesionForzada(); return mostrarErrorLogin('Ocurrió un error al verificar tus permisos.'); }
  if (!ctx) { await cerrarSesionForzada(); return mostrarErrorLogin(`El correo (${session.user.email}) no está autorizado para ingresar al sistema.`); }
  if (!ctx.iglesias.length) { await cerrarSesionForzada(); return mostrarErrorLogin('Tu usuario no tiene iglesias asignadas. Contacta al administrador.'); }
  usuarioSesion = ctx.usuario; iglesiasUsuario = ctx.iglesias;
  cargarInterfazUsuario(); mostrarPantallaWizard();
}

function cargarInterfazUsuario() {
  $('user-name').textContent = usuarioSesion.nombre || usuarioSesion.email;
  $('user-role').textContent = usuarioSesion.rol.toUpperCase();
  $('select-iglesia-activa').innerHTML = iglesiasUsuario.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
}

async function logout() { await supabaseClient.auth.signOut(); usuarioSesion = null; location.reload(); }
async function cerrarSesionForzada() { await supabaseClient.auth.signOut(); usuarioSesion = null; }

function mostrarPantallaLogin() { document.getElementById('view-login')?.classList.remove('hidden'); document.getElementById('view-wizard')?.classList.add('hidden'); }
function mostrarPantallaWizard() { document.getElementById('view-login')?.classList.add('hidden'); const w = document.getElementById('view-wizard'); w?.classList.remove('hidden'); w?.classList.add('flex'); }
function mostrarErrorLogin(m) { mostrarPantallaLogin(); const b = document.getElementById('login-error'); if (b) { b.querySelector('.text-red-700').textContent = m; b.classList.remove('hidden'); } }
