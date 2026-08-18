import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// ASK GROUP SARL — LOGICIEL DE COMPTABILITÉ (version Supabase)
// Connecté à une base de données partagée
// ============================================================

const SUPABASE_URL = "https://sfuuzluaysxrdcqtvuto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdXV6bHVheXN4cmRjcXR2dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTU2OTEsImV4cCI6MjA5NzU5MTY5MX0.2N6_dYs56LLV6hLLkxippeyxrMNSp9VlBUt_GUdEdcM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Identité "Nicole" — verre bleu nuit + rouge sang ────────
const BG = "#060A14";            // fond de page, très sombre
const SURFACE = "rgba(20,26,40,.85)"; // panneaux (effet verre)
const NAVY = "#0E1522";          // surfaces solides (en-têtes de tableau, etc.)
const RED = "#D62B1F";           // accent principal, rouge sang vif
const RED_LIGHT = "#F2503F";     // rouge plus clair (dégradés, survols)
const GOLD = RED;                // alias — l'ancien nom "GOLD" désigne maintenant l'accent rouge
const TEXT = "#E7ECF5";          // texte principal sur fond sombre
const TEXT_MUTED = "#8CA3C2";    // texte secondaire
const LINE = "rgba(255,255,255,.1)"; // bordures discrètes
const CATEGORIES_DEPENSES = ["Loyer & charges locaux", "Internet & téléphonie", "Logiciels CRM & VoIP", "Matériel informatique", "Électricité & eau", "Transport", "Fournitures de bureau", "Formation", "Frais bancaires", "Taxes & impôts", "Autres"];
const APP_NAME = "comptabilite";

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthKey(d) { return d.slice(0, 7); }

function fmt(n, devise = "USD") {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + devise;
}

function convertToUSD(montant, devise, taux) {
  if (devise === "EUR") return montant * taux.eurUsd;
  if (devise === "CDF") return montant / taux.usdCdf;
  return montant;
}

// ============================================================
// LOGIQUE DE CALCUL DU SALAIRE — REPRISE DU LOGICIEL SUIVI RH
// (Lecture seule ici : Compta ne fait que LIRE les tables partagées
// agents / pointages / month_params — jamais les modifier)
// ============================================================
const DT_TO_USD_DEFAULT = 0.32;
const HEURE_DEBUT_RH = "09:00";
const HEURE_FIN_RH = "17:00";
const HEURES_JOUR_RH = 8;

function joursOuvrablesRH(year, month) {
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

function timeToMinutesRH(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const FERIES_FRANCE_FIXES_RH = [
  { date: "01-01", nom: "Nouvel An 🇫🇷" },
  { date: "05-01", nom: "Fête du Travail 🇫🇷" },
  { date: "05-08", nom: "Victoire 1945 🇫🇷" },
  { date: "07-14", nom: "Fête Nationale 🇫🇷" },
  { date: "08-15", nom: "Assomption 🇫🇷" },
  { date: "11-01", nom: "Toussaint 🇫🇷" },
  { date: "11-11", nom: "Armistice 🇫🇷" },
  { date: "12-25", nom: "Noël 🇫🇷" },
];

function calculerPaquesEtFeriesRH(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = new Date(year, month - 1, day);
  const fmtd = (d2) => {
    const mm = String(d2.getMonth() + 1).padStart(2, "0");
    const dd = String(d2.getDate()).padStart(2, "0");
    return `${mm}-${dd}`;
  };
  const addDays = (d2, n) => new Date(d2.getFullYear(), d2.getMonth(), d2.getDate() + n);
  return [
    { date: fmtd(addDays(paques, 1)), nom: "Lundi de Pâques 🇫🇷" },
    { date: fmtd(addDays(paques, 39)), nom: "Ascension 🇫🇷" },
    { date: fmtd(addDays(paques, 50)), nom: "Lundi de Pentecôte 🇫🇷" },
  ];
}

const FERIES_RDC_FIXES_RH = [
  { date: "01-01", nom: "Nouvel An 🇨🇩" },
  { date: "01-04", nom: "Martyrs de l'Indépendance 🇨🇩" },
  { date: "01-16", nom: "Héros National L.D. Kabila 🇨🇩" },
  { date: "01-17", nom: "Héros National P.E. Lumumba 🇨🇩" },
  { date: "04-06", nom: "Simon Kimbangu & Conscience Africaine 🇨🇩" },
  { date: "05-01", nom: "Fête du Travail 🇨🇩" },
  { date: "05-17", nom: "Journée des Forces Armées 🇨🇩" },
  { date: "06-30", nom: "Fête de l'Indépendance 🇨🇩" },
  { date: "08-01", nom: "Fête des Parents 🇨🇩" },
  { date: "12-25", nom: "Noël 🇨🇩" },
];

const FERIES_TN_FIXES_RH = [
  { date: "01-01", nom: "Nouvel An 🇹🇳" },
  { date: "01-14", nom: "Révolution et Jeunesse 🇹🇳" },
  { date: "03-20", nom: "Fête de l'Indépendance 🇹🇳" },
  { date: "04-09", nom: "Journée des Martyrs 🇹🇳" },
  { date: "05-01", nom: "Fête du Travail 🇹🇳" },
  { date: "07-25", nom: "Fête de la République 🇹🇳" },
  { date: "08-13", nom: "Journée de la Femme 🇹🇳" },
  { date: "10-15", nom: "Journée de l'Évacuation 🇹🇳" },
];

function getFerieInfoRH(dateISO, localisation) {
  // Un weekend n'est jamais un jour férié payé — il n'est de toute façon jamais travaillé/payé
  const jourSemaine = new Date(dateISO + "T00:00:00").getDay();
  if (jourSemaine === 0 || jourSemaine === 6) return { isFerie: false };
  const year = parseInt(dateISO.slice(0, 4));
  const mmdd = dateISO.slice(5);
  const feriesFrance = [...FERIES_FRANCE_FIXES_RH, ...calculerPaquesEtFeriesRH(year)];
  const matchFrance = feriesFrance.find(f => f.date === mmdd);
  if (matchFrance) return { isFerie: true };
  if (localisation === "RDC") {
    const match = FERIES_RDC_FIXES_RH.find(f => f.date === mmdd);
    if (match) return { isFerie: true };
  }
  if (localisation === "TN") {
    const match = FERIES_TN_FIXES_RH.find(f => f.date === mmdd);
    if (match) return { isFerie: true };
  }
  return { isFerie: false };
}

function calculDuJourRH(agent, pointagesAgent, monthParamsAgent, date) {
  const localisation = agent ? (agent.localisation || "RDC") : "RDC";
  const ferieInfo = getFerieInfoRH(date, localisation);
  const p = pointagesAgent.find(pt => pt.date === date);
  const mp = monthParamsAgent;
  const [year, month] = date.split("-").map(Number);
  const jOuvrables = joursOuvrablesRH(year, month);
  const fixeJournalier = (mp.salaireFixe || 0) / jOuvrables;

  if (ferieInfo.isFerie) return { montantJour: fixeJournalier, estFerie: true, minutesManquantes: 0 };
  if (!p || p.statut === "absent") return { montantJour: 0, estFerie: false, minutesManquantes: HEURES_JOUR_RH * 60, estAbsentNJ: p && p.statut === "absent" && !p.justifie };

  const arriveeMin = timeToMinutesRH(p.heureArrivee);
  const departMin = timeToMinutesRH(p.heureDepart);
  if (!arriveeMin && !departMin) return { montantJour: fixeJournalier, estFerie: false, minutesManquantes: 0 };

  let minutesTravaillees = 0;
  if (arriveeMin && departMin) {
    minutesTravaillees = Math.max(0, departMin - arriveeMin);
  } else if (arriveeMin && !departMin) {
    const debutMin = timeToMinutesRH(HEURE_DEBUT_RH);
    const retard = Math.max(0, arriveeMin - debutMin);
    minutesTravaillees = (HEURES_JOUR_RH * 60) - retard;
  } else if (!arriveeMin && departMin) {
    const finMin = timeToMinutesRH(HEURE_FIN_RH);
    const departAnticipe = Math.max(0, finMin - departMin);
    minutesTravaillees = (HEURES_JOUR_RH * 60) - departAnticipe;
  }
  const minutesManquantes = Math.max(0, (HEURES_JOUR_RH * 60) - minutesTravaillees);
  const tauxMin = fixeJournalier / (HEURES_JOUR_RH * 60);
  const deductionRetard = minutesManquantes * tauxMin;
  const montantJour = Math.max(0, fixeJournalier - deductionRetard);
  return { montantJour, estFerie: false, minutesManquantes, minutesTravaillees };
}

// Formate un total de minutes en "Xj Yh Zmin" (24h = 1 jour) — identique au Suivi RH
function formatRetard(totalMin) {
  const t = Math.round(totalMin || 0);
  if (t <= 0) return "0 min";
  const jours = Math.floor(t / 1440);
  const resteApresJours = t % 1440;
  const heures = Math.floor(resteApresJours / 60);
  const minutes = resteApresJours % 60;
  const parts = [];
  if (jours > 0) parts.push(`${jours}j`);
  if (heures > 0) parts.push(`${heures}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
  return parts.join(" ");
}

// Récap NET agent RDC (USD) — reprend exactement la règle du RH :
// prime d'assiduité annulée si 2 absences (justifiées ou non) ou plus
function calcNetRDC_RH(agent, pointages, monthParams, mk) {
  const pts = pointages.filter(p => p.agentId === agent.id && monthKey(p.date) === mk);
  const mp = monthParams.find(m => m.agentId === agent.id && m.mois === mk) || { salaireFixe: 0, primeAssiduite: 0, primePerformance: 0 };
  const [year, month] = mk.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  let totalFixe = 0, joursA = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dateISO = `${mk}-${String(d).padStart(2, "0")}`;
    const c = calculDuJourRH(agent, pts, mp, dateISO);
    if (c.estFerie) { totalFixe += c.montantJour; continue; }
    const p = pts.find(pt => pt.date === dateISO);
    if (!p) continue;
    totalFixe += c.montantJour;
    if (p.statut === "absent") joursA++;
  }
  const primeAss = joursA >= 2 ? 0 : (mp.primeAssiduite || 0);
  const primePerf = mp.primePerformance || 0;
  return totalFixe + primeAss + primePerf;
}

// Détails complémentaires agent RDC pour l'affichage (jours travaillés, jours d'absence, retard cumulé)
function calcDetailsRDC_RH(agent, pointages, monthParams, mk) {
  const pts = pointages.filter(p => p.agentId === agent.id && monthKey(p.date) === mk);
  const mp = monthParams.find(m => m.agentId === agent.id && m.mois === mk) || { salaireFixe: 0, primeAssiduite: 0, primePerformance: 0 };
  const [year, month] = mk.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  let joursP = 0, joursA = 0, retardTotal = 0, tempsTravailleTotal = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dateISO = `${mk}-${String(d).padStart(2, "0")}`;
    const c = calculDuJourRH(agent, pts, mp, dateISO);
    if (c.estFerie) continue;
    const p = pts.find(pt => pt.date === dateISO);
    if (!p) continue;
    if (p.statut === "absent") {
      joursA++;
    } else {
      joursP++;
      retardTotal += (c.minutesManquantes || 0);
      tempsTravailleTotal += (c.minutesTravaillees || 0);
    }
  }
  return { joursP, joursA, retardTotal, tempsTravailleTotal };
}

// Récap NET agent Tunisie (DT + équivalent USD) + détails jours/retard
function calcNetTN_RH(agent, pointages, monthParams, mk, dtToUsd) {
  const pts = pointages.filter(p => p.agentId === agent.id && monthKey(p.date) === mk);
  const mp = monthParams.find(m => m.agentId === agent.id && m.mois === mk) || { salaireFixe: 0, primeAssiduite: 0, primePerformance: 0 };
  const [year, month] = mk.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  let totalFixe = 0, joursP = 0, joursA = 0, retardTotal = 0, tempsTravailleTotal = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dateISO = `${mk}-${String(d).padStart(2, "0")}`;
    const c = calculDuJourRH(agent, pts, mp, dateISO);
    if (c.estFerie) { totalFixe += c.montantJour; continue; }
    const p = pts.find(pt => pt.date === dateISO);
    if (!p) continue;
    totalFixe += c.montantJour;
    if (p.statut === "absent") {
      joursA++;
    } else {
      joursP++;
      retardTotal += (c.minutesManquantes || 0);
      tempsTravailleTotal += (c.minutesTravaillees || 0);
    }
  }
  const primeAss = mp.primeAssiduite || 0;
  const primePerf = mp.primePerformance || 0;
  const netDT = totalFixe + primeAss + primePerf;
  return { netDT, netUSD: netDT * dtToUsd, joursP, joursA, retardTotal, tempsTravailleTotal };
}

// Charges sociales RDC — DÉSACTIVÉES jusqu'à nouvel ordre (contrats pas encore effectifs)
// Taux prévus pour réactivation : CNSS salarié 5%, IPR 15%, CNSS patronal 13%, INPP 3%, ONEM 2%
function calcChargesRDC_RH() {
  return { cnssSal: 0, ipr: 0, cnssPat: 0, inpp: 0, onem: 0, total: 0 };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [storedPassword, setStoredPassword] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [connError, setConnError] = useState("");

  const [page, setPage] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [recettes, setRecettes] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [campagnes, setCampagnes] = useState([]);
  const [taux, setTaux] = useState({ eurUsd: 1.08, usdCdf: 2800 });

  // Données RH en lecture seule (partagées avec le Suivi RH via Supabase)
  const [agentsRH, setAgentsRH] = useState([]);
  const [pointagesRH, setPointagesRH] = useState([]);
  const [monthParamsRH, setMonthParamsRH] = useState([]);
  const [dtToUsdRH, setDtToUsdRH] = useState(DT_TO_USD_DEFAULT);
  const [moisSelectionne, setMoisSelectionne] = useState(todayISO().slice(0, 7));

  // ─── Vérifier le mot de passe au démarrage ──────────────────
  useEffect(() => {
    async function checkPassword() {
      const { data, error } = await supabase.from("app_passwords").select("*").eq("app_name", APP_NAME).maybeSingle();
      if (error) { setConnError("Erreur de connexion à la base de données : " + error.message); return; }
      if (data) setStoredPassword(data.password);
      else setSetupMode(true);
    }
    checkPassword();
  }, []);

  // ─── Charger toutes les données une fois déverrouillé ───────
  useEffect(() => {
    if (!unlocked) return;
    async function loadAll() {
      const [r, d, c, t, a, p, mp] = await Promise.all([
        supabase.from("recettes").select("*"),
        supabase.from("depenses").select("*"),
        supabase.from("campagnes").select("*"),
        supabase.from("taux_change").select("*").eq("id", "main").maybeSingle(),
        supabase.from("agents").select("*").order("created_at"),
        supabase.from("pointages").select("*"),
        supabase.from("month_params").select("*"),
      ]);
      if (r.data) setRecettes(r.data);
      if (d.data) setDepenses(d.data);
      if (c.data) setCampagnes(c.data.map(x => ({ ...x, dateDebut: x.date_debut, dateFin: x.date_fin, resultatEstime: x.resultat_estime })));
      if (t.data) setTaux({ eurUsd: t.data.eur_usd, usdCdf: t.data.usd_cdf });
      if (a.data) setAgentsRH(a.data);
      if (p.data) setPointagesRH(p.data.map(x => ({ ...x, agentId: x.agent_id, heureArrivee: x.heure_arrivee, heureDepart: x.heure_depart })));
      if (mp.data) setMonthParamsRH(mp.data.map(x => ({ ...x, agentId: x.agent_id, salaireFixe: x.salaire_fixe, primePerformance: x.prime_performance, primeAssiduite: x.prime_assiduite || 0 })));
      setLoaded(true);
    }
    loadAll();
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  }, [unlocked]);

  async function handleSetupPassword() {
    if (newPw.length < 4) { setPwError("Le mot de passe doit faire au moins 4 caractères."); return; }
    if (newPw !== newPw2) { setPwError("Les deux mots de passe ne correspondent pas."); return; }
    const { error } = await supabase.from("app_passwords").insert({ app_name: APP_NAME, password: newPw });
    if (error) { setPwError("Erreur : " + error.message); return; }
    setStoredPassword(newPw);
    setSetupMode(false);
    setUnlocked(true);
  }

  function handleUnlock() {
    if (pwInput === storedPassword) { setUnlocked(true); setPwError(""); }
    else setPwError("Mot de passe incorrect.");
  }

  async function handleChangePassword(oldPw, newPassword) {
    if (oldPw !== storedPassword) return false;
    await supabase.from("app_passwords").update({ password: newPassword }).eq("app_name", APP_NAME);
    setStoredPassword(newPassword);
    return true;
  }

  async function updateTaux(newTaux) {
    setTaux(newTaux);
    await supabase.from("taux_change").update({ eur_usd: newTaux.eurUsd, usd_cdf: newTaux.usdCdf }).eq("id", "main");
  }

  // ─── Recettes ────────────────────────────────────────────────
  async function addRecette(form) {
    const newRow = { id: uid(), date: form.date, client: form.client, description: form.description, devise: form.devise, montant: parseFloat(form.montant), statut: form.statut };
    setRecettes(prev => [...prev, newRow]);
    await supabase.from("recettes").insert(newRow);
  }
  async function removeRecette(id) {
    setRecettes(prev => prev.filter(r => r.id !== id));
    await supabase.from("recettes").delete().eq("id", id);
  }
  async function updateRecette(id, form) {
    const updated = { date: form.date, client: form.client, description: form.description, devise: form.devise, montant: parseFloat(form.montant), statut: form.statut };
    setRecettes(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    await supabase.from("recettes").update(updated).eq("id", id);
  }

  // ─── Dépenses ────────────────────────────────────────────────
  async function addDepense(form) {
    const newRow = { id: uid(), date: form.date, fournisseur: form.fournisseur, categorie: form.categorie, description: form.description, devise: form.devise, montant: parseFloat(form.montant) };
    setDepenses(prev => [...prev, newRow]);
    await supabase.from("depenses").insert(newRow);
  }
  async function removeDepense(id) {
    setDepenses(prev => prev.filter(d => d.id !== id));
    await supabase.from("depenses").delete().eq("id", id);
  }
  async function updateDepense(id, form) {
    const updated = { date: form.date, fournisseur: form.fournisseur, categorie: form.categorie, description: form.description, devise: form.devise, montant: parseFloat(form.montant) };
    setDepenses(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
    await supabase.from("depenses").update(updated).eq("id", id);
  }

  // ─── Campagnes ───────────────────────────────────────────────
  async function addCampagne(form) {
    const newRow = { id: uid(), client: form.client, pays: form.pays, secteur: form.secteur, dateDebut: form.dateDebut, dateFin: form.dateFin, statut: form.statut, montant: parseFloat(form.montant) || 0, devise: form.devise, resultatEstime: parseFloat(form.resultatEstime) || 0 };
    setCampagnes(prev => [...prev, newRow]);
    await supabase.from("campagnes").insert({
      id: newRow.id, client: newRow.client, pays: newRow.pays, secteur: newRow.secteur,
      date_debut: newRow.dateDebut || null, date_fin: newRow.dateFin || null, statut: newRow.statut,
      montant: newRow.montant, devise: newRow.devise, resultat_estime: newRow.resultatEstime,
    });
  }
  async function removeCampagne(id) {
    setCampagnes(prev => prev.filter(c => c.id !== id));
    await supabase.from("campagnes").delete().eq("id", id);
  }

  // ─── Calculs dérivés ──────────────────────────────────────────
  const currentMonth = monthKey(todayISO());
  const recettesUSD = useMemo(() => recettes.map(r => ({ ...r, montantUSD: convertToUSD(r.montant, r.devise, taux) })), [recettes, taux]);
  const depensesUSD = useMemo(() => depenses.map(d => ({ ...d, montantUSD: convertToUSD(d.montant, d.devise, taux) })), [depenses, taux]);
  const totalRecettesMois = recettesUSD.filter(r => monthKey(r.date) === currentMonth).reduce((s, r) => s + r.montantUSD, 0);
  const totalDepensesMois = depensesUSD.filter(d => monthKey(d.date) === currentMonth).reduce((s, d) => s + d.montantUSD, 0);

  // Agents RH séparés par localisation (lecture seule)
  const agentsRHRDC = agentsRH.filter(a => a.localisation === "RDC" || !a.localisation);
  const agentsRHTN = agentsRH.filter(a => a.localisation === "TN");
  const moisRH = monthKey(moisSelectionne);

  // Liste de tous les mois où il existe des données (recettes, dépenses, ou paramètres RH)
  const moisDisponibles = useMemo(() => {
    const set = new Set();
    recettes.forEach(r => set.add(monthKey(r.date)));
    depenses.forEach(d => set.add(monthKey(d.date)));
    monthParamsRH.forEach(m => set.add(m.mois));
    return Array.from(set).sort().reverse();
  }, [recettes, depenses, monthParamsRH]);

  // Total des salaires versés ce mois = directement calculé depuis le Suivi RH
  // (charges sociales à la charge de l'entreprise, jamais déduites de l'agent)
  const totalSalairesMois =
    agentsRHRDC.reduce((s, agent) => s + calcNetRDC_RH(agent, pointagesRH, monthParamsRH, currentMonth), 0) +
    agentsRHTN.reduce((s, agent) => s + calcNetTN_RH(agent, pointagesRH, monthParamsRH, currentMonth, dtToUsdRH).netUSD, 0);

  // Total des charges sociales RDC du mois — désactivées jusqu'à nouvel ordre (toujours 0)
  const totalChargesSocialesMois = agentsRHRDC.reduce((s, agent) => s + calcChargesRDC_RH(agent, monthParamsRH, currentMonth).total, 0);

  // Résultat net = tout ce qui entre moins tout ce qui sort (recettes, dépenses, salaires, charges sociales)
  const resultatNet = totalRecettesMois - totalDepensesMois - totalSalairesMois - totalChargesSocialesMois;

  // Détail mois par mois (partagé entre "Récapitulatif mensuel" et "Trésorerie")
  const recapParMois = useMemo(() => {
    return moisDisponibles.map(mk => {
      const rec = recettesUSD.filter(r => monthKey(r.date) === mk).reduce((s, r) => s + r.montantUSD, 0);
      const dep = depensesUSD.filter(d => monthKey(d.date) === mk).reduce((s, d) => s + d.montantUSD, 0);
      const sal =
        agentsRHRDC.reduce((s, a) => s + calcNetRDC_RH(a, pointagesRH, monthParamsRH, mk), 0) +
        agentsRHTN.reduce((s, a) => s + calcNetTN_RH(a, pointagesRH, monthParamsRH, mk, dtToUsdRH).netUSD, 0);
      const charges = agentsRHRDC.reduce((s, a) => s + calcChargesRDC_RH(a, monthParamsRH, mk).total, 0);
      const resultat = rec - dep - sal - charges;
      return { mk, rec, dep, sal, charges, resultat };
    });
  }, [moisDisponibles, recettesUSD, depensesUSD, agentsRHRDC, agentsRHTN, pointagesRH, monthParamsRH, dtToUsdRH]);

  if (connError) return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#E0656B" }}>⚠️ {connError}</div>;
  if (setupMode) return <SetupPasswordScreen newPw={newPw} setNewPw={setNewPw} newPw2={newPw2} setNewPw2={setNewPw2} onSubmit={handleSetupPassword} error={pwError} />;
  if (!unlocked && !splashDone) return <SplashNicole onCommencer={() => setSplashDone(true)} />;
  if (!unlocked) return <LoginScreen pwInput={pwInput} setPwInput={setPwInput} onSubmit={handleUnlock} error={pwError} />;
  if (!loaded) return <div style={{ padding: 40, fontFamily: "sans-serif", color: TEXT }}>Chargement des données...</div>;

  return (
    <div className="askg-shell" style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", background: BG, color: "#E7ECF5", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <BgGlow />
      <Sidebar page={page} setPage={setPage} onLock={() => setUnlocked(false)} />
      <div className="askg-main" style={{ flex: 1, padding: "28px 36px", maxWidth: 1300, overflowX: "auto", position: "relative", zIndex: 2 }}>
        {page === "dashboard" && <DashboardPage totalRecettesMois={totalRecettesMois} totalDepensesMois={totalDepensesMois} resultatNet={resultatNet} totalSalairesMois={totalSalairesMois} totalChargesSocialesMois={totalChargesSocialesMois} taux={taux} setTaux={updateTaux} recettesUSD={recettesUSD} />}
        {page === "assistant" && <AssistantPage addDepense={addDepense} addRecette={addRecette} />}
        {page === "recettes" && <RecettesPage recettes={recettes} addRecette={addRecette} removeRecette={removeRecette} updateRecette={updateRecette} taux={taux} />}
        {page === "depenses" && <DepensesPage depenses={depenses} addDepense={addDepense} removeDepense={removeDepense} updateDepense={updateDepense} taux={taux} />}
        {page === "salaires_rh" && <SalairesRHPage agentsRDC={agentsRHRDC} agentsTN={agentsRHTN} pointages={pointagesRH} monthParams={monthParamsRH} dtToUsd={dtToUsdRH} setDtToUsd={setDtToUsdRH} moisSelectionne={moisSelectionne} setMoisSelectionne={setMoisSelectionne} moisRH={moisRH} />}
        {page === "campagnes" && <CampagnesPage campagnes={campagnes} addCampagne={addCampagne} removeCampagne={removeCampagne} taux={taux} />}
        {page === "recap_mensuel" && <RecapMensuelPage recapParMois={recapParMois} />}
        {page === "tresorerie" && <TresoreriePage recapParMois={recapParMois} />}
        {page === "parametres" && <ParametresPage onChangePassword={handleChangePassword} />}
      </div>
    </div>
  );
}

// ============================================================
// ÉCRANS DE CONNEXION
// ============================================================
function SetupPasswordScreen({ newPw, setNewPw, newPw2, setNewPw2, onSubmit, error }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: "'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <BgGlow />
      <div style={{ position: "relative", zIndex: 2, background: SURFACE, backdropFilter: "blur(20px)", border: `1px solid ${LINE}`, borderRadius: 16, padding: 36, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 700, textAlign: "center" }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: RED, boxShadow: `0 0 10px ${RED}`, animation: "askgPulse 1.6s ease-in-out infinite" }} />
          ASK GROUP SARL
        </div>
        <h1 style={{ fontSize: 20, textAlign: "center", color: TEXT, margin: "8px 0 4px" }}>Nicole — Première utilisation</h1>
        <p style={{ fontSize: 12.5, color: TEXT_MUTED, textAlign: "center", marginBottom: 24 }}>Crée ton mot de passe. Tu seras le seul à le connaître.</p>
        <label style={labelStyle}>Nouveau mot de passe</label>
        <PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)} style={loginInputStyle} placeholder="Au moins 4 caractères" />
        <label style={{ ...labelStyle, marginTop: 12 }}>Confirme le mot de passe</label>
        <PasswordInput value={newPw2} onChange={e => setNewPw2(e.target.value)} style={loginInputStyle} placeholder="Retape le mot de passe" />
        {error && <div style={{ color: "#E0656B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button className="askg-btn" onClick={(e) => { ripple(e); onSubmit(); }} style={{ width: "100%", background: `linear-gradient(135deg, ${RED}, #A31D14)`, color: "white", border: "none", padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer", position: "relative", overflow: "hidden" }}>Créer mon mot de passe</button>
      </div>
    </div>
  );
}

function LoginScreen({ pwInput, setPwInput, onSubmit, error }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: "'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <BgGlow />
      <div style={{ position: "relative", zIndex: 2, background: SURFACE, backdropFilter: "blur(20px)", border: `1px solid ${LINE}`, borderRadius: 16, padding: 40, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,.5)", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: RED, boxShadow: `0 0 10px ${RED}`, animation: "askgPulse 1.6s ease-in-out infinite" }} />
          ASK GROUP SARL
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "10px 0 4px", fontFamily: "'Georgia', serif", background: `linear-gradient(120deg, ${RED}, ${RED_LIGHT})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Nicole</h1>
        <p style={{ fontSize: 12.5, color: TEXT_MUTED, marginBottom: 24, fontStyle: "italic" }}>« Bonsoir. Que dois-je noter aujourd'hui ? »</p>
        <label style={labelStyle}>Mot de passe</label>
        <PasswordInput value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && onSubmit()} style={loginInputStyle} placeholder="Saisis ton mot de passe" autoFocus />
        {error && <div style={{ color: "#E0656B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button className="askg-btn" onClick={(e) => { ripple(e); onSubmit(); }} style={{ width: "100%", background: `linear-gradient(135deg, ${RED}, #A31D14)`, color: "white", border: "none", padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer", position: "relative", overflow: "hidden" }}>Parler à Nicole</button>
        <div style={{ textAlign: "center", fontSize: 11, color: TEXT_MUTED, marginTop: 16 }}>Accès strictement réservé à la Direction</div>
      </div>
    </div>
  );
}

function SplashNicole({ onCommencer }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: "'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <BgGlow />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: TEXT_MUTED, fontWeight: 600, opacity: 0, animation: "askgRevealUp 1s ease forwards", animationDelay: ".6s" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: RED, display: "inline-block", marginRight: 8, boxShadow: `0 0 14px ${RED}`, animation: "askgPulse 1.6s ease-in-out infinite", verticalAlign: "middle" }} />
          ASK GROUP SARL
        </div>
        <div style={{ fontFamily: "'Georgia', serif", fontSize: 26, fontWeight: 600, color: "#D3E0F0", marginTop: 16, opacity: 0, animation: "askgRevealUp 1.2s cubic-bezier(.16,1,.3,1) forwards", animationDelay: "1.8s" }}>
          Faites vos comptes avec
        </div>
        <div style={{
          fontFamily: "'Georgia', serif", fontSize: "clamp(60px, 11vw, 104px)", fontWeight: 800, marginTop: 6, letterSpacing: 1,
          background: `linear-gradient(120deg, ${RED}, ${RED_LIGHT} 40%, #FFFFFF 85%)`,
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          filter: `drop-shadow(0 0 50px ${RED}66)`,
          opacity: 0, animation: "askgNomIn 2.6s cubic-bezier(.16,1,.3,1) forwards", animationDelay: "3.2s",
        }}>
          Nicole
        </div>
        <div style={{ fontSize: 14, color: TEXT_MUTED, marginTop: 22, opacity: 0, animation: "askgRevealUp 1s ease forwards", animationDelay: "5.6s", fontWeight: 500 }}>
          Votre secrétaire comptable. Parlez-moi, je tiens les comptes.
        </div>
        <div style={{ marginTop: 42, opacity: 0, animation: "askgRevealUp 1.2s cubic-bezier(.16,1,.3,1) forwards", animationDelay: "6.6s" }}>
          <button
            className="askg-btn"
            onClick={(e) => { ripple(e); onCommencer(); }}
            style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${RED}, #A31D14)`, color: "white", border: "none", padding: "16px 46px", borderRadius: 99, fontFamily: "'Georgia', serif", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 14px 38px ${RED}66` }}
          >Entrer</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STYLE RESPONSIVE (mobile / iPhone)
// ============================================================
const RESPONSIVE_CSS = `
@media (max-width: 768px) {
  .askg-shell { flex-direction: column !important; }
  .askg-sidebar { width: 100% !important; padding: 12px 0 !important; }
  .askg-sidebar-header { padding: 0 16px 12px !important; margin-bottom: 8px !important; }
  .askg-sidebar-nav { display: flex !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; padding: 0 8px !important; }
  .askg-sidebar-nav > div { white-space: nowrap !important; padding: 8px 14px !important; border-left: none !important; border-bottom: 3px solid transparent !important; }
  .askg-sidebar-footer { margin: 8px 16px 0 !important; }
  .askg-main { padding: 14px !important; max-width: 100% !important; }
  .askg-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
  table { font-size: 11px !important; }
  h1 { font-size: 18px !important; }
}
`;

// ============================================================
// SIDEBAR
// ============================================================
// ============================================================
// ASSISTANT — analyse un texte libre (tapé ou dicté) pour pré-remplir
// automatiquement une dépense ou une recette. Fonctionne par mots-clés
// (pas une vraie IA) : gratuit, mais à corriger/valider avant d'enregistrer.
// ============================================================
const MOTS_DEPENSE = ["dépensé", "depense", "payé", "paye", "acheté", "achete", "facture", "sorti", "sortie", "réglé", "regle"];
const MOTS_RECETTE = ["reçu", "recu", "encaissé", "encaisse", "rentrée", "rentree", "entrée", "entree", "vente", "vendu", "client m'a payé", "paiement reçu", "dépôt", "depot", "déposé", "depose", "apport"];
const MOTS_CATEGORIE = [
  { motsClefs: ["loyer", "local", "bureau à louer"], categorie: "Loyer & charges locaux" },
  { motsClefs: ["internet", "téléphon", "telephon", "wifi", "forfait"], categorie: "Internet & téléphonie" },
  { motsClefs: ["crm", "voip", "onoff", "logiciel", "abonnement logiciel"], categorie: "Logiciels CRM & VoIP" },
  { motsClefs: ["ordinateur", "pc ", "matériel", "materiel", "imprimante", "casque", "écran", "ecran"], categorie: "Matériel informatique" },
  { motsClefs: ["électricité", "electricite", "courant", "eau", "snel", "regideso"], categorie: "Électricité & eau" },
  { motsClefs: ["transport", "essence", "carburant", "taxi", "uber", "moto"], categorie: "Transport" },
  { motsClefs: ["fourniture", "papier", "stylo", "encre", "cartouche"], categorie: "Fournitures de bureau" },
  { motsClefs: ["formation", "cours", "séminaire", "seminaire"], categorie: "Formation" },
  { motsClefs: ["frais bancaire", "banque", "virement", "commission bancaire"], categorie: "Frais bancaires" },
  { motsClefs: ["taxe", "impôt", "impot", "fiscal"], categorie: "Taxes & impôts" },
];

const MOIS_FR = { "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "juillet": 7, "août": 8, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12 };

function analyserTexte(texteBrut) {
  const texte = texteBrut.toLowerCase();

  // --- Date : cherche d'abord une vraie date écrite (en lettres ou en chiffres),
  // sinon "hier"/"aujourd'hui", sinon la date du jour par défaut.
  // On retire la date détectée du texte avant de chercher le montant, pour ne pas
  // confondre le jour de la date (ex: le "10" de "10 juillet") avec un montant.
  let date = todayISO();
  let texteSansDate = texte;
  const matchDateLettres = texte.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+(\d{4}))?/);
  const matchDateChiffres = texte.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (matchDateLettres) {
    const jour = matchDateLettres[1].padStart(2, "0");
    const mois = String(MOIS_FR[matchDateLettres[2]]).padStart(2, "0");
    const annee = matchDateLettres[3] || String(new Date().getFullYear());
    date = `${annee}-${mois}-${jour}`;
    texteSansDate = texte.replace(matchDateLettres[0], " ");
  } else if (matchDateChiffres) {
    const jour = matchDateChiffres[1].padStart(2, "0");
    const mois = matchDateChiffres[2].padStart(2, "0");
    let annee = matchDateChiffres[3];
    if (annee.length === 2) annee = "20" + annee;
    date = `${annee}-${mois}-${jour}`;
    texteSansDate = texte.replace(matchDateChiffres[0], " ");
  } else if (texte.includes("hier")) {
    const d = new Date(); d.setDate(d.getDate() - 1);
    date = d.toISOString().slice(0, 10);
  }

  // --- Montant (cherché dans le texte SANS la date, pour éviter toute confusion) ---
  const matchMontant = texteSansDate.match(/(\d+[.,]?\d*)/);
  const montant = matchMontant ? matchMontant[1].replace(",", ".") : "";

  // --- Devise ---
  let devise = "USD";
  if (/eur|€|euro/.test(texte)) devise = "EUR";
  else if (/cdf|fc\b|franc congolais|franc/.test(texte)) devise = "CDF";
  else if (/usd|\$|dollar/.test(texte)) devise = "USD";

  // --- Type : dépense ou recette (comptage de mots-clés, dépense par défaut si égalité) ---
  const scoreDepense = MOTS_DEPENSE.filter(m => texte.includes(m)).length;
  const scoreRecette = MOTS_RECETTE.filter(m => texte.includes(m)).length;
  const type = scoreRecette > scoreDepense ? "recette" : "depense";

  // --- Catégorie (dépenses uniquement) ---
  let categorie = CATEGORIES_DEPENSES[CATEGORIES_DEPENSES.length - 1]; // "Autres" par défaut
  for (const c of MOTS_CATEGORIE) {
    if (c.motsClefs.some(m => texte.includes(m))) { categorie = c.categorie; break; }
  }

  // --- Nom (client ou fournisseur) : cherche après "chez", "pour", "de la part de" ---
  let nom = "";
  const matchNom = texteBrut.match(/(?:chez|pour|de la part de|par)\s+([A-ZÀ-Ý][\wÀ-ÿ' -]{1,30})/);
  if (matchNom) nom = matchNom[1].trim();

  return { montant, devise, type, categorie, date, nom, description: texteBrut.trim() };
}

function AssistantPage({ addDepense, addRecette }) {
  const [texte, setTexte] = useState("");
  const [ecoute, setEcoute] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [saved, setSaved] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [erreurIA, setErreurIA] = useState("");
  const recognitionRef = useRef(null);

  function toggleEcoute() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { window.alert("La dictée vocale n'est pas prise en charge par ce navigateur. Tu peux quand même taper le texte."); return; }
    if (ecoute) { recognitionRef.current?.stop(); return; }
    const texteDeDepart = texte ? texte + " " : "";
    let finalAccumule = "";
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;   // continue d'écouter tant qu'on n'a pas cliqué sur "Arrêter"
    recognition.interimResults = true; // affiche le texte en direct pendant qu'on parle
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalAccumule += transcript + " ";
        else interim += transcript;
      }
      setTexte(texteDeDepart + finalAccumule + interim);
    };
    recognition.onend = () => setEcoute(false);
    recognition.onerror = () => setEcoute(false);
    recognitionRef.current = recognition;
    recognition.start();
    setEcoute(true);
  }

  async function analyser() {
    if (!texte.trim()) return;
    setAnalysing(true);
    setErreurIA("");
    try {
      const { data, error } = await supabase.functions.invoke("analyser-texte-nicole", { body: { texte } });
      if (error || !data || data.error) throw new Error(data?.error || error?.message || "Erreur inconnue");
      setResultat(data);
    } catch (e) {
      // Repli automatique : si Gemini est indisponible, on garde l'ancien système par mots-clés
      // pour que le formulaire se remplisse quand même, avec un message clair.
      setErreurIA("⚠️ Nicole n'a pas pu joindre son IA (repli sur la reconnaissance simple par mots-clés). " + e.message);
      setResultat(analyserTexte(texte));
    }
    setAnalysing(false);
    setSaved(false);
  }

  function enregistrer() {
    if (!resultat || !resultat.montant) return;
    if (resultat.type === "depense") {
      addDepense({ date: resultat.date, fournisseur: resultat.nom, categorie: resultat.categorie, description: resultat.description, devise: resultat.devise, montant: resultat.montant });
    } else {
      addRecette({ date: resultat.date, client: resultat.nom, description: resultat.description, devise: resultat.devise, montant: resultat.montant, statut: "Reçu" });
    }
    setSaved(true);
    setTexte("");
    setResultat(null);
  }

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>💬 Parler à Nicole</h1>
        <div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3, fontStyle: "italic" }}>« Dis-moi ce qui s'est passé, avec tes mots — je m'occupe de tout organiser. Vérifie toujours ce que je propose avant d'enregistrer. »</div>
      </div>
      <Panel title="Décris ce qui s'est passé">
        <textarea
          value={texte}
          onChange={e => setTexte(e.target.value)}
          placeholder="Ex : « J'ai payé 45 dollars pour l'électricité hier » ou « Le client Kevin a payé 120 dollars aujourd'hui »"
          rows={4}
          style={{ width: "100%", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 12, fontSize: 13.5, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button className="askg-btn" onClick={(e) => { ripple(e); toggleEcoute(); }} style={{ background: ecoute ? "#E0656B" : "rgba(255,255,255,.08)", color: ecoute ? "white" : "#E7ECF5", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12.5, position: "relative", overflow: "hidden" }}>
            {ecoute ? "⏺ Écoute en cours… (clique pour arrêter)" : "🎙️ Parler au lieu d'écrire"}
          </button>
          <button className="askg-btn" onClick={(e) => { if (texte.trim() && !analysing) { ripple(e); analyser(); } }} disabled={!texte.trim() || analysing} style={{ background: `linear-gradient(135deg, ${RED}, #A31D14)`, color: "white", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: (texte.trim() && !analysing) ? "pointer" : "not-allowed", fontSize: 12.5, opacity: (texte.trim() && !analysing) ? 1 : .5, position: "relative", overflow: "hidden" }}>
            {analysing ? "Nicole réfléchit…" : "Analyser"}
          </button>
        </div>
        {erreurIA && <div style={{ marginTop: 10, fontSize: 11.5, color: "#D4A72C" }}>{erreurIA}</div>}
      </Panel>

      {resultat && (
        <Panel title="Vérifie et corrige avant d'enregistrer">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Type">
              <select value={resultat.type} onChange={e => setResultat({ ...resultat, type: e.target.value })} style={inputStyle}>
                <option value="depense">Dépense (sortie d'argent)</option>
                <option value="recette">Recette (entrée d'argent)</option>
              </select>
            </Field>
            <Field label="Date"><input type="date" value={resultat.date} onChange={e => setResultat({ ...resultat, date: e.target.value })} style={inputStyle} /></Field>
            <Field label={resultat.type === "depense" ? "Fournisseur" : "Client"}>
              <input type="text" value={resultat.nom} onChange={e => setResultat({ ...resultat, nom: e.target.value })} placeholder="Nom (à vérifier)" style={{ ...inputStyle, width: 160 }} />
            </Field>
            {resultat.type === "depense" && (
              <Field label="Catégorie">
                <select value={resultat.categorie} onChange={e => setResultat({ ...resultat, categorie: e.target.value })} style={{ ...inputStyle, width: 180 }}>
                  {CATEGORIES_DEPENSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            )}
            <Field label="Devise">
              <select value={resultat.devise} onChange={e => setResultat({ ...resultat, devise: e.target.value })} style={inputStyle}>
                <option>USD</option><option>EUR</option><option>CDF</option>
              </select>
            </Field>
            <Field label="Montant"><input type="number" value={resultat.montant} onChange={e => setResultat({ ...resultat, montant: e.target.value })} style={{ ...inputStyle, width: 100 }} /></Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="askg-btn" onClick={(e) => { if (resultat.montant) { ripple(e); enregistrer(); } }} disabled={!resultat.montant} style={{ background: "#4CAF7D", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: resultat.montant ? "pointer" : "not-allowed", fontSize: 13, opacity: resultat.montant ? 1 : .5, position: "relative", overflow: "hidden" }}>
              ✓ Tout est bon, enregistrer
            </button>
          </div>
        </Panel>
      )}
      {saved && <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(76,175,125,.18)", color: "#4CAF7D", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ Enregistré avec succès.</div>}
    </>
  );
}

// ─── Styles globaux et fond animé "verre bleu nuit" ─────────
const GLOBAL_CSS = `
@keyframes askgFloatA { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(35px,-25px) scale(1.08); } }
@keyframes askgFloatB { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(-30px,20px) scale(1.06); } }
@keyframes askgRevealUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
@keyframes askgNomIn { 0% { opacity:0; transform:translateY(28px) scale(.88); letter-spacing:10px; } 60% { opacity:1; } 100% { opacity:1; transform:translateY(0) scale(1); letter-spacing:1px; } }
@keyframes askgPulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
@keyframes askgRipple { to { transform:scale(3.5); opacity:0; } }
@keyframes askgPageIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
.askg-btn { transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease, filter .2s ease; }
.askg-btn:hover { filter:brightness(1.12); transform:translateY(-1px); }
.askg-btn:active { transform:scale(.94); }
.askg-panel:hover { border-color:rgba(214,43,31,.3) !important; }
.askg-tab:hover { opacity:.85 !important; }
`;

// Champ mot de passe avec bouton voir/cacher (👁), comme sur Kate
function PasswordInput({ value, onChange, style, placeholder, onKeyDown, autoFocus }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 38, boxSizing: "border-box", width: style?.width || "100%" }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: 4, color: TEXT_MUTED, lineHeight: 1 }}
        tabIndex={-1}
      >{visible ? "🙈" : "👁"}</button>
    </div>
  );
}

function ripple(e) {
  const btn = e.currentTarget;
  const circle = document.createElement("span");
  circle.style.position = "absolute";
  circle.style.borderRadius = "50%";
  circle.style.background = "rgba(255,255,255,.5)";
  circle.style.transform = "scale(0)";
  circle.style.animation = "askgRipple .6s ease-out";
  circle.style.pointerEvents = "none";
  const rect = btn.getBoundingClientRect();
  circle.style.width = circle.style.height = "140px";
  circle.style.left = (e.clientX - rect.left - 70) + "px";
  circle.style.top = (e.clientY - rect.top - 70) + "px";
  if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
  btn.style.overflow = "hidden";
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

function BgGlow() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", filter: "blur(90px)", background: "#2E6FA5", opacity: .28, top: -160, left: -100, animation: "askgFloatA 15s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", filter: "blur(90px)", background: "#4A8FC7", opacity: .22, bottom: -140, right: -80, animation: "askgFloatB 13s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", filter: "blur(90px)", background: RED, opacity: .18, top: "38%", right: "8%", animation: "askgFloatA 17s ease-in-out infinite reverse" }} />
    </div>
  );
}

function Sidebar({ page, setPage, onLock }) {
  const items = [["dashboard", "Tableau de bord"], ["assistant", "💬 Parler à Nicole"], ["recettes", "Recettes"], ["depenses", "Dépenses"], ["salaires_rh", "Salaires"], ["campagnes", "Campagnes Clients"], ["recap_mensuel", "Récapitulatif mensuel"], ["tresorerie", "Trésorerie"], ["parametres", "Paramètres"]];
  return (
    <div className="askg-sidebar" style={{ width: 240, background: "rgba(14,21,34,.9)", backdropFilter: "blur(20px)", borderRight: `1px solid ${LINE}`, color: TEXT, padding: "26px 0", flexShrink: 0, position: "relative", zIndex: 2 }}>
      <style>{RESPONSIVE_CSS}</style>
      <div className="askg-sidebar-header" style={{ padding: "0 24px 22px", borderBottom: `1px solid ${LINE}`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: RED, boxShadow: `0 0 10px ${RED}`, animation: "askgPulse 1.6s ease-in-out infinite" }} />
          ASK GROUP
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, fontFamily: "'Georgia', serif", background: `linear-gradient(120deg, ${RED}, ${RED_LIGHT})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Nicole</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 4 }}>🟢 Données partagées en ligne</div>
      </div>
      <div className="askg-sidebar-nav">
        {items.map(([key, label]) => (
          <div key={key} className="askg-tab" onClick={() => setPage(key)} style={{
            margin: "3px 12px", padding: "12px 16px", fontSize: 13, cursor: "pointer", borderRadius: page === key ? "0 8px 8px 0" : 8,
            borderLeft: page === key ? `3px solid ${RED}` : "3px solid transparent",
            background: page === key ? `linear-gradient(90deg, rgba(214,43,31,.22), rgba(214,43,31,.05))` : "transparent",
            color: page === key ? "#FFD9D2" : "rgba(231,236,245,.65)", fontWeight: page === key ? 700 : 400,
            transition: "all .2s ease", opacity: page === key ? 1 : .75,
          }}>{label}</div>
        ))}
      </div>
      <div className="askg-sidebar-footer" style={{ margin: "24px 24px 0" }}>
        <button className="askg-btn" onClick={(e) => { ripple(e); onLock(); }} style={{ width: "100%", background: "rgba(255,255,255,.06)", color: "rgba(231,236,245,.8)", border: `1px solid ${LINE}`, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", position: "relative", overflow: "hidden" }}>🔒 Verrouiller la session</button>
      </div>
    </div>
  );
}

// ============================================================
// PAGE : TABLEAU DE BORD
// ============================================================
function DashboardPage({ totalRecettesMois, totalDepensesMois, resultatNet, totalSalairesMois, totalChargesSocialesMois, taux, setTaux, recettesUSD }) {
  const recentRecettes = [...recettesUSD].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Tableau de bord financier</h1>
        <div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>ASK GROUP SARL · Devise de référence : USD</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 22 }}>
        <Kpi label="Recettes du mois" value={fmt(totalRecettesMois)} color="#4CAF7D" />
        <Kpi label="Dépenses du mois" value={fmt(totalDepensesMois)} color="#E0656B" />
        <Kpi label="Salaires versés ce mois" value={fmt(totalSalairesMois)} color="#D4A72C" />
        <Kpi label="Charges sociales du mois" value={fmt(totalChargesSocialesMois)} color="#FD7E14" />
        <Kpi label="Résultat net" value={fmt(resultatNet)} color={resultatNet >= 0 ? "#4CAF7D" : "#E0656B"} />
      </div>
      <div style={{ fontSize: 11, color: "#8CA3C2", marginTop: -12, marginBottom: 18 }}>ℹ️ Résultat net = Recettes − Dépenses − Salaires versés − Charges sociales, pour le mois en cours.</div>
      <Panel title="Taux de change actifs — Mets à jour selon le taux FirstBank du jour">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div><label style={labelStyle}>1 EUR =</label><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="number" step="0.01" value={taux.eurUsd} onChange={e => setTaux({ ...taux, eurUsd: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 90 }} /><span style={{ fontSize: 12, color: "#8CA3C2" }}>USD</span></div></div>
          <div><label style={labelStyle}>1 USD =</label><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="number" value={taux.usdCdf} onChange={e => setTaux({ ...taux, usdCdf: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 90 }} /><span style={{ fontSize: 12, color: "#8CA3C2" }}>CDF</span></div></div>
        </div>
        <div style={{ fontSize: 11, color: "#8CA3C2", marginTop: 10 }}>💡 Ces taux servent à convertir automatiquement les recettes/dépenses/campagnes saisies en EUR ou CDF vers l'USD partout dans le logiciel.</div>
      </Panel>
      <Panel title="Dernières recettes enregistrées">
        {recentRecettes.length === 0 ? <EmptyState text="Aucune recette enregistrée encore." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Date</Th><Th>Client</Th><Th>Description</Th><Th>Devise</Th><Th>Montant USD</Th></tr></thead>
            <tbody>{recentRecettes.map(r => (<tr key={r.id}><Td>{new Date(r.date).toLocaleDateString("fr-FR")}</Td><Td><b>{r.client}</b></Td><Td>{r.description}</Td><Td>{r.devise}</Td><Td><b style={{ color: "#4CAF7D" }}>{fmt(r.montantUSD)}</b></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : RECETTES
// ============================================================
function RecettesPage({ recettes, addRecette, removeRecette, updateRecette, taux }) {
  const emptyForm = { date: todayISO(), client: "", description: "", devise: "USD", montant: "", statut: "Reçu" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function submit() {
    if (!form.client || !form.montant) return;
    if (editingId) { updateRecette(editingId, form); setEditingId(null); }
    else { addRecette(form); }
    setForm(emptyForm);
  }
  function startEdit(r) {
    setForm({ date: r.date, client: r.client, description: r.description || "", devise: r.devise, montant: String(r.montant), statut: r.statut });
    setEditingId(r.id);
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  const total = recettes.reduce((s, r) => s + convertToUSD(r.montant, r.devise, taux), 0);
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Recettes</h1><div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Enregistre chaque paiement reçu</div></div>
      <Panel title={editingId ? "Modifier la recette" : "Ajouter une recette"}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
          <Field label="Client"><input type="text" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Nom du client" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détail" style={{ ...inputStyle, width: 180 }} /></Field>
          <Field label="Devise"><select value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })} style={inputStyle}><option>USD</option><option>EUR</option><option>CDF</option></select></Field>
          <Field label="Montant"><input type="number" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder="0.00" style={{ ...inputStyle, width: 100 }} /></Field>
          <Field label="Statut"><select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}><option>Reçu</option><option>En attente</option><option>Partiel</option><option>Annulé</option></select></Field>
          <button onClick={submit} style={{ background: GOLD, color: TEXT, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{editingId ? "Enregistrer" : "+ Ajouter"}</button>
          {editingId && <button onClick={cancelEdit} style={{ background: "rgba(255,255,255,.08)", color: "#8CA3C2", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Annuler</button>}
        </div>
      </Panel>
      <Panel title={`Toutes les recettes — Total : ${fmt(total)}`}>
        {recettes.length === 0 ? <EmptyState text="Aucune recette enregistrée." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Date</Th><Th>Client</Th><Th>Description</Th><Th>Devise</Th><Th>Montant</Th><Th>USD</Th><Th>Statut</Th><Th></Th></tr></thead>
            <tbody>{[...recettes].sort((a, b) => b.date.localeCompare(a.date)).map(r => (<tr key={r.id}><Td>{new Date(r.date).toLocaleDateString("fr-FR")}</Td><Td><b>{r.client}</b></Td><Td>{r.description}</Td><Td>{r.devise}</Td><Td>{r.montant}</Td><Td><b style={{ color: "#4CAF7D" }}>{fmt(convertToUSD(r.montant, r.devise, taux))}</b></Td><Td><StatutBadge value={r.statut} /></Td><Td><div style={{ display: "flex", gap: 6 }}><button onClick={() => startEdit(r)} style={editBtnStyle}>Modifier</button><button onClick={() => removeRecette(r.id)} style={delBtnStyle}>Suppr.</button></div></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : DÉPENSES
// ============================================================
function DepensesPage({ depenses, addDepense, removeDepense, updateDepense, taux }) {
  const categories = CATEGORIES_DEPENSES;
  const emptyForm = { date: todayISO(), fournisseur: "", categorie: categories[0], description: "", devise: "USD", montant: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function submit() {
    if (!form.fournisseur || !form.montant) return;
    if (editingId) { updateDepense(editingId, form); setEditingId(null); }
    else { addDepense(form); }
    setForm(emptyForm);
  }
  function startEdit(d) {
    setForm({ date: d.date, fournisseur: d.fournisseur, categorie: d.categorie, description: d.description || "", devise: d.devise, montant: String(d.montant) });
    setEditingId(d.id);
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  const total = depenses.reduce((s, d) => s + convertToUSD(d.montant, d.devise, taux), 0);
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Dépenses</h1><div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Enregistre chaque dépense de la société</div></div>
      <Panel title={editingId ? "Modifier la dépense" : "Ajouter une dépense"}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
          <Field label="Fournisseur"><input type="text" value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} placeholder="Nom" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Catégorie"><select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} style={{ ...inputStyle, width: 180 }}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détail" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Devise"><select value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })} style={inputStyle}><option>USD</option><option>EUR</option><option>CDF</option></select></Field>
          <Field label="Montant"><input type="number" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder="0.00" style={{ ...inputStyle, width: 100 }} /></Field>
          <button onClick={submit} style={{ background: GOLD, color: TEXT, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{editingId ? "Enregistrer" : "+ Ajouter"}</button>
          {editingId && <button onClick={cancelEdit} style={{ background: "rgba(255,255,255,.08)", color: "#8CA3C2", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Annuler</button>}
        </div>
      </Panel>
      <Panel title={`Toutes les dépenses — Total : ${fmt(total)}`}>
        {depenses.length === 0 ? <EmptyState text="Aucune dépense enregistrée." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Date</Th><Th>Fournisseur</Th><Th>Catégorie</Th><Th>Description</Th><Th>Montant</Th><Th>USD</Th><Th></Th></tr></thead>
            <tbody>{[...depenses].sort((a, b) => b.date.localeCompare(a.date)).map(d => (<tr key={d.id}><Td>{new Date(d.date).toLocaleDateString("fr-FR")}</Td><Td><b>{d.fournisseur}</b></Td><Td>{d.categorie}</Td><Td>{d.description}</Td><Td>{d.montant} {d.devise}</Td><Td><b style={{ color: "#E0656B" }}>{fmt(convertToUSD(d.montant, d.devise, taux))}</b></Td><Td><div style={{ display: "flex", gap: 6 }}><button onClick={() => startEdit(d)} style={editBtnStyle}>Modifier</button><button onClick={() => removeDepense(d.id)} style={delBtnStyle}>Suppr.</button></div></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : SALAIRES — LECTURE SEULE, DONNÉES DU SUIVI RH
// (charges sociales assumées par l'entreprise, jamais déduites de l'agent)
// ============================================================
function SalairesRHPage({ agentsRDC, agentsTN, pointages, monthParams, dtToUsd, setDtToUsd, moisSelectionne, setMoisSelectionne, moisRH }) {
  const [yLabel, mLabel] = moisSelectionne.split("-").map(Number);
  const monthLabel = new Date(yLabel, mLabel - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Salaires — {monthLabel}</h1>
          <div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Données en lecture seule, calculées depuis le Suivi RH</div>
        </div>
        <input type="month" value={moisSelectionne} onChange={e => setMoisSelectionne(e.target.value)} style={{ background: SURFACE, border: "1px solid rgba(255,255,255,.1)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: TEXT }} />
      </div>

      <Panel title="💱 Taux DT → USD (indépendant de celui du Suivi RH — mets-le à jour ici aussi)">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={labelStyle}>1 DT =</label>
          <input type="number" step="0.001" value={dtToUsd} onChange={e => setDtToUsd(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 100 }} />
          <span style={{ fontSize: 12, color: "#8CA3C2" }}>USD</span>
        </div>
      </Panel>

      <Panel title={`🇨🇩 Agents RDC (${agentsRDC.length}) — Salaire net à verser (USD)`}>
        {agentsRDC.length === 0 ? <EmptyState text="Aucun agent RDC dans le Suivi RH." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><Th>Agent</Th><Th>Jours travaillés</Th><Th>Jours d'absence</Th><Th>Temps travaillé</Th><Th>Retard cumulé</Th><Th>Salaire net à verser</Th></tr></thead>
              <tbody>
                {agentsRDC.map(agent => {
                  const net = calcNetRDC_RH(agent, pointages, monthParams, moisRH);
                  const det = calcDetailsRDC_RH(agent, pointages, monthParams, moisRH);
                  return (
                    <tr key={agent.id}>
                      <Td><b>{agent.nom}</b></Td>
                      <Td>{det.joursP}</Td>
                      <Td><span style={{ background: det.joursA >= 2 ? "rgba(214,43,31,.18)" : "rgba(76,175,125,.18)", color: det.joursA >= 2 ? "#E0656B" : "#4CAF7D", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{det.joursA}</span></Td>
                      <Td>{formatRetard(det.tempsTravailleTotal)}</Td>
                      <Td>{formatRetard(det.retardTotal)}</Td>
                      <Td><b style={{ color: "#4CAF7D", fontSize: 13 }}>{fmt(net)}</b></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`🏛 Charges sociales RDC (${agentsRDC.length}) — À la charge de la société, jamais déduites de l'agent`}>
        <div style={{ fontSize: 11, color: "#E0656B", marginBottom: 10, fontWeight: 600 }}>⏸️ Désactivées jusqu'à nouvel ordre — les contrats officiels ne sont pas encore effectifs. Toutes les valeurs ci-dessous sont à 0.</div>
        {agentsRDC.length === 0 ? <EmptyState text="Aucun agent RDC dans le Suivi RH." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><Th>Agent</Th><Th>CNSS salarié (5%)</Th><Th>IPR (15%)</Th><Th>CNSS patronal (13%)</Th><Th>INPP (3%)</Th><Th>ONEM (2%)</Th><Th>Total charges société</Th></tr></thead>
              <tbody>
                {agentsRDC.map(agent => {
                  const ch = calcChargesRDC_RH(agent, monthParams, moisRH);
                  return (
                    <tr key={agent.id}>
                      <Td><b>{agent.nom}</b></Td>
                      <Td style={{ color: "#E0656B" }}>{fmt(ch.cnssSal)}</Td>
                      <Td style={{ color: "#E0656B" }}>{fmt(ch.ipr)}</Td>
                      <Td style={{ color: "#FD7E14" }}>{fmt(ch.cnssPat)}</Td>
                      <Td style={{ color: "#FD7E14" }}>{fmt(ch.inpp)}</Td>
                      <Td style={{ color: "#FD7E14" }}>{fmt(ch.onem)}</Td>
                      <Td><b>{fmt(ch.total)}</b></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`🇹🇳 Agents Tunisie (${agentsTN.length}) — Salaire net à verser (DT + équivalent USD)`}>
        {agentsTN.length === 0 ? <EmptyState text="Aucun agent Tunisie dans le Suivi RH." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><Th>Agent</Th><Th>Jours travaillés</Th><Th>Jours d'absence</Th><Th>Temps travaillé</Th><Th>Retard cumulé</Th><Th>Salaire net à verser (DT)</Th><Th>Équivalent (USD)</Th></tr></thead>
              <tbody>
                {agentsTN.map(agent => {
                  const r = calcNetTN_RH(agent, pointages, monthParams, moisRH, dtToUsd);
                  return (
                    <tr key={agent.id}>
                      <Td><b>{agent.nom}</b></Td>
                      <Td>{r.joursP}</Td>
                      <Td><span style={{ background: "rgba(76,175,125,.18)", color: "#4CAF7D", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{r.joursA}</span></Td>
                      <Td>{formatRetard(r.tempsTravailleTotal)}</Td>
                      <Td>{formatRetard(r.retardTotal)}</Td>
                      <Td><b style={{ color: "#D4A72C", fontSize: 13 }}>{fmt(r.netDT, "DT")}</b></Td>
                      <Td><b style={{ color: "#4CAF7D" }}>{fmt(r.netUSD)}</b></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div style={{ fontSize: 11, color: "#8CA3C2" }}>ℹ️ Cette section reflète automatiquement ce qui est saisi dans le Suivi RH (agents, pointages, primes). Elle n'est pas modifiable ici.</div>
    </>
  );
}

// ============================================================
// PAGE : CAMPAGNES CLIENTS
// ============================================================
function CampagnesPage({ campagnes, addCampagne, removeCampagne, taux }) {
  const [form, setForm] = useState({ client: "", pays: "", secteur: "", dateDebut: todayISO(), dateFin: "", statut: "En cours", montant: "", devise: "USD", resultatEstime: "" });
  function submit() { if (!form.client) return; addCampagne(form); setForm({ client: "", pays: "", secteur: "", dateDebut: todayISO(), dateFin: "", statut: "En cours", montant: "", devise: "USD", resultatEstime: "" }); }
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Campagnes Clients</h1><div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Suivi commercial par client</div></div>
      <Panel title="Ajouter une campagne">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Client"><input type="text" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Pays"><input type="text" value={form.pays} onChange={e => setForm({ ...form, pays: e.target.value })} style={{ ...inputStyle, width: 110 }} /></Field>
          <Field label="Secteur"><input type="text" value={form.secteur} onChange={e => setForm({ ...form, secteur: e.target.value })} style={{ ...inputStyle, width: 140 }} /></Field>
          <Field label="Début"><input type="date" value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} style={inputStyle} /></Field>
          <Field label="Fin"><input type="date" value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} style={inputStyle} /></Field>
          <Field label="Statut"><select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}><option>En cours</option><option>Terminé</option><option>Suspendu</option></select></Field>
          <Field label="Montant facturé"><input type="number" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} style={{ ...inputStyle, width: 110 }} /></Field>
          <Field label="Devise"><select value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })} style={inputStyle}><option>USD</option><option>EUR</option><option>CDF</option></select></Field>
          <Field label="Résultat estimé USD"><input type="number" value={form.resultatEstime} onChange={e => setForm({ ...form, resultatEstime: e.target.value })} style={{ ...inputStyle, width: 130 }} /></Field>
          <button onClick={submit} style={{ background: GOLD, color: TEXT, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Ajouter</button>
        </div>
      </Panel>
      <Panel title="Toutes les campagnes">
        {campagnes.length === 0 ? <EmptyState text="Aucune campagne enregistrée." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><Th>Client</Th><Th>Pays</Th><Th>Secteur</Th><Th>Période</Th><Th>Statut</Th><Th>Montant</Th><Th>USD</Th><Th>Résultat est.</Th><Th></Th></tr></thead>
              <tbody>{campagnes.map(c => (<tr key={c.id}><Td><b>{c.client}</b></Td><Td>{c.pays}</Td><Td>{c.secteur}</Td><Td>{c.dateDebut && new Date(c.dateDebut).toLocaleDateString("fr-FR")} {c.dateFin && "→ " + new Date(c.dateFin).toLocaleDateString("fr-FR")}</Td><Td><StatutBadge value={c.statut} /></Td><Td>{c.montant} {c.devise}</Td><Td><b style={{ color: "#4CAF7D" }}>{fmt(convertToUSD(c.montant, c.devise, taux))}</b></Td><Td>{fmt(c.resultatEstime)}</Td><Td><button onClick={() => removeCampagne(c.id)} style={delBtnStyle}>Suppr.</button></Td></tr>))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : RÉCAPITULATIF MENSUEL — Vue d'ensemble mois par mois
// (recettes / dépenses / salaires / charges sociales / résultat net)
// ============================================================
function RecapMensuelPage({ recapParMois }) {
  function labelMois(mk) {
    const [y, m] = mk.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  const parMoisDesc = [...recapParMois].sort((a, b) => b.mk.localeCompare(a.mk));

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Récapitulatif mensuel</h1>
        <div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Vue d'ensemble de tous les mois — tout ce qui entre, tout ce qui sort</div>
      </div>
      <Panel title="Tous les mois">
        {parMoisDesc.length === 0 ? <EmptyState text="Aucune donnée enregistrée encore." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><Th>Mois</Th><Th>Recettes</Th><Th>Dépenses</Th><Th>Salaires versés</Th><Th>Charges sociales</Th><Th>Résultat net</Th></tr></thead>
              <tbody>
                {parMoisDesc.map(c => (
                  <tr key={c.mk}>
                    <Td><b style={{ textTransform: "capitalize" }}>{labelMois(c.mk)}</b></Td>
                    <Td style={{ color: "#4CAF7D" }}>{fmt(c.rec)}</Td>
                    <Td style={{ color: "#E0656B" }}>{fmt(c.dep)}</Td>
                    <Td style={{ color: "#D4A72C" }}>{fmt(c.sal)}</Td>
                    <Td style={{ color: "#FD7E14" }}>{fmt(c.charges)}</Td>
                    <Td><b style={{ color: c.resultat >= 0 ? "#4CAF7D" : "#E0656B", fontSize: 13 }}>{fmt(c.resultat)}</b></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div style={{ fontSize: 11, color: "#8CA3C2" }}>ℹ️ Résultat net = Recettes − Dépenses − Salaires versés − Charges sociales, pour le mois concerné.</div>
    </>
  );
}

// ============================================================
// PAGE : TRÉSORERIE — Solde cumulé depuis le début, tous mois confondus
// ============================================================
function TresoreriePage({ recapParMois }) {
  function labelMois(mk) {
    const [y, m] = mk.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  // Ordre chronologique croissant pour calculer le solde cumulé correctement
  const parMoisAsc = [...recapParMois].sort((a, b) => a.mk.localeCompare(b.mk));
  let cumulRunning = 0;
  const avecCumul = parMoisAsc.map(c => {
    cumulRunning += c.resultat;
    return { ...c, cumul: cumulRunning };
  });
  const soldeActuel = avecCumul.length ? avecCumul[avecCumul.length - 1].cumul : 0;
  const totalEntrees = recapParMois.reduce((s, c) => s + c.rec, 0);
  const totalSorties = recapParMois.reduce((s, c) => s + c.dep + c.sal + c.charges, 0);
  const maxAbs = Math.max(1, ...avecCumul.map(c => Math.abs(c.resultat)));

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Trésorerie</h1>
        <div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Solde réel dans la caisse, tous mois confondus (recettes − dépenses − salaires − charges sociales)</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 22 }}>
        <Kpi label="Solde de trésorerie actuel" value={fmt(soldeActuel)} color={soldeActuel >= 0 ? "#4CAF7D" : "#E0656B"} />
        <Kpi label="Total entrées (toutes recettes)" value={fmt(totalEntrees)} color="#4CAF7D" />
        <Kpi label="Total sorties (dépenses + salaires + charges)" value={fmt(totalSorties)} color="#E0656B" />
      </div>

      <Panel title="Évolution mois par mois">
        {avecCumul.length === 0 ? <EmptyState text="Aucune donnée enregistrée encore." /> : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,.1)", paddingBottom: 4 }}>
              {avecCumul.map(c => {
                const h = Math.max(4, Math.round((Math.abs(c.resultat) / maxAbs) * 120));
                return (
                  <div key={c.mk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }} title={`${labelMois(c.mk)} : ${fmt(c.resultat)}`}>
                    <div style={{ width: "70%", height: h, background: c.resultat >= 0 ? "#4CAF7D" : "#E0656B", borderRadius: "3px 3px 0 0" }} />
                  </div>
                );
              })}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr><Th>Mois</Th><Th>Entrées</Th><Th>Sorties</Th><Th>Solde du mois</Th><Th>Solde cumulé</Th></tr></thead>
                <tbody>
                  {[...avecCumul].reverse().map(c => (
                    <tr key={c.mk}>
                      <Td><b style={{ textTransform: "capitalize" }}>{labelMois(c.mk)}</b></Td>
                      <Td style={{ color: "#4CAF7D" }}>{fmt(c.rec)}</Td>
                      <Td style={{ color: "#E0656B" }}>{fmt(c.dep + c.sal + c.charges)}</Td>
                      <Td><b style={{ color: c.resultat >= 0 ? "#4CAF7D" : "#E0656B" }}>{fmt(c.resultat)}</b></Td>
                      <Td><b style={{ color: c.cumul >= 0 ? "#4CAF7D" : "#E0656B", fontSize: 13 }}>{fmt(c.cumul)}</b></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      <div style={{ fontSize: 11, color: "#8CA3C2" }}>ℹ️ Calculé uniquement à partir des recettes/dépenses/salaires saisis dans le logiciel — sans solde de départ.</div>
    </>
  );
}

function ParametresPage({ onChangePassword }) {
  const [oldPw, setOldPw] = useState(""); const [newPw, setNewPw] = useState(""); const [newPw2, setNewPw2] = useState(""); const [msg, setMsg] = useState("");
  async function submit() {
    if (newPw.length < 4) { setMsg("Le nouveau mot de passe doit faire au moins 4 caractères."); return; }
    if (newPw !== newPw2) { setMsg("Les deux nouveaux mots de passe ne correspondent pas."); return; }
    const ok = await onChangePassword(oldPw, newPw);
    if (ok) { setMsg("✓ Mot de passe modifié avec succès."); setOldPw(""); setNewPw(""); setNewPw2(""); }
    else setMsg("L'ancien mot de passe est incorrect.");
  }
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: TEXT }}>Paramètres</h1><div style={{ fontSize: 12.5, color: "#8CA3C2", marginTop: 3 }}>Sécurité du compte</div></div>
      <Panel title="Changer le mot de passe">
        <div style={{ maxWidth: 320 }}>
          <label style={labelStyle}>Mot de passe actuel</label>
          <PasswordInput value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: SURFACE, color: "#E7ECF5" }} />
          <label style={labelStyle}>Nouveau mot de passe</label>
          <PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: SURFACE, color: "#E7ECF5" }} />
          <label style={labelStyle}>Confirme le nouveau mot de passe</label>
          <PasswordInput value={newPw2} onChange={e => setNewPw2(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 14, background: SURFACE, color: "#E7ECF5" }} />
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "#4CAF7D" : "#E0656B", marginBottom: 10 }}>{msg}</div>}
          <button onClick={submit} style={{ background: NAVY, color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Modifier le mot de passe</button>
        </div>
      </Panel>
    </>
  );
}

// ============================================================
// COMPOSANTS UTILITAIRES
// ============================================================
function Panel({ title, children }) {
  return (<div style={{ background: SURFACE, border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.1)" }}><h2 style={{ fontSize: 14.5, margin: 0, fontWeight: 700, color: TEXT }}>{title}</h2></div><div style={{ padding: 18 }}>{children}</div></div>);
}
function Kpi({ label, value, color }) {
  return (<div style={{ background: SURFACE, border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "14px 16px" }}><div style={{ fontSize: 10, color: "#8CA3C2", textTransform: "uppercase", fontWeight: 600 }}>{label}</div><div style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: color || TEXT }}>{value}</div></div>);
}
function Field({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }
function Th({ children }) { return <th style={{ textAlign: "left", padding: "8px 10px", background: "rgba(255,255,255,.04)", color: "#8CA3C2", fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,.1)", whiteSpace: "nowrap" }}>{children}</th>; }
function Td({ children, style }) { return <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,.1)", ...style }}>{children}</td>; }
function StatutBadge({ value }) {
  const map = { "Reçu": ["#4CAF7D", "rgba(76,175,125,.18)"], "En cours": ["#4CAF7D", "rgba(76,175,125,.18)"], "En attente": ["#D4A72C", "rgba(212,167,44,.18)"], "Partiel": ["#D4A72C", "rgba(212,167,44,.18)"], "Annulé": ["#E0656B", "rgba(214,43,31,.18)"], "Suspendu": ["#E0656B", "rgba(214,43,31,.18)"], "Terminé": ["#8CA3C2", "rgba(255,255,255,.08)"] };
  const [color, bg] = map[value] || ["#8CA3C2", "rgba(255,255,255,.08)"];
  return <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, color, background: bg }}>{value}</span>;
}
function EmptyState({ text }) { return <div style={{ textAlign: "center", padding: "30px 10px", color: "#8CA3C2", fontSize: 13 }}>{text}</div>; }

const inputStyle = { border: "1px solid rgba(255,255,255,.15)", borderRadius: 5, padding: "7px 9px", fontSize: 12, background: "rgba(255,255,255,.06)", color: TEXT, fontWeight: 600 };
const loginInputStyle = { width: "100%", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginTop: 4 };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#8CA3C2", marginBottom: 4 };
const delBtnStyle = { background: "rgba(214,43,31,.18)", color: "#E0656B", border: "none", padding: "4px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
const editBtnStyle = { background: "rgba(255,255,255,.08)", color: TEXT, border: "none", padding: "4px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
