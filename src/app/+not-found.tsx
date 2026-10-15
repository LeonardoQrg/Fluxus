import { Redirect } from 'expo-router';

// Cualquier dirección desconocida vuelve al inicio
export default function NotFound() {
  return <Redirect href="/" />;
}
