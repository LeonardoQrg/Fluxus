// Configuración de la app. Lo fijo está en app.json; acá solo se ajusta lo que cambia en cada compilación.
// VERSION_CODE: número de versión para Google Play, que tiene que subir en cada archivo que se sube.
module.exports = ({ config }) => {
  const versionCode = Number(process.env.VERSION_CODE) || config.android?.versionCode || 1;
  return {
    ...config,
    android: { ...config.android, versionCode },
    plugins: [...(config.plugins ?? []), './plugins/firma-android'],
  };
};
