# Configuration — Réussite Magazine

Copier les variables suivantes dans `.env` (à la racine du projet).

## Base de données (déjà configuré)
```
DATABASE_URL=postgresql://…        # Neon / Postgres
```

## Traduction automatique du contenu (DeepL)
À chaque publication (article, flash info, podcast, vidéo, catégorie), le contenu
est traduit automatiquement en anglais, espagnol, arabe et chinois (table
`Translation`). Les traductions sont corrigeables manuellement dans l'éditeur
d'articles → bouton « Traductions ».

- Créer une clé sur https://www.deepl.com/pro-api (offre free : 500 000 caractères/mois).
- Les clés **free** se terminent par `:fx` (le code adapte l'endpoint automatiquement).
```
DEEPL_API_KEY=…
```
Sans clé : le site reste 100 % français, aucune erreur.

## Cloudinary (import d'images de la médiathèque)
Les images importées depuis le tableau de bord sont transférées vers Cloudinary —
**rien n'est stocké sur le serveur**.

- Créer un compte gratuit sur https://cloudinary.com → Dashboard.
```
CLOUDINARY_CLOUD_NAME=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…
```

## Notifications push (Web Push VAPID)
Les abonnés reçoivent une notification sur leur téléphone à chaque nouvelle
publication (articles, vidéos, podcasts) + envoi manuel depuis le tableau de bord.

Générer les clés une seule fois :
```bash
bunx web-push generate-vapid-keys
# ou : bunx tsx scripts/generate-vapid-keys.ts
```
```
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
VAPID_SUBJECT=mailto:reussitemagazine16@gmail.com
```

## Divers
```
NEXT_PUBLIC_SITE_URL=https://votre-domaine.com   # URLs Open Graph correctes
```

## Après modification du `.env`
Redémarrer le serveur (`bun run dev`).

## Newsletter (envoi réel)
Créer un compte sur https://resend.com, vérifier votre domaine, puis :
```
RESEND_API_KEY=…
NEWSLETTER_FROM=Réussite Magazine <newsletter@votre-domaine.com>
```
Sans clé : le bouton « Envoyer » de la newsletter reste une simulation (aucun email réel).

## Sécurisation du cron
`/api/cron/publish-scheduled` publie les articles planifiés (cron Vercel toutes
les 5 min — voir `vercel.json`, fonctionne aussi sans compte payant). Pour le
protéger des appels externes :
```
CRON_SECRET=une-chaîne-aléatoire
```
(⚠️ sur Vercel, le cron système n'envoie pas automatiquement ce header ; ne le
définissez que si vous appelez l'URL vous-même avec `Authorization: Bearer …`.)

## Langue du tableau de bord
L'interface d'administration est volontairement en français uniquement
(rédaction francophone). Dites-moi si vous souhaitez aussi la traduire.
