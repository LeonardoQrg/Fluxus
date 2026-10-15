// Firma de la app para Google Play.
//
// Si al compilar existen estas variables de entorno, la versión "release" se firma con la clave
// de subida de Fluxus (la que se guarda en los "Secrets" de GitHub):
//   FLUXUS_KEYSTORE (ruta del archivo .jks), FLUXUS_KEYSTORE_PASSWORD, FLUXUS_KEY_ALIAS, FLUXUS_KEY_PASSWORD
// Si no existen, se usa la clave de prueba de siempre (sirve para instalar el APK de prueba).
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function firmaAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes('FLUXUS_KEYSTORE')) return c;

    // 1) Definir la firma "subida" junto a la de prueba
    gradle = gradle.replace(
      /signingConfigs \{\n(\s+)debug \{/,
      `signingConfigs {\n$1if (System.getenv("FLUXUS_KEYSTORE")) {\n$1    upload {\n$1        storeFile file(System.getenv("FLUXUS_KEYSTORE"))\n$1        storePassword System.getenv("FLUXUS_KEYSTORE_PASSWORD")\n$1        keyAlias System.getenv("FLUXUS_KEY_ALIAS")\n$1        keyPassword System.getenv("FLUXUS_KEY_PASSWORD")\n$1    }\n$1}\n$1debug {`,
    );

    // 2) Usarla en la versión release
    gradle = gradle.replace(
      /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig System.getenv("FLUXUS_KEYSTORE") ? signingConfigs.upload : signingConfigs.debug`,
    );

    if (!gradle.includes('signingConfigs.upload : signingConfigs.debug')) {
      throw new Error('No se pudo configurar la firma de Android: cambió la plantilla de Expo.');
    }
    c.modResults.contents = gradle;
    return c;
  });
};
