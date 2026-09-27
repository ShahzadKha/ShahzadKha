import type { RoutingTrack } from "@/generated/prisma/enums";

// Default email sequences, one per follow-up track. Admins edit them on the "Séquences email" page.
// Variables: {{prenom}}, {{nom}}, {{produit}}, {{prix}}, {{poste}}, {{marque}}, {{lien_offre}},
// {{lien_paiement}} and {{lien_avis}}

export type DefaultStep = { dayOffset: number; subject: string; body: string; isOffer?: boolean };

const SIGNATURE = "\n\nÀ très vite,\nL'équipe {{marque}}";

export const DEFAULT_SEQUENCES: Record<RoutingTrack, { name: string; steps: DefaultStep[] }> = {
  EDUCATIONAL: {
    name: "Nurturing éducatif",
    steps: [
      {
        dayOffset: 0,
        subject: "{{prenom}}, 3 compétences qui font la différence cette année",
        body: "Bonjour {{prenom}},\n\nMerci pour votre CV. Avant de parler formation, voici les 3 compétences que les recruteurs demandent le plus en ce moment : l'analyse de données, la maîtrise des outils numériques et la gestion de projet.\n\nDans les prochains jours, nous vous enverrons quelques conseils concrets pour les développer, même sans formation." + SIGNATURE,
      },
      {
        dayOffset: 7,
        subject: "Comment d'autres ont réussi leur reconversion",
        body: "Bonjour {{prenom}},\n\nChangement de métier, montée en compétences, retour à l'emploi : les parcours réussis ont souvent un point commun, un objectif clair et un plan en petites étapes.\n\nPrenez 5 minutes pour noter le poste que vous visez dans 12 mois. C'est la première étape." + SIGNATURE,
      },
      {
        dayOffset: 14,
        subject: "Votre plan de progression en 4 étapes",
        body: "Bonjour {{prenom}},\n\n1. Choisir un métier cible\n2. Lister les compétences qui vous manquent\n3. Vous former sur ces compétences\n4. Mettre à jour votre CV et votre profil LinkedIn\n\nQuand vous serez prêt(e) pour l'étape 3, répondez simplement à cet email." + SIGNATURE,
      },
    ],
  },
  LIGHT: {
    name: "Nurturing léger",
    steps: [
      {
        dayOffset: 0,
        subject: "{{prenom}}, votre profil a retenu notre attention",
        body: "Bonjour {{prenom}},\n\nNous avons analysé votre CV de {{poste}}. Votre parcours a une vraie valeur, et quelques compétences ciblées pourraient vous ouvrir des postes mieux rémunérés.\n\nNous vous partagerons bientôt une piste concrète." + SIGNATURE,
      },
      {
        dayOffset: 4,
        subject: "Ce qui manque souvent aux profils comme le vôtre",
        body: "Bonjour {{prenom}},\n\nPour les profils comme le vôtre, ce n'est pas l'expérience qui bloque, c'est souvent une compétence technique récente et reconnue par une certification.\n\nC'est exactement ce que couvre la formation {{produit}}." + SIGNATURE,
      },
      {
        dayOffset: 9,
        subject: "Découvrez le programme {{produit}}",
        body: "Bonjour {{prenom}},\n\nVoici le programme détaillé de la formation {{produit}}, avec le calendrier et le tarif :\n{{lien_offre}}\n\nUne question ? Répondez simplement à cet email." + SIGNATURE,
        isOffer: true,
      },
      {
        dayOffset: 15,
        subject: "On garde le contact ?",
        body: "Bonjour {{prenom}},\n\nNous ne voulons pas encombrer votre boîte mail. Si votre projet évolue, il vous suffit de répondre à ce message et nous reprendrons contact.\n\nBonne continuation !" + SIGNATURE,
      },
    ],
  },
  CONVERSION: {
    name: "Séquence de conversion",
    steps: [
      {
        dayOffset: 0,
        subject: "{{prenom}}, votre diagnostic personnalisé",
        body: "Bonjour {{prenom}},\n\nNous avons analysé votre CV de {{poste}}. Bonne nouvelle : votre profil correspond très bien à la formation {{produit}}.\n\nEn quelques semaines, elle vous permettrait d'ajouter les compétences qui vous manquent aujourd'hui et de viser des postes plus intéressants.\n\nDans nos prochains messages, nous vous expliquons comment." + SIGNATURE,
      },
      {
        dayOffset: 3,
        subject: "Ce qui fera passer votre CV en haut de la pile",
        body: "Bonjour {{prenom}},\n\nLes recruteurs trient les CV en quelques secondes. Une certification récente et un projet concret à montrer font toute la différence.\n\nLa formation {{produit}} vous donne les deux." + SIGNATURE,
      },
      {
        dayOffset: 6,
        subject: "Votre programme {{produit}} (détails et tarif)",
        body: "Bonjour {{prenom}},\n\nVoici votre offre personnalisée pour la formation {{produit}} : programme, calendrier et tarif ({{prix}}).\n\n{{lien_offre}}\n\nVous pouvez y indiquer quand vous souhaitez démarrer, un conseiller vous rappellera." + SIGNATURE,
        isOffer: true,
      },
      {
        dayOffset: 9,
        subject: "Financement, temps, niveau : vos questions",
        body: "Bonjour {{prenom}},\n\nLes 3 questions qu'on nous pose le plus :\n\n• « Je n'ai pas le temps » : la formation s'adapte à votre emploi du temps.\n• « Je n'ai pas le niveau » : votre profil a été analysé, il correspond.\n• « Comment la financer ? » : plusieurs solutions existent, un conseiller vous les présente.\n\nRépondez à cet email pour en parler." + SIGNATURE,
      },
      {
        dayOffset: 13,
        subject: "{{prenom}}, où en est votre projet ?",
        body: "Bonjour {{prenom}},\n\nAvez-vous pu regarder le programme {{produit}} ? Si c'est le bon moment pour vous, les prochaines places partent vite.\n\n{{lien_offre}}" + SIGNATURE,
      },
      {
        dayOffset: 17,
        subject: "Dernier message de notre part",
        body: "Bonjour {{prenom}},\n\nC'est notre dernier message à ce sujet. Si votre projet de formation reste d'actualité, répondez simplement « oui » et un conseiller vous recontacte.\n\nMerci pour votre attention et bonne continuation." + SIGNATURE,
      },
    ],
  },
  CALL_INVITE: {
    name: "Invitation à échanger",
    steps: [
      {
        dayOffset: 0,
        subject: "{{prenom}}, 15 minutes pour parler de votre projet ?",
        body: "Bonjour {{prenom}},\n\nVotre profil de {{poste}} correspond très bien à la formation {{produit}}. Nous vous proposons un échange de 15 minutes avec un conseiller pour en parler.\n\nVoir le programme et demander à être rappelé(e) :\n{{lien_offre}}" + SIGNATURE,
        isOffer: true,
      },
      {
        dayOffset: 3,
        subject: "Votre profil correspond à {{produit}}",
        body: "Bonjour {{prenom}},\n\nPetit rappel : votre analyse montre une très bonne adéquation avec la formation {{produit}}. Un échange rapide suffit pour vérifier que c'est le bon moment.\n\n{{lien_offre}}" + SIGNATURE,
      },
      {
        dayOffset: 7,
        subject: "Je clôture votre dossier ?",
        body: "Bonjour {{prenom}},\n\nSans nouvelles de votre part, nous allons clôturer votre dossier. Si vous souhaitez toujours en discuter, répondez simplement à cet email." + SIGNATURE,
      },
    ],
  },
  PRIORITY_SDR: {
    name: "Handoff SDR prioritaire",
    steps: [
      {
        dayOffset: 0,
        subject: "{{prenom}}, votre place en formation {{produit}}",
        body: "Bonjour {{prenom}},\n\nVotre profil fait partie des plus adaptés à la formation {{produit}}. Nous vous avons préparé une offre personnalisée :\n\n{{lien_offre}}\n\nIndiquez-y quand vous souhaitez démarrer : un conseiller vous appelle dans la journée." + SIGNATURE,
        isOffer: true,
      },
      {
        dayOffset: 2,
        subject: "Un conseiller vous rappelle ?",
        body: "Bonjour {{prenom}},\n\nUn conseiller est disponible pour répondre à vos questions sur la formation {{produit}} (programme, calendrier, financement).\n\n{{lien_offre}}" + SIGNATURE,
      },
    ],
  },
};

// Sent right after a positive reply (diagram: intérêt confirmé → offre envoyée)
export const DEFAULT_OFFER_EMAIL = {
  subject: "Votre offre personnalisée — {{produit}}",
  body: "Bonjour {{prenom}},\n\nMerci pour votre réponse ! Voici votre offre personnalisée pour la formation {{produit}} : programme, calendrier et tarif ({{prix}}).\n\n{{lien_offre}}\n\nIndiquez-y quand vous souhaitez démarrer, un conseiller vous rappelle rapidement." + SIGNATURE,
};

// Sent by the SDR after the closing call (diagram step 22: redirection ThriveCart)
export const DEFAULT_PAYMENT_EMAIL = {
  subject: "{{prenom}}, votre lien d'inscription — {{produit}}",
  body: "Bonjour {{prenom}},\n\nMerci pour notre échange ! Comme convenu, voici votre lien d'inscription sécurisé à la formation {{produit}} ({{prix}}) :\n\n{{lien_paiement}}\n\nVotre place est réservée dès la confirmation du paiement." + SIGNATURE,
};

// After payment (diagram steps 24–26)
export const DEFAULT_ONBOARDING: { name: string; steps: DefaultStep[] } = {
  name: "Onboarding et post-achat",
  steps: [
    {
      dayOffset: 0,
      subject: "Bienvenue dans la formation {{produit}} !",
      body: "Bonjour {{prenom}},\n\nFélicitations et bienvenue ! Votre inscription à la formation {{produit}} est confirmée.\n\nProchaines étapes :\n1. Vous recevrez vos accès à la plateforme de formation sous 24 h.\n2. Bloquez 30 minutes pour découvrir le programme et le planning.\n3. Rejoignez la communauté des apprenants pour poser vos questions.\n\nNous sommes ravis de vous accompagner." + SIGNATURE,
    },
    {
      dayOffset: 60,
      subject: "{{prenom}}, préparons la suite : CV, LinkedIn et entretiens",
      body: "Bonjour {{prenom}},\n\nVous avancez bien dans votre formation {{produit}}. C'est le bon moment pour préparer la suite : mettre à jour votre CV, optimiser votre profil LinkedIn et vous entraîner aux entretiens.\n\nRépondez à cet email pour réserver votre séance de coaching offerte." + SIGNATURE,
    },
    {
      dayOffset: 90,
      subject: "Votre avis compte : 1 minute pour nous aider",
      body: "Bonjour {{prenom}},\n\nVotre avis sur la formation {{produit}} nous aide à nous améliorer et aide d'autres personnes à se lancer. Cela prend moins d'une minute :\n\n{{lien_avis}}\n\nEt si un proche a un projet comme le vôtre, vous pouvez aussi nous le recommander." + SIGNATURE,
    },
  ],
};

// Closing call script shown on the SDR call sheet (diagram step 20). Lines starting with "#" are section titles.
export const DEFAULT_CALL_SCRIPT = `# 1. Ouverture
Bonjour {{prenom}}, c'est {{sdr}} de {{marque}}. Vous avez demandé à être rappelé(e) au sujet de la formation {{produit}}. Vous avez 10 minutes ?

# 2. Découverte
• Quel poste visez-vous après la formation ?
• Qu'est-ce qui vous décide à vous former maintenant ?
• Qu'est-ce qui pourrait vous empêcher de démarrer sous {{delai}} jours ?

# 3. Présentation
Reliez la formation à son objectif. Point à travailler selon l'analyse : {{ecart}}.
Rappelez le format, le calendrier et le prix ({{prix}}).

# 4. Lever le dernier blocage
• « C'est cher » → présentez les solutions de financement et le paiement en plusieurs fois s'il existe.
• « Je n'ai pas le temps » → rappelez le rythme et la flexibilité du programme.
• « Je ne suis pas sûr(e) du niveau » → son profil a été analysé : il correspond (score {{score}}/100).

# 5. Closing
« Je vous envoie maintenant le lien d'inscription sécurisé, vous pourrez réserver votre place pour la prochaine session. »`;

export const TEMPLATE_VARIABLES = ["prenom", "nom", "produit", "prix", "poste", "marque", "lien_offre", "lien_paiement", "lien_avis"] as const;
export const SCRIPT_VARIABLES = ["prenom", "nom", "produit", "prix", "marque", "sdr", "delai", "ecart", "score"] as const;
