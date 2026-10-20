// Génération des clés VAPID pour les notifications push :
//   bunx tsx scripts/generate-vapid-keys.ts   (ou : bunx web-push generate-vapid-keys)
// Copier les deux valeurs dans .env :
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
