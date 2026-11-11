# Sama Kër — plateforme foncière, immobilière et géospatiale

Plateforme de GéoSpatia Consulting pour les projets fonciers, immobiliers et géospatiaux au Sénégal. Le projet utilise Next.js App Router, TypeScript et Tailwind CSS.

L’interface est présentée dans un cadre crème aux coins arrondis, entouré d’une marge blanche visible ; les marges s’adaptent à la largeur de l’écran.

Les liens, cartes et actions ont des transitions courtes avec focus clavier visible ; les animations se désactivent en mode « réduction des animations » du système.

## Démarrer en local

Prérequis : Node.js 22.9 ou plus récent et npm.

```bash
npm install
Copy-Item .env.example .env.local
Copy-Item backend\.env.example backend\.env
npm run backend:build
npm run dev
```

Dans un second terminal, démarrer également l’API :

```bash
npm run backend:start
```

Le frontend est disponible sur `http://localhost:3000` et l’API sur `http://localhost:4000`. `.env.example` configure le domaine, l’API et Supabase. Pour l’authentification admin, définir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `ADMIN_EMAILS` dans l’environnement frontend ; `ADMIN_EMAILS` contient les adresses autorisées, séparées par des virgules. Créer ces comptes dans Supabase Auth. L’espace client (`/espace-client`) exige au contraire l’inscription par e-mail : laisser l’inscription activée, **imposer la confirmation de l’adresse e-mail**, exiger au moins 10 caractères pour les mots de passe et ajouter `<NEXT_PUBLIC_SITE_URL>/espace-client/confirmation` aux URL de redirection autorisées. Les comptes clients n’ont aucun accès à l’administration : les deux couches (Next.js et backend) exigent une adresse présente dans `ADMIN_EMAILS`, et les tables privées ne sont pas accessibles au rôle `authenticated`. Dans `backend\.env`, définir les mêmes emails, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` et `ALLOWED_ORIGINS`. La clé `service_role` reste exclusivement côté backend. Le backend vérifie à nouveau la session Supabase et l’adresse autorisée avant chaque lecture ou mutation.

Avant d’utiliser l’admin, appliquer `supabase/migrations/20261105120000_admin_workspace.sql` après les migrations existantes, puis configurer le projet Supabase et tester les parcours avec un compte autorisé. `/admin` redirige vers `/connexion-admin` sans session ; sans configuration, l’administration reste désactivée. Les annonces, prospects/CRM et rendez-vous sont conservés dans Supabase. L’ajout de photos utilise actuellement une URL HTTPS externe avec crédit, sans téléversement de fichier. Aucun secret n’est à saisir dans le dépôt ou le chat.

### Espace client

`/espace-client` permet de créer un compte, de confirmer son adresse, d’envoyer une demande depuis ce compte et de suivre son avancement (demande reçue, en analyse, visite planifiée, dossier ouvert, clôturée) ainsi que les dates de rendez-vous. Une demande envoyée par un visiteur connecté est rattachée à son compte et utilise l’adresse confirmée du compte ; une demande envoyée sans compte n’apparaît pas dans l’espace, même avec la même adresse. Le backend expose `GET /api/client/requests` : il valide la session auprès de Supabase, exige une adresse confirmée, ne lit que les prospects liés au compte et ne renvoie ni notes internes, ni lieu ou objet des rendez-vous. Avant tout usage, appliquer `supabase/migrations/20261109100000_client_space.sql` après les migrations précédentes. Limites actuelles : aucune notification par e-mail, pas de récupération de mot de passe, pas de suppression de compte en libre-service, pas de documents ni de favoris.

En production, définir les URLs HTTPS, le domaine canonique et les paramètres Supabase avant déploiement. Sans paramètres Supabase, le mode développement du site public garde les exemples explicitement signalés ; en production, l’application échoue explicitement au lieu de publier ces exemples. Le formulaire de contact reste désactivé par défaut. Commandes de validation : `npm test`, `npm run lint`, `npm run build` et `npm run backend:test`.

## Préparation au déploiement

Le projet est encore un prototype et n’est pas prêt pour la production. La checklist détaillée des contenus à remplacer, intégrations à réaliser et contrôles à valider se trouve dans [DEPLOIEMENT.md](DEPLOIEMENT.md). Mettre à jour cette checklist et son journal après chaque modification de code ou de configuration.

Pour présenter la vision, les modules, l’architecture cible, les rôles et la feuille de route à l’entreprise, consulter [PRESENTATION_APPLICATION.md](PRESENTATION_APPLICATION.md). Ce document distingue la cible proposée des fonctions réellement disponibles dans le prototype.

Pour préparer et faire approuver chaque annonce, utiliser le modèle vierge [FICHE_VALIDATION_ANNONCE.md](FICHE_VALIDATION_ANNONCE.md). Conserver les fiches remplies et les justificatifs hors du dépôt, dans un espace privé approuvé.

Un parcours de contrôle est préparé dans l’administration : enregistrer l’annonce « À vérifier », puis la faire contrôler et publier par un responsable distinct de tous ses contributeurs. Configurer côté backend `LISTING_REVIEWER_EMAILS` avec les adresses habilitées, qui doivent aussi figurer dans `ADMIN_EMAILS`. Les modifications ou changements de disponibilité retirent une annonce publiée et nécessitent une nouvelle validation. Une photo autorisée est requise. L’approbation ne prouve ni l’exactitude ni les droits d’utilisation des données.

**Avant tout usage réel**, appliquer et tester en préproduction `supabase/migrations/20261107170000_listing_review.sql` après les migrations précédentes, puis recetter les permissions, la séparation des comptes, les contrôles et les modifications concurrentes. Cette migration remet les annonces déjà publiées en « À vérifier » et masque leurs médias ; elles doivent être réenregistrées avant validation. Elle a été testée localement sur PostgreSQL embarqué avec des données synthétiques, mais ni appliquée ni testée sur une base Supabase. Sans cette migration, le parcours ne fonctionne pas et les anciennes annonces publiées ne sont pas protégées par le nouveau circuit.

### Position des biens sur la carte

Dans l’administration, une annonce peut recevoir une **position approximative** (latitude et longitude facultatives, les deux ou aucune, comprises dans les limites du Sénégal). Elle est arrondie à 0,01° (environ 1 km) côté serveur et en base : aucune coordonnée exacte de parcelle n’est stockée ni publiée. Elle suit le circuit de validation des annonces : toute modification retire l’annonce publiée et exige une nouvelle approbation par un responsable distinct, qui voit la position sur sa fiche de contrôle. Le repère n’apparaît publiquement qu’après publication ; le public lit la position via la politique RLS existante. Appliquer `supabase/migrations/20261109110000_listing_public_location.sql` après les migrations précédentes (testée sur PostgreSQL embarqué avec les privilèges par défaut de Supabase, pas sur un projet Supabase). Il n’existe pas de couche cadastrale, WMS/WFS ou parcellaire : elles nécessitent des sources et licences validées.

## Routes incluses

- `/` — accueil au style application, recherche rapide, catégories, annonces de démonstration en local ou annonces publiées depuis Supabase.
- `/terrains` et `/immobilier` — catalogues avec filtres partageables dans l’URL : localisation, région, type, disponibilité, fourchette de prix, surface et tri.
- `/terrains/[slug]` et `/immobilier/[slug]` — détail des biens, caractéristiques, contact et partage.
- API autonome `POST /api/contact` — servie sur le backend Node dans `backend/`, distinct de Next.js.
- `/carte` — carte Google Maps chargée à la demande (clic de l’utilisateur) : repères des biens dont une **position approximative** a été validée, zones d’environ 1 km, fond plan/satellite, recentrage par région, bouton « Ma position » (géolocalisation du navigateur, non enregistrée) et tri des biens par distance approximative, liste synchronisée avec les repères. Les biens sans position validée figurent dans la liste mais pas sur la carte. Nécessite `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (clé restreinte par référent HTTP à l’API Maps JavaScript) et, en production, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` ; sans clé, un message indique que la carte n’est pas configurée.
- `/services`, `/a-propos`, `/contact`, `/faq`, `/actualites`, `/diaspora`.
- `/zone/[commune]` — pages locales indexables.
- `/sitemap.xml` et `/robots.txt` — routes SEO générées par Next.js.
- `/admin` — administration protégée par Supabase Auth : annonces, prospects/CRM et rendez-vous persistés côté serveur.
- `/connexion-admin` — connexion réservée aux emails configurés dans `ADMIN_EMAILS`.
- `/espace-client` — suivi des demandes, notifications, favoris, alertes de recherche (enregistrées, envoi non activé), nouvelle demande, suppression du compte. `/espace-client/connexion` propose la réinitialisation du mot de passe ; `/espace-client/reinitialisation` définit le nouveau mot de passe. Les e-mails de confirmation et de réinitialisation nécessitent la configuration SMTP de Supabase. Appliquer `supabase/migrations/20261109130000_client_extras.sql` après les migrations précédentes.
- API autonome `GET /api/client/requests` — demandes du compte connecté.
- Fichiers privés des annonces (justificatifs, documents PDF, JPEG et PNG, 10 Mo maximum) : téléversés par l’équipe habilitée depuis la page « Fichiers » de chaque annonce, stockés dans le bucket privé `private-files`, téléchargés par lien signé valable 60 secondes. Ils ne sont jamais publics. Appliquer `supabase/migrations/20261109140000_private_files.sql` après les migrations précédentes, et vérifier la configuration du bucket sur Supabase.

## Données et limites actuelles

Sans configuration Supabase, les biens sont des exemples maintenus dans `src/lib/properties.ts`, explicitement signalés et sans badge de vérification. Le branchement de lecture publique est préparé dans `src/lib/public-properties.ts` : lorsque `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont configurées, les pages publiques lisent uniquement les enregistrements publiés protégés par RLS dans les migrations `supabase/migrations/20261105010000_public_property_listings.sql` et `supabase/migrations/20261104210000_contact_requests.sql`. Selon la recette notée dans `DEPLOIEMENT.md`, ces deux migrations ont été appliquées à `sama_ker` et l’accès anonyme a été vérifié ; aucune annonce réelle n’a été publiée et le scénario d’annonce publiée visible reste à tester. La migration admin `supabase/migrations/20261105120000_admin_workspace.sql` reste à appliquer. Ne publier que des annonces dont les données sont autorisées et validées ; ne pas saisir de coordonnées précises, références cadastrales, documents fonciers ni données personnelles dans les tables publiques. Les médias publics doivent disposer de droits et crédits confirmés. Les images actuelles restent des illustrations/inspirations, et les coordonnées/cartes schématiques ne représentent aucun emplacement réel.

Le formulaire appelle le service API indépendant via `NEXT_PUBLIC_API_URL`. Le backend valide les champs, limite l’origine via `ALLOWED_ORIGINS`, applique une limite de trois demandes par adresse sur quinze minutes sans stocker l’adresse dans le compteur, puis écrit dans la table privée Supabase `contact_requests`. La migration se trouve dans `supabase/migrations/20261104210000_contact_requests.sql`. Le traitement reste désactivé par défaut (`CONTACT_FORM_ENABLED=false`) ; il faut aussi configurer la migration, `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` uniquement dans `backend/.env` ou l’environnement sécurisé du service avant qu’une demande puisse être enregistrée. L’activation doit attendre la validation juridique et la recette de préproduction. `.env.example` et `backend/.env.example` documentent séparément les variables, sans valeur secrète. La clé `service_role` ne doit jamais être exposée au frontend.

L’interface admin et son API sont reliées à Supabase Auth et aux tables privées ; la migration admin, les variables d’environnement et les comptes autorisés doivent être configurés avant l’usage. Les demandes de contact sont reliées au pipeline CRM par la nouvelle migration. La création/modification, la publication/archivage, le changement de disponibilité et l’export CSV des annonces, ainsi que l’ajout et le suivi des prospects et des rendez-vous, passent par l’API protégée. Les médias se saisissent par URL HTTPS avec crédit ; le téléversement privé n’est pas encore développé. Les migrations précédentes ont été appliquées à un projet Supabase, mais la nouvelle migration et les parcours admin réels ne sont pas encore testés sur ce projet. Les données d’exemple publiques ne deviennent pas des données réelles : ajouter uniquement des annonces exactes, autorisées et contrôlées. La carte est un fond Google Maps sans couche SIG, GeoServer ni géométrie réelle. Aucun agenda externe, notification, paiement ou signature n’est connecté.

L’interface est responsive et utilise une navigation basse de type application sur mobile, un accueil compact et une carte schématique à thème sombre. C’est une expérience web mobile, pas une application native ni une PWA installable. Le style cartographique ne représente ni les rues réelles ni les positions exactes des biens.

Avant mise en production : appliquer la migration admin, configurer les secrets uniquement dans les environnements de déploiement, créer et autoriser les comptes Supabase Auth, vérifier accès refusés/accordés et mutations en préproduction, ajouter des annonces et médias confirmés, et faire valider confidentialité/conservation. Les intégrations absentes du MVP ne doivent pas être présentées comme actives.

## Structure utile

- `src/app` — pages et métadonnées App Router.
- `src/components` — navigation, fiches, catalogue et formulaire.
- `src/lib` — données et fonctions métier provisoires.
- `src/app/globals.css` — tokens visuels et styles de démonstration.
- `backend/src` — API HTTP indépendante, validation du formulaire et accès serveur Supabase.

L’espace client est reporté jusqu’à l’intégration d’une authentification, d’une API et des règles d’autorisation côté serveur. Le back-office présent est une maquette d’interface pour cadrer la prochaine intégration sécurisée.
