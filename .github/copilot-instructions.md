# Instructions du projet

- Conserver le français comme langue par défaut et utiliser une palette sans bleu : vert forêt pour les CTA/titres/liens, vert doux pour les repères, tons crème/terre pour les surfaces et accents ; ne pas afficher le logo image GéoSpatia tant qu’il introduit du bleu dans l’interface.
- Le projet utilise Next.js App Router, TypeScript, Tailwind CSS v4 et `lucide-react`.
- Garder les pages publiques accessibles, responsive et avec métadonnées adaptées.
- Les données présentes dans `src/lib/properties.ts`, les visuels et les positions sont des exemples : ne pas les présenter comme des informations réelles ou vérifiées.
- Ne pas ajouter de fausses coordonnées, de données cadastrales, de promesses juridiques ou de contenus prétendument validés.
- L’interface `/admin` est une maquette publiquement accessible, sans authentification ni persistance : ne jamais y brancher de vraies données avant d’ajouter une protection serveur.
- Les formulaires, l’authentification, la carte SIG, le CRM et les espaces privés nécessitent une intégration serveur réelle avant toute utilisation en production.
- Maintenir `DEPLOIEMENT.md` comme checklist pré-déploiement de référence : après chaque modification de code ou de configuration, actualiser les tâches/statuts concernés et ajouter au journal les fichiers, vérifications et résultats. Ne cocher que les éléments réellement testés.
- Vérifier les changements avec `npm run lint` et `npm run build`.