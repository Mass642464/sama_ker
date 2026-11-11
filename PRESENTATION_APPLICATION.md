# Sama Kër — Présentation de la plateforme

**Document de cadrage destiné à présenter le projet à l’entreprise**
**Version :** 1.2 · **Date :** 5 novembre 2026
**Statut :** présentation du prototype actuel et de la cible MVP, à valider avec la direction de GéoSpatia Consulting.

> Le frontend public reste une maquette navigable ; les annonces, prix, localisations, repères cartographiques et visuels sont des exemples non vérifiés. Le formulaire appelle une API Node indépendante, mais son traitement reste désactivé par défaut. Le code de l’administration utilise Supabase Auth, une liste d’emails autorisés et des endpoints privés pour les annonces, le CRM et l’agenda. La migration de ces nouvelles tables et la configuration/recette de l’environnement Supabase restent à faire ; ne pas utiliser l’admin avec des données métier avant cette étape.

---

## 1. Résumé exécutif

Sama Kër, initiée par GéoSpatia Consulting, a pour objectif de réunir dans un même service numérique :

- un **portail public** pour présenter les expertises du cabinet, découvrir des biens et prendre contact ;
- une **cartographie** pour situer les opportunités et, à terme, consulter des couches géospatiales autorisées ;
- un **back-office sécurisé** pour gérer les annonces, demandes, contacts, rendez-vous et contenus ;
- à terme, un **espace client** pour suivre les demandes, dossiers, rendez-vous et documents partagés.

La proposition met l’accent sur la confiance, la clarté des informations, la lisibilité mobile et la distinction explicite entre données informatives, données déclarées et éléments effectivement vérifiés.

### Bénéfices attendus

- Rassembler les demandes provenant du site et mieux suivre leur traitement.
- Présenter les terrains, logements et services dans un catalogue cohérent.
- Réduire les échanges dispersés en offrant une référence et un parcours par demande.
- Aider les clients locaux et la diaspora à comprendre les étapes et à échanger à distance.
- Exploiter les données géospatiales dans un cadre contrôlé, documenté et autorisé.

Ces bénéfices sont des objectifs de projet ; ils ne constituent pas des résultats déjà mesurés.

---

## 2. Publics et rôles

| Public / rôle cible | Besoins principaux | Accès prévu |
| --- | --- | --- |
| Visiteur public | Découvrir les services, rechercher un bien, demander une information | Pages publiques uniquement |
| Prospect / client | Suivre ses demandes, visites, notifications et documents autorisés | Espace client authentifié, après phase dédiée |
| Agent commercial | Qualifier et affecter les demandes, suivre les échanges, visites et annonces | CRM et agenda selon permissions |
| Agent technique | Consulter ou gérer les informations SIG et éléments techniques autorisés | Outils cartographiques selon permissions |
| Administrateur | Gérer utilisateurs, rôles, catalogue, contenus et configuration | Administration avec accès serveur contrôlé |
| Direction | Consulter des synthèses et superviser les indicateurs | Vues de pilotage en lecture selon rôle |

Les rôles et permissions devront être approuvés par GéoSpatia Consulting. Une allowlist d’adresses Supabase Auth protège actuellement l’accès administrateur ; les rôles différenciés et leurs permissions restent à concevoir. L’accès réel ne sera opérationnel qu’après configuration et recette de l’environnement et de la migration admin.

---

## 3. Structure fonctionnelle cible

### 3.1 Portail public

- **Accueil** : présentation de la marque, recherche rapide, sélection de biens, expertises, aperçu cartographique, parcours diaspora et contact.
- **Terrains** : liste/grille, filtres, tri, informations de surface et disponibilité, fiches détaillées.
- **Immobilier** : maisons, villas, appartements et locations, avec critères adaptés aux catégories de biens.
- **Fiche bien** : informations descriptives, médias autorisés, référence, disponibilité, prix indicatif si approuvé, caractéristiques, localisation appropriée et actions de contact.
- **Carte** : recherche cartographique, sélection de couches, biens géolocalisés quand leur emplacement est autorisé, aperçu et lien vers les fiches.
- **Services** : cartographie/SIG, topographie, expertise et conseil, avec demande de devis.
- **À propos** : présentation officielle de l’entreprise, équipe, approche et références approuvées.
- **Contact** : formulaire sécurisé et coordonnées officielles, une fois validées.
- **FAQ et actualités** : informations éditoriales maintenues par l’équipe.
- **Diaspora** : parcours explicatif, échange à distance et fuseau horaire si nécessaire.
- **Pages locales** : pages de zones desservies, uniquement avec contenu local utile et vérifié.

### 3.2 Espace client — phase ultérieure

- Tableau de bord : demandes en cours, prochains rendez-vous et notifications.
- Favoris et alertes de recherche.
- Demandes, historique des échanges et statut.
- Dossiers avec étapes, pièces attendues et documents sécurisés.
- Rendez-vous, confirmations, annulations et liens de visioconférence.
- Profil, préférences, sécurité et demandes relatives au compte.

### 3.3 Back-office — version technique, à valider avant production

- Tableau de bord par période, équipe et périmètre autorisé.
- Catalogue des biens : création, édition, statuts, médias, documents, prévisualisation et publication contrôlée.
- CRM : contacts, source de demande, qualification, attribution, pipeline, tâches, notes internes et historique.
- Agenda des visites et rendez-vous.
- Cartographie interne, avec droits d’édition explicites.
- Gestion éditoriale : services, FAQ, actualités et contenus locaux.
- Utilisateurs, rôles et matrice de permissions.
- Imports/exports et journal des actions sensibles.

Aucun écran d’administration ne doit permettre de publier une annonce comme vérifiée sans une validation réelle, attribuable et historisée. L’interface actuelle peut créer/modifier/archiver des annonces, exporter le catalogue, suivre des prospects et enregistrer des rendez-vous ; le téléversement sécurisé des médias, l’audit et les permissions par rôle ne sont pas implémentés.

---

## 4. Arborescence applicative cible

```text
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                         # Accueil
│   │   ├── terrains/
│   │   │   ├── page.tsx                     # Catalogue et filtres
│   │   │   └── [slug]/page.tsx              # Fiche terrain
│   │   ├── immobilier/
│   │   │   ├── page.tsx                     # Catalogue immobilier
│   │   │   └── [slug]/page.tsx              # Fiche logement
│   │   ├── carte/page.tsx
│   │   ├── services/page.tsx
│   │   ├── a-propos/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── actualites/page.tsx
│   │   ├── diaspora/page.tsx
│   │   └── zone/[commune]/page.tsx
│   ├── (auth)/                              # Connexion / récupération
│   ├── espace-client/                       # Protégé côté serveur
│   │   ├── tableau-de-bord/page.tsx
│   │   ├── favoris/page.tsx
│   │   ├── alertes/page.tsx
│   │   ├── demandes/page.tsx
│   │   ├── rendez-vous/page.tsx
│   │   ├── dossiers/[id]/page.tsx
│   │   ├── documents/page.tsx
│   │   └── profil/page.tsx
│   ├── admin/                               # Protégé côté serveur
│   │   ├── page.tsx                         # Dashboard
│   │   ├── biens/page.tsx
│   │   ├── crm/page.tsx
│   │   ├── agenda/page.tsx
│   │   ├── cartographie/page.tsx
│   │   ├── contenus/page.tsx
│   │   ├── utilisateurs/page.tsx
│   │   ├── imports-exports/page.tsx
│   │   ├── journal/page.tsx
│   │   └── parametres/page.tsx
│   ├── sitemap.ts
│   └── robots.ts
├── components/
│   ├── ui/                                  # Boutons, champs, dialogues
│   ├── layout/                              # Header, footer, navigation
│   ├── properties/                          # Cards, galerie, badges, fiche
│   ├── map/                                 # Carte, couches, marqueurs
│   ├── search/                              # Barre de recherche et filtres
│   ├── crm/                                 # Pipeline, contacts, timeline
│   └── dashboards/                          # KPI et graphiques
├── features/
│   ├── properties/
│   ├── leads/
│   ├── appointments/
│   ├── documents/
│   └── mapping/
├── lib/                                     # Auth, accès données, validation
├── hooks/                                   # Hooks de présentation
├── stores/                                  # État UI non sensible uniquement
├── types/                                   # Types partagés
└── styles/                                  # Tokens et styles globaux
```

Cette arborescence est une cible d’organisation. Les dossiers marqués comme phases futures ne signifient pas que leurs fonctions sont déjà implémentées.

---

## 5. Architecture technique proposée

### Technologies

- **Frontend — Next.js App Router et TypeScript** : interface publique rendue côté serveur, métadonnées et routes SEO.
- **Backend — Node.js et TypeScript** : service HTTP indépendant pour l’API métier ; CORS configuré par allowlist.
- **Tailwind CSS** : système visuel responsive et cohérent.
- **lucide-react** : icônes d’interface.
- **Supabase/PostgreSQL** : base de stockage préparée pour les annonces publiques et les données CRM/agenda privées ; la migration admin, la configuration et la recette de l’environnement restent à faire.
- **MapLibre GL JS** : affichage cartographique lorsque les sources et licences sont définies.
- **PostgreSQL/PostGIS** : option recommandée pour les entités métier et données spatiales, à confirmer.
- **GeoServer/WMS/WFS** : option pour servir des couches SIG, sous réserve de gouvernance, accès et licences.
- **Supabase Auth** : fournisseur retenu et intégré pour la connexion administrateur ; les comptes, la vérification/récupération et les autres rôles restent à configurer.
- **Stockage objet privé** : option pour photos et documents, avec liens temporaires et permissions.

TanStack Query, Zustand, Recharts et next-intl peuvent être introduits lorsque les besoins d’API, de dashboards ou de multilingue sont confirmés ; ils ne sont pas indispensables à la première version publique.

### Flux de données cible

```text
Visiteur / Client / Agent
          │
          ▼
Frontend Next.js (service indépendant)
          │ HTTPS / CORS allowlist
          ▼
Backend Node.js / TypeScript
          ├── Validation et limites de débit
          ├── Supabase / PostgreSQL (à configurer)
          ├── Stockage privé des médias et documents (à choisir)
          ├── Fournisseur cartographique / GeoServer (à choisir)
          └── Services e-mail, SMS ou agenda (à choisir)
```

En local, le frontend est lancé avec `npm run dev` et le backend avec `npm run backend:start` dans un second terminal. `NEXT_PUBLIC_API_URL` est défini côté frontend ; `ALLOWED_ORIGINS` et les secrets Supabase sont exclusivement côté backend. Les secrets et les clés privées restent dans le gestionnaire de secrets de l’hébergeur, jamais dans le navigateur ou le dépôt. La séparation du code ne signifie pas que les deux services sont déjà déployés.

L’arborescence cible ci-dessus illustre les fonctions envisagées ; les fichiers `src/app/api/*` ne sont pas utilisés pour l’API métier. Les appels métier doivent rester dans `backend/`.

---

## 6. Modèle de données métier initial

| Entité | Contenu à cadrer |
| --- | --- |
| Bien | Référence, catégorie, statut, prix, surface, description, dates et source des données |
| Localisation | Région/commune/localité et géométrie avec système de coordonnées, précision et visibilité |
| Média | Chemin de stockage, crédit/licence, texte alternatif, ordre, catégorie et droits d’affichage |
| Document | Type, niveau d’accès, état de validation, propriétaire et journal des consultations |
| Contact | Identité minimale nécessaire, coordonnées, préférences et consentements |
| Demande | Référence, bien associé, source/UTM, date, statut, priorité et affectation |
| Interaction | Canal, horodatage, auteur, résumé et niveau de confidentialité |
| Tâche | Responsable, échéance, statut et lien avec une demande/contact |
| Rendez-vous | Participants, fuseau horaire, créneau, mode, lieu et confirmation |
| Utilisateur/Rôle | Identité, état, rôle, permissions et sessions |
| Événement d’audit | Action sensible, acteur, horodatage, ressource et contexte nécessaire |

Les données cadastrales, les pièces foncières et les informations personnelles doivent avoir des règles d’accès, de rétention, d’audit et de suppression définies avant implémentation.

---

## 7. Parcours clés à présenter

### Découverte d’un bien

Accueil → recherche/catalogue → filtres partageables → fiche → demande d’information ou visite → confirmation et référence de dossier.

### Traitement d’une demande

Soumission validée côté serveur → protection anti-spam → création de demande → attribution à un agent → qualification CRM → tâche de suivi → réponse au client → historique.

### Publication d’une annonce

Création → informations commerciales → caractéristiques et sources → localisation autorisée → photos et droits → documents avec accès → revue habilitée → publication → journalisation.

### Projet à distance

Page diaspora → description du projet → contact avec fuseau horaire → sélection de créneau → échange à distance → prochaines étapes communiquées.

---

## 8. Principes de confiance, sécurité et conformité

- Les données de démonstration ne doivent jamais être présentées comme des annonces vérifiées.
- Le badge « Vérifié » est affiché seulement après une validation réelle, faite par un rôle habilité et historisée.
- Un marqueur ou contour cartographique ne constitue pas une limite cadastrale ou une preuve de propriété.
- Les images Pinterest et photos d’inspiration ne sont pas des photos des annonces ; droits et crédits doivent être archivés.
- Les formulaires doivent valider et enregistrer côté serveur avec anti-spam, gestion d’erreurs et politique de confidentialité approuvée.
- `/admin`, les API et les documents privés doivent appliquer l’autorisation côté serveur, même si l’accès direct à une URL est tenté.
- Les rôles doivent appliquer le principe du moindre privilège ; les accès documentaires sensibles sont journalisés.
- Aucun paiement, réservation juridique, signature ou conseil juridique ne doit être promis sans cadrage et validation dédiés.
- La conformité juridique et vie privée doit être validée par les interlocuteurs compétents pour les pays et utilisateurs concernés.

---

## 9. Accessibilité, performance et qualité attendues

- Navigation clavier, focus visible, titres hiérarchisés, labels de champs et messages d’erreur lisibles.
- Contrastes vérifiés pour textes, boutons, badges et éléments posés sur les images.
- Mise en page testée sur mobile, tablette, écran large et avec zoom navigateur.
- Images optimisées, textes alternatifs utiles, chargement adapté et droits documentés.
- États de chargement, listes vides, erreurs réseau et indisponibilité SIG explicitement conçus.
- Tests automatisés pour filtres, rôles, formulaires, parcours et routes dynamiques.
- CI avec lint, tests, build, contrôles de dépendances et déploiement contrôlé.

---

## 10. Feuille de route proposée

### Phase 0 — Cadrage et validation métier

Valider identité et contenus officiels, catégories de biens, statuts, sources des données, rôles, permissions, fournisseurs, conformité, hébergement et domaine.

### Phase 1 — Fondations

Finaliser design system, layout, métadonnées, modèles TypeScript, schémas de validation, environnements et couche d’accès serveur.

### Phase 2 — MVP public

Connecter catalogue/fiches à une API, mettre en ligne des données autorisées, connecter formulaire, finaliser contenu, médias, référencement, monitoring et recette mobile.

### Phase 3 — Finalisation du back-office

Appliquer la migration admin, configurer les comptes autorisés, recetter les opérations réelles, définir les rôles, compléter l’audit et tester les permissions.

### Phase 4 — SIG et espace client

Connecter sources cartographiques autorisées, stockage privé, favoris, alertes, demandes, rendez-vous et suivi documentaire selon les permissions.

### Phase 5 — Extensions métier

Évaluer imports/exports, notifications multi-canaux, paiement, réservation ou signature uniquement après décision métier, technique et juridique.

---

## 11. État actuel du prototype

| Élément | État actuel |
| --- | --- |
| Portail public et direction visuelle | Maquette responsive navigable disponible ; voir le lancement local dans `README.md` |
| Catalogues et filtres | Données fictives en local sans configuration ; lecture serveur des seules annonces publiées prévue via Supabase/RLS, sans projet distant configuré ni annonce réelle intégrée |
| Fiches et galeries | Visuels en partie illustratifs ; ne documentent pas les biens réels |
| Carte | Google Maps à la demande : repères et zones approximatives (≈ 1 km) pour les biens dont la position est validée, fond plan/satellite, « Ma position », tri par distance ; sans couche SIG cadastrale ; clé à configurer |
| Formulaire | Appelle le backend autonome ; traitement désactivé par défaut, aucune demande n’est enregistrée sans configuration et recette Supabase |
| Back-office | Connexion Supabase Auth et endpoints serveur protégés implémentés ; migration admin, variables d’environnement et recette réelle à faire |
| Espace client | Première version codée (compte avec confirmation d’e-mail, suivi des demandes et rendez-vous) ; migration et recette sur Supabase de préproduction à faire ; sans notifications, récupération de mot de passe ni documents |
| API/base de données | API Node séparée disponible en local ; migrations publiques déjà préparées et migration privée CRM/agenda ajoutée ; cette dernière n’est pas appliquée ni testée en préproduction |
| SEO technique | Métadonnées et routes SEO de base présentes ; domaine fictif à remplacer |
| Production | Bloquée jusqu’aux contrôles de `DEPLOIEMENT.md` |

---

## 12. Décisions attendues de l’entreprise

1. Confirmer les fonctionnalités et le calendrier du MVP de lancement.
2. Fournir les coordonnées, identité, contenus et médias officiels accompagnés de leurs droits.
3. Le MVP est limité aux annonces publiées par l’équipe ; définir les responsables habilités à vérifier et approuver chaque publication.
4. Approuver les statuts métier, la matrice de rôles et les informations visibles par catégorie d’utilisateur.
5. Supabase/PostgreSQL est retenu pour le socle MVP et Supabase Auth pour l’accès administrateur ; configurer les projets/comptes via le gestionnaire sécurisé et choisir l’hébergement, le stockage et les fournisseurs de communication.
6. Préciser les sources cartographiques/SIG, licences, précision requise et règles de visibilité des parcelles.
7. Valider les mentions légales, confidentialité, conservation, consentements et procédures de traitement des demandes.
8. Désigner les responsables de recette, sécurité, sauvegarde, support et validation avant publication.

---

## Conclusion

Sama Kër dispose d’un frontend de démonstration, d’un adaptateur de lecture serveur pour les annonces publiées, d’une API Node indépendante et d’un back-office dont l’authentification et les mutations sont codées. L’administration attend l’application de sa migration, la configuration des variables/comptes et une recette réelle ; les annonces et médias doivent être autorisés et contrôlés. Pour visualiser l’interface, suivre le démarrage local dans [README.md](README.md) et ouvrir `http://localhost:3000`. Toute mise en production doit suivre la checklist de référence [DEPLOIEMENT.md](DEPLOIEMENT.md).
