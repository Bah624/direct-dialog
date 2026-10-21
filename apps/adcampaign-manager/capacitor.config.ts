import type { CapacitorConfig } from '@capacitor/cli';

// L'application mobile charge l'application web servie par votre installation
// (Docker). Définissez CAP_SERVER_URL au moment de la compilation, par exemple :
//   CAP_SERVER_URL="https://app.votre-domaine.com" npx cap sync android
const serveur = process.env.CAP_SERVER_URL || 'https://app.direct-dialog.com';

const config: CapacitorConfig = {
  appId: 'com.directdialog.app',
  appName: 'Direct Dialog',
  webDir: 'dist',
  server: {
    url: serveur,
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
