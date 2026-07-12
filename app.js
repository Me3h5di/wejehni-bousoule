// --- Teaser : mini-quiz de 3 questions pour amorcer un premier choix de mots ---
// Purement indicatif : il ne fait qu'une pré-sélection de quelques mots dans le
// pool complet ci-dessous. Le vrai calcul de recommandation reste inchangé et
// se base uniquement sur les mots réellement sélectionnés dans le pool.

const CLUSTER_MOTS = {
  sante: [
    "soigner",
    "sauver des vies",
    "hôpital",
    "urgence médicale",
    "kinésithérapie",
    "handicap",
  ],
  tech: [
    "coder",
    "intelligence artificielle",
    "robotique",
    "développement logiciel",
    "drones",
    "sécurité informatique",
  ],
  nature: [
    "agriculture",
    "nature",
    "biotechnologie",
    "laboratoire",
    "génétique",
    "écosystèmes",
  ],
  gestion: [
    "gestion",
    "commerce",
    "finance",
    "marketing",
    "justice",
    "droits humains",
  ],
  arts: [
    "design",
    "dessin",
    "architecture",
    "création visuelle",
    "langues étrangères",
    "littérature",
  ],
};

const TEASER_QUESTIONS = [
  {
    question: "بشكل عام، أي نشاط يجذبك أكثر؟",
    options: [
      { label: "مساعدة الناس ورعاية صحتهم", poids: { sante: 2 } },
      { label: "ابتكار حلول تقنية ورقمية", poids: { tech: 2 } },
      { label: "تسيير الأعمال أو الدفاع عن الحقوق", poids: { gestion: 2 } },
      { label: "التعبير الفني أو الكتابة", poids: { arts: 2 } },
    ],
  },
  {
    question: "تفضل قضاء وقتك في:",
    options: [
      { label: "التعامل المباشر مع الناس", poids: { sante: 1, gestion: 1 } },
      { label: "التجربة في المخبر أو الطبيعة", poids: { nature: 2 } },
      { label: "البرمجة أو استعمال الأجهزة", poids: { tech: 2 } },
      { label: "الرسم أو تعلم لغة جديدة", poids: { arts: 2 } },
    ],
  },
  {
    question: "ما الذي يهمك أكثر في مستقبلك المهني؟",
    options: [
      { label: "إنقاذ ومساعدة الآخرين", poids: { sante: 2 } },
      { label: "الاستقرار المالي والتسيير", poids: { gestion: 2 } },
      { label: "الابتكار والتكنولوجيا", poids: { tech: 2 } },
      { label: "الطبيعة أو الإبداع الفني", poids: { nature: 1, arts: 1 } },
    ],
  },
];

const teaserSection = document.getElementById("teaser");
const teaserQuestionEl = document.getElementById("teaser-question");
const teaserOptionsEl = document.getElementById("teaser-options");
const teaserSkipBtn = document.getElementById("teaser-skip");
const teaserDots = [...document.querySelectorAll(".teaser__dot")];
const rechercheForm = document.getElementById("recherche");
const suggestionNote = document.getElementById("suggestion-note");

let etapeActuelle = 0;
const scoresCluster = { sante: 0, tech: 0, nature: 0, gestion: 0, arts: 0 };

function afficherQuestionTeaser() {
  const q = TEASER_QUESTIONS[etapeActuelle];
  teaserQuestionEl.textContent = q.question;
  teaserOptionsEl.innerHTML = "";
  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "teaser__option";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => repondreTeaser(opt.poids));
    teaserOptionsEl.appendChild(btn);
  });
  teaserDots.forEach((dot, i) =>
    dot.classList.toggle("actif", i === etapeActuelle),
  );
}

function repondreTeaser(poids) {
  Object.entries(poids).forEach(([cle, val]) => {
    scoresCluster[cle] += val;
  });
  etapeActuelle += 1;
  if (etapeActuelle < TEASER_QUESTIONS.length) {
    afficherQuestionTeaser();
  } else {
    terminerTeaser(true);
  }
}

function meilleurCluster() {
  return Object.entries(scoresCluster).sort((a, b) => b[1] - a[1])[0][0];
}

function terminerTeaser(avecSuggestion) {
  teaserSection.hidden = true;
  rechercheForm.hidden = false;

  if (avecSuggestion) {
    const cluster = meilleurCluster();
    const motsSuggeres = CLUSTER_MOTS[cluster] || [];
    let auMoinsUnAjout = false;
    motsSuggeres.forEach((mot) => {
      const chip = chipsParMot.get(mot);
      if (chip && !motsSelectionnes.has(mot)) {
        toggleMot(mot, chip);
        auMoinsUnAjout = true;
      }
    });
    if (auMoinsUnAjout && suggestionNote) {
      suggestionNote.hidden = false;
    }
  }

  rechercheForm.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    localStorage.setItem("wejehni_teaser_vu", "1");
  } catch (e) {
    // stockage indisponible (navigation privée, etc.) : sans conséquence
  }
}

teaserSkipBtn.addEventListener("click", () => terminerTeaser(false));

// Ne pas ré-imposer le quiz à un visiteur qui l'a déjà vu sur ce navigateur
let dejaVu = false;
try {
  dejaVu = localStorage.getItem("wejehni_teaser_vu") === "1";
} catch (e) {
  dejaVu = false;
}

if (dejaVu) {
  teaserSection.hidden = true;
  rechercheForm.hidden = false;
} else {
  afficherQuestionTeaser();
}
