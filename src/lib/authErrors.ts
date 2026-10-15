// Traduce los errores de Supabase Auth a mensajes amables.
type AuthLikeError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

const NETWORK = 'No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.';

function isNetwork(e: AuthLikeError) {
  return !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0 || /network|fetch/i.test(e.message ?? ''));
}

export function loginErrorMessage(e: AuthLikeError): string {
  if (isNetwork(e)) return NETWORK;
  if (e?.code === 'email_not_confirmed') return 'Todavía no confirmaste tu correo. Buscá el mensaje que te enviamos y tocá el enlace.';
  if (e?.code === 'over_request_rate_limit' || e?.status === 429) return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.';
  return 'El correo o la contraseña no coinciden. Revisalos e intentá de nuevo.';
}

export function signupErrorMessage(e: AuthLikeError): string {
  if (isNetwork(e)) return NETWORK;
  switch (e?.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Ya existe un perfil con ese correo. Iniciá sesión con él.';
    case 'weak_password':
      return 'La contraseña es muy corta. Usá al menos 6 caracteres.';
    case 'email_address_invalid':
      return 'Escribí un correo válido, por ejemplo nombre@correo.com.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.';
    default:
      return 'No pudimos crear el perfil. Intentá de nuevo en un momento.';
  }
}

export function passwordErrorMessage(e: AuthLikeError): string {
  if (isNetwork(e)) return NETWORK;
  if (e?.code === 'weak_password') return 'La contraseña es muy corta. Usá al menos 6 caracteres.';
  if (e?.code === 'same_password') return 'Elegí una contraseña distinta de la anterior.';
  return 'No pudimos cambiar la contraseña. Pedí un enlace nuevo e intentá otra vez.';
}
