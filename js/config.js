/**
 * js/config.js - Configuración e Inicialización de Supabase
 */

// Reemplaza estas constantes con las credenciales de tu proyecto en Supabase
const SUPABASE_URL = 'https://qkehbepwrqeapaexdcya.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vEqR92tRAWqwWoUf8UDh0A_HRP7w-XU';

// Inicialización del cliente global
if (typeof supabase === 'undefined') {
  console.error('El SDK de Supabase no está cargado. Asegúrate de incluir el script CDN en el HTML.');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);