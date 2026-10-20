// Schéma des tables, repris de zite.schema.json (projet Zite d'origine).
// Généré par server/scripts/generate-schema.mjs — ne pas éditer à la main.

export type FieldType =
  | 'single_line_text'
  | 'long_text'
  | 'email'
  | 'phone_number'
  | 'single_select'
  | 'linked_record'
  | 'attachments'
  | 'currency'
  | 'number'
  | 'date'
  | 'created_at'
  | 'updated_at'
  | 'autonumber'
  | 'checkbox';

export type TableSchema = {
  className: string;   // nom utilisé par le SDK Zite
  tableId: string;     // identifiant Zite d'origine
  name: string;        // nom affiché
  primaryField: string;
  fields: Record<string, FieldType>;
};

export const TABLES: Record<string, TableSchema> = {
  Clients: {
    className: "Clients",
    tableId: "tdgTB8sbH18",
    name: "Clients",
    primaryField: "nomClient",
    fields: {
      nomClient: "single_line_text", // Nom Client
      email: "email", // Email
      telephone: "phone_number", // Téléphone
      adresse: "single_line_text", // Adresse
      secteurDactivite: "single_line_text", // Secteur d'activité
      statut: "single_select", // Statut
      dateCreation: "created_at", // Date création
      campagnes: "linked_record", // Campagnes
      fichiers: "attachments", // fichiers
      factures: "linked_record", // Factures
    },
  },
  Emplacements: {
    className: "Emplacements",
    tableId: "tqGkzciPwXe",
    name: "Emplacements",
    primaryField: "referenceEmplacement",
    fields: {
      referenceEmplacement: "single_line_text", // Référence Emplacement
      localisation: "single_line_text", // Localisation
      ville: "single_line_text", // Ville
      type: "single_select", // Type
      format: "single_line_text", // Format
      prixParSemaine: "currency", // Prix par Semaine
      disponibilite: "single_select", // Disponibilité
      latitude: "number", // Latitude GPS
      longitude: "number", // Longitude GPS
      quartier: "single_line_text", // Quartier
      disponibleDu: "date", // Disponible du
      disponibleAu: "date", // Disponible au
      photo: "attachments", // Photo
      reservations: "linked_record", // Réservations
    },
  },
  Campagnes: {
    className: "Campagnes",
    tableId: "t7KrvKz7WXL",
    name: "Campagnes",
    primaryField: "nomCampagne",
    fields: {
      nomCampagne: "single_line_text", // Nom Campagne
      client: "linked_record", // Client
      dateDebut: "date", // Date Début
      dateFin: "date", // Date Fin
      statut: "single_select", // Statut
      budgetTotal: "currency", // Budget Total
      validationCreation: "single_select", // Validation Création
      description: "long_text", // Description
      commercialResponsable: "single_line_text", // Commercial Responsable
      fichiersCreations: "attachments", // Fichiers Créations
      dateCreation: "created_at", // Date Création
      reservations: "linked_record", // Réservations
      impressions: "linked_record", // Impressions
      factures: "linked_record", // Factures
    },
  },
  Reservations: {
    className: "Reservations",
    tableId: "tiVRbgFfnk1",
    name: "R\u00e9servations",
    primaryField: "referenceReservation",
    fields: {
      referenceReservation: "single_line_text", // Référence Réservation
      campagne: "linked_record", // Campagne
      emplacement: "linked_record", // Emplacement
      dateDebut: "date", // Date Début
      dateFin: "date", // Date Fin
      statut: "single_select", // Statut
      montant: "currency", // Montant
      dateReservation: "created_at", // Date Réservation
    },
  },
  Impressions: {
    className: "Impressions",
    tableId: "tgS7ehqzB9L",
    name: "Impressions",
    primaryField: "referenceImpression",
    fields: {
      referenceImpression: "single_line_text", // Référence Impression
      campagne: "linked_record", // Campagne
      datePlanifiee: "date", // Date Planifiée
      dateRealisation: "date", // Date Réalisation
      statut: "single_select", // Statut
      formatImpression: "single_line_text", // Format Impression
      quantite: "number", // Quantité
      machinisteAssigne: "single_line_text", // Machiniste Assigné
      chefAtelier: "single_line_text", // Chef Atelier
      notes: "long_text", // Notes
      batFichier: "attachments", // BAT / Fichier
      typeDeTravaux: "single_select", // Type de travaux
    },
  },
  Factures: {
    className: "Factures",
    tableId: "tjyyX5N4bHc",
    name: "Factures",
    primaryField: "numeroFacture",
    fields: {
      numeroFacture: "single_line_text", // Numéro Facture
      client: "linked_record", // Client
      campagne: "linked_record", // Campagne
      dateEmission: "date", // Date Émission
      dateEcheance: "date", // Date Échéance
      montantHt: "currency", // Montant HT
      tva: "currency", // TVA
      montantTtc: "currency", // Montant TTC
      statutPaiement: "single_select", // Statut Paiement
      notes: "long_text", // Notes
      dateCreation: "created_at", // Date Création
      piecesJointes: "attachments", // Pièces Jointes
    },
  },
  Stock: {
    className: "Stock",
    tableId: "t6kzB3ax6wZ",
    name: "Stock",
    primaryField: "referenceArticle",
    fields: {
      referenceArticle: "single_line_text", // Référence Article
      nomArticle: "single_line_text", // Nom Article
      categorie: "single_select", // Catégorie
      unite: "single_select", // Unité
      quantiteEnStock: "number", // Quantité en Stock
      seuilDAlerte: "number", // Seuil d'Alerte
      prixUnitaire: "currency", // Prix Unitaire
      fournisseur: "single_line_text", // Fournisseur
      dernierApprovisionnement: "date", // Dernier Approvisionnement
      statutStock: "single_select", // Statut Stock
      notes: "long_text", // Notes
      sortiesDeStock: "linked_record", // Sorties de Stock
    },
  },
  SortiesDeStock: {
    className: "SortiesDeStock",
    tableId: "tuvh3aLPB55",
    name: "Sorties de Stock",
    primaryField: "referenceSortie",
    fields: {
      referenceSortie: "autonumber", // Référence Sortie
      article: "linked_record", // Article
      quantiteSortie: "number", // Quantité Sortie
      motif: "single_select", // Motif
      dateSortie: "date", // Date Sortie
      responsable: "single_line_text", // Responsable
      notes: "long_text", // Notes
      dateEnregistrement: "created_at", // Date Enregistrement
    },
  },
  ConversationsAgent: {
    className: "ConversationsAgent",
    tableId: "tgSDdjGX9si",
    name: "Conversations Agent",
    primaryField: "titreSession",
    fields: {
      titreSession: "single_line_text", // Titre Session
      emailUtilisateur: "email", // Email Utilisateur
      messagesJson: "long_text", // Messages JSON
      nombreDeMessages: "number", // Nombre de Messages
      dernierMessageUtilisateur: "single_line_text", // Dernier Message Utilisateur
      dateCreation: "created_at", // Date Création
      derniereMiseAJour: "updated_at", // Dernière Mise à Jour
    },
  },
  Collaborateurs: {
    className: "Collaborateurs",
    tableId: "tg8tQG5fWVk",
    name: "Collaborateurs",
    primaryField: "nomComplet",
    fields: {
      nomComplet: "single_line_text", // Nom Complet
      email: "email", // Email
      poste: "single_line_text", // Poste
      notificationsActives: "checkbox", // Notifications Actives
      dateAjout: "created_at", // Date Ajout
    },
  },
  // --- Tables ajoutées pour la version autonome (absentes du projet Zite) ---
  Utilisateurs: {
    className: "Utilisateurs",
    tableId: "local-utilisateurs",
    name: "Utilisateurs",
    primaryField: "nomComplet",
    fields: {
      nomComplet: "single_line_text", // Nom Complet
      email: "email", // Email
      telephone: "phone_number", // Téléphone
      profil: "single_select", // Profil
      statut: "single_select", // Statut
      notes: "long_text", // Notes
      motDePasseHash: "single_line_text", // Mot de passe (scrypt)
      doitChangerMotDePasse: "checkbox", // Changement demandé
      derniereConnexion: "date", // Dernière Connexion
      dateCreation: "created_at", // Date Création
    },
  },
  Parametres: {
    className: "Parametres",
    tableId: "local-parametres",
    name: "Paramètres",
    primaryField: "cle",
    fields: {
      cle: "single_line_text", // Clé
      valeur: "long_text", // Valeur (JSON)
      dateMiseAJour: "updated_at", // Dernière Mise à Jour
    },
  },
  Sessions: {
    className: "Sessions",
    tableId: "local-sessions",
    name: "Sessions",
    primaryField: "jeton",
    fields: {
      jeton: "single_line_text", // Jeton (empreinte SHA-256)
      utilisateurId: "single_line_text", // Utilisateur
      expireLe: "single_line_text", // Expiration (ISO)
      dateCreation: "created_at", // Date Création
    },
  },
};

export const classNameForTableId = (tableId: string): string | undefined =>
  Object.keys(TABLES).find((k) => TABLES[k].tableId === tableId);

