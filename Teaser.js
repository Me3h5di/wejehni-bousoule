const moteur = new MoteurRecommandation(SPECIALITES_DATA);

const form = document.getElementById("recherche");
const resultatsSection = document.getElementById("resultats");
const resultatsListe = document.getElementById("resultats-liste");
const resultatsTitre = document.getElementById("resultats-titre");
const resultatsSousTitre = document.getElementById("resultats-sous-titre");
const etatVide = document.getElementById("etat-vide");
const tplCarte = document.getElementById("tpl-carte");
const poolContainer = document.getElementById("pool-motscles");
const filtreInput = document.getElementById("filtre-mots");
const poolVideMsg = document.getElementById("pool-vide");
const selectionCount = document.getElementById("selection-count");
const selectionChips = document.getElementById("selection-chips");
const btnChercher = document.getElementById("btn-chercher");

const SEUIL_SCORE_MINIMUM = 2.0;
const motsSelectionnes = new Set();

// --- Construction du pool de mots-clés (plat, sans regroupement par domaine) ---
// Les mots restent volontairement non associés à un domaine/spécialité dans l'UI :
// seul le moteur de scoring établit ce lien, au moment de la recherche.
const TOUS_LES_MOTS = [...new Set(GROUPES_MOTSCLES.flatMap((g) => g.mots))].sort((a, b) =>
  a.localeCompare(b, "fr", { sensitivity: "base" })
);

const chipsParMot = new Map();

TOUS_LES_MOTS.forEach((mot) => {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip-mot";
  chip.textContent = mot;
  chip.addEventListener("click", () => toggleMot(mot, chip));
  poolContainer.appendChild(chip);
  chipsParMot.set(mot, chip);
});

filtreInput.addEventListener("input", () => {
  const requete = filtreInput.value.trim().toLowerCase();
  let visibles = 0;
  chipsParMot.forEach((chip, mot) => {
    const correspond = mot.toLowerCase().includes(requete);
    chip.classList.toggle("masque", !correspond);
    if (correspond) visibles += 1;
  });
  poolVideMsg.hidden = visibles > 0;
});

function toggleMot(mot, chipEl) {
  if (motsSelectionnes.has(mot)) {
    motsSelectionnes.delete(mot);
    chipEl.classList.remove("actif");
  } else {
    motsSelectionnes.add(mot);
    chipEl.classList.add("actif");
  }
  majResume();
}

function majResume() {
  selectionCount.textContent = `${motsSelectionnes.size} كلمة مختارة`;
  selectionChips.innerHTML = "";
  motsSelectionnes.forEach((mot) => {
    const chip = document.createElement("span");
    chip.className = "chip-resume";
    chip.innerHTML = `${mot} <button type="button" aria-label="إزالة ${mot}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      motsSelectionnes.delete(mot);
      const original = chipsParMot.get(mot);
      if (original) original.classList.remove("actif");
      majResume();
    });
    selectionChips.appendChild(chip);
  });
  btnChercher.disabled = motsSelectionnes.size === 0;
}

// --- Recherche ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (motsSelectionnes.size === 0) return;

  const texte = [...motsSelectionnes].join(", ");
  const bac = document.getElementById("bac").value || null;

  const resultats = moteur.recommander(texte, { serieBac: bac, topN: 6 });
  afficherResultats(resultats, [...motsSelectionnes]);
  resultatsSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

function afficherResultats(resultats, motsChoisis) {
  etatVide.hidden = true;
  resultatsSection.hidden = false;
  resultatsListe.innerHTML = "";

  const meilleur = resultats.length ? Math.max(...resultats.map((r) => r.scoreFinal)) : 0;

  if (!resultats.length || meilleur < SEUIL_SCORE_MINIMUM) {
    resultatsTitre.textContent = "لم نجد تطابقاً كافياً";
    resultatsSousTitre.textContent = "جرّب اختيار كلمات أخرى، أو أضف المزيد من الكلمات من مجالات مختلفة.";
    return;
  }

  resultatsTitre.textContent = `${resultats.length} تخصصات مقترحة لك`;
  resultatsSousTitre.textContent = `بناءً على: ${motsChoisis.join(" · ")}`;

  resultats.forEach((r) => resultatsListe.appendChild(construireCarte(r)));
}

function construireCarte(r) {
  const node = tplCarte.content.cloneNode(true);
  const carte = node.querySelector(".carte");
  const sp = r.specialite;

  node.querySelector(".carte__domaine").textContent = sp.domaine;
  node.querySelector(".carte__nom").textContent = sp.nom;
  node.querySelector(".carte__score").textContent = `التوافق ${Math.round(r.scoreFinal)}/100`;
  node.querySelector(".carte__desc").textContent = sp.description;

  const chips = node.querySelector(".carte__chips");
  r.motsClesTrouves.slice(0, 5).forEach((m) => {
    const chip = document.createElement("span");
    chip.className = "chip chip--mot";
    chip.textContent = m;
    chips.appendChild(chip);
  });
  if (r.bacCompatible === true) {
    chips.appendChild(creerChip("✓ متوافق مع شعبتك", "chip--bac-oui"));
  } else if (r.bacCompatible === false) {
    chips.appendChild(creerChip("⚠ الشعبة غير مطلوبة لهذا التخصص", "chip--bac-non"));
  }

  const parcours = node.querySelector(".carte__parcours");
  parcours.appendChild(creerEtape("البكالوريا", sp.filieres_bac_recommandees.join(" / "), sp.moyenne_indicative_orientation));
  parcours.appendChild(creerEtape("النظام الجامعي", sp.systeme_universitaire, sp.duree_totale_indicative));
  parcours.appendChild(creerEtape("التخصص / الماستر", sp.parcours_master_ou_specialisation, sp.type_etablissement));

  const metiers = node.querySelector(".carte__metiers");
  sp.debouches_metiers.forEach((m) => {
    const div = document.createElement("div");
    div.className = "metier";
    const t = document.createElement("p");
    t.className = "metier__titre";
    t.textContent = m.titre;
    const d = document.createElement("p");
    d.className = "metier__desc";
    d.textContent = m.description;
    div.appendChild(t);
    div.appendChild(d);
    metiers.appendChild(div);
  });

  node.querySelector(".carte__toggle").addEventListener("click", () => {
    carte.classList.toggle("ouvert");
  });

  return node;
}

function creerChip(texte, classe) {
  const chip = document.createElement("span");
  chip.className = `chip ${classe}`;
  chip.textContent = texte;
  return chip;
}

function creerEtape(label, valeur, sous) {
  const div = document.createElement("div");
  div.className = "etape";
  div.innerHTML = `
    <p class="etape__label">${label}</p>
    <p class="etape__valeur">${valeur}</p>
    <p class="etape__sub">${sous}</p>
  `;
  return div;
}
