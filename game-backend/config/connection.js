/**
 * Normaliza la configuracion de conexion a las bases de datos.
 *
 * Los paneles tipo Dokploy muestran cada base como una URL de conexion
 * completa (mysql://user:pass@host:3306/db), y es natural pegarla entera en
 * DB_HOST o REDIS_HOST. Cuando eso pasa, Node intenta resolver la URL como
 * nombre DNS y el proceso muere con ENOTFOUND antes de aceptar peticiones.
 *
 * Esta funcion acepta las dos formas:
 *   - host suelto  -> se usan las variables sueltas (DB_PORT, DB_USER, ...)
 *   - URL completa -> se extraen de ella host, puerto, usuario, clave y base
 */
function resolveConnection(raw, fallback) {
  const cfg = {
    host: raw || fallback.host,
    port: fallback.port,
    user: fallback.user,
    password: fallback.password,
    database: fallback.database
  };

  if (!raw || !raw.includes('://')) {
    return cfg;
  }

  let url;
  try {
    url = new URL(raw);
  } catch (err) {
    // No es una URL valida; se deja tal cual y que falle con su propio error
    return cfg;
  }

  // Los componentes vienen percent-encoded: una clave con '@' o ':' llega
  // escapada y hay que decodificarla antes de usarla.
  const decode = (value) => (value ? decodeURIComponent(value) : '');
  const database = url.pathname && url.pathname.length > 1
    ? decode(url.pathname.slice(1))
    : fallback.database;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : fallback.port,
    user: decode(url.username) || fallback.user,
    password: decode(url.password) || fallback.password,
    database: database,
    fromUrl: true
  };
}

module.exports = { resolveConnection };
