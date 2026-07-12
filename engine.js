// Moteur de recommandation Wejehni — portage JS du script Python `recommandation.py`.
// Même logique : score = 0.55 * correspondance_mots_cles + 0.45 * similarite_tfidf

const MOTS_VIDES_FR = new Set([
  "le","la","les","un","une","des","de","du","et","ou","a","au","aux",
  "en","dans","pour","par","sur","avec","sans","ce","ces","cette","cet",
  "je","tu","il","elle","on","nous","vous","ils","elles","mon","ma","mes",
  "ton","ta","tes","son","sa","ses","que","qui","quoi","dont","est",
  "suis","es","sont","etre","avoir","ai","as","avons","avez","ont",
  "plutot","plus","moins","tres","bien","aussi","comme","si","mais","donc",
  "car","ne","pas","n","l","d","s","j","c","qu","aime","aimer","aimerais",
]);

function normaliser(texte) {
  return texte
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function decouperEnTokens(texte) {
  const norm = normaliser(texte);
  const mots = norm.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  return mots.filter((m) => !MOTS_VIDES_FR.has(m) && m.length > 1);
}

const LONGUEUR_MIN_PREFIXE = 4;
function motsProches(a, b) {
  if (a === b) return true;
  if (a.length >= LONGUEUR_MIN_PREFIXE && b.length >= LONGUEUR_MIN_PREFIXE) {
    return a.startsWith(b) || b.startsWith(a);
  }
  return false;
}

function phrasesMotsCles(sp) {
  return [sp.nom, sp.domaine, ...sp.mots_cles];
}

function texteDescriptifComplet(sp) {
  const parts = [
    sp.nom,
    sp.domaine,
    sp.description,
    sp.parcours_master_ou_specialisation,
    sp.debouches_metiers.map((m) => m.titre).join(" "),
    sp.mots_cles.join(" "),
  ];
  return normaliser(parts.join(" "));
}

// --- Mini TF-IDF + similarité cosinus (équivalent de sklearn, unigrammes+bigrammes) ---
function tokenizeForTfidf(texteNorm) {
  const mots = (texteNorm.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []).filter(
    (m) => !MOTS_VIDES_FR.has(m)
  );
  const grams = [...mots];
  for (let i = 0; i < mots.length - 1; i++) grams.push(mots[i] + " " + mots[i + 1]);
  return grams;
}

class MoteurRecommandation {
  constructor(specialites) {
    this.specialites = specialites;
    const corpusTokens = specialites.map((s) => tokenizeForTfidf(texteDescriptifComplet(s)));

    // Vocabulaire + document frequency
    const df = new Map();
    corpusTokens.forEach((tokens) => {
      new Set(tokens).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    });
    const N = specialites.length;
    this.idf = new Map();
    df.forEach((freq, term) => this.idf.set(term, Math.log((1 + N) / (1 + freq)) + 1));

    // Vecteurs TF-IDF normalisés (L2) pour chaque spécialité
    this.vecteurs = corpusTokens.map((tokens) => {
      const tf = new Map();
      tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      const vec = new Map();
      tf.forEach((count, term) => vec.set(term, count * (this.idf.get(term) || 0)));
      let norm = 0;
      vec.forEach((v) => (norm += v * v));
      norm = Math.sqrt(norm) || 1;
      vec.forEach((v, k) => vec.set(k, v / norm));
      return vec;
    });
  }

  _vecteurRequete(texteUtilisateur) {
    const tokens = tokenizeForTfidf(normaliser(texteUtilisateur));
    const tf = new Map();
    tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    const vec = new Map();
    tf.forEach((count, term) => {
      if (this.idf.has(term)) vec.set(term, count * this.idf.get(term));
    });
    let norm = 0;
    vec.forEach((v) => (norm += v * v));
    norm = Math.sqrt(norm) || 1;
    vec.forEach((v, k) => vec.set(k, v / norm));
    return vec;
  }

  _cosine(vecA, vecB) {
    let dot = 0;
    const [small, big] = vecA.size < vecB.size ? [vecA, vecB] : [vecB, vecA];
    small.forEach((v, k) => {
      if (big.has(k)) dot += v * big.get(k);
    });
    return dot;
  }

  _scoreMotsCles(tokensUtilisateur) {
    const scores = [];
    const phrasesTrouvees = [];
    this.specialites.forEach((sp) => {
      const phrases = phrasesMotsCles(sp).map((p) => ({ orig: p, tokens: decouperEnTokens(p) }));
      const matches = new Set();
      const phrasesMatchees = [];
      phrases.forEach((ph) => {
        const touche = ph.tokens.some((t) => tokensUtilisateur.some((u) => motsProches(u, t)));
        if (touche) phrasesMatchees.push(ph.orig);
        ph.tokens.forEach((t) => {
          tokensUtilisateur.forEach((u) => {
            if (motsProches(u, t)) matches.add(u);
          });
        });
      });
      const score = tokensUtilisateur.length ? matches.size / tokensUtilisateur.length : 0;
      scores.push(score);
      phrasesTrouvees.push(phrasesMatchees);
    });
    return { scores, phrasesTrouvees };
  }

  static bacCompatible(sp, serieBac) {
    if (!serieBac) return null;
    const norm = normaliser(serieBac);
    const series = sp.filieres_bac_recommandees.map((s) => normaliser(s));
    if (series.some((s) => norm.includes(s) || s.includes(norm))) return true;
    if (series.some((s) => s.includes("toutes"))) return true;
    return false;
  }

  recommander(texteUtilisateur, { serieBac = null, topN = 6, poidsMotsCles = 0.55, poidsSimilarite = 0.45 } = {}) {
    const tokensUtilisateur = decouperEnTokens(texteUtilisateur);
    const { scores: scoresMc, phrasesTrouvees } = this._scoreMotsCles(tokensUtilisateur);
    const vecReq = this._vecteurRequete(texteUtilisateur);
    const scoresSim = this.vecteurs.map((v) => this._cosine(vecReq, v));

    const resultats = this.specialites.map((sp, i) => {
      const scMc = scoresMc[i];
      const scSim = scoresSim[i];
      const scoreFinal = poidsMotsCles * scMc + poidsSimilarite * scSim;
      return {
        specialite: sp,
        scoreFinal: Math.round(scoreFinal * 1000) / 10,
        scoreMotsCles: Math.round(scMc * 1000) / 10,
        scoreSimilarite: Math.round(scSim * 1000) / 10,
        motsClesTrouves: phrasesTrouvees[i],
        bacCompatible: MoteurRecommandation.bacCompatible(sp, serieBac),
      };
    });

    resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);
    return resultats.slice(0, topN);
  }
}
