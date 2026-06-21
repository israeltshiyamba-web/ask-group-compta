import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// ASK GROUP SARL — LOGICIEL DE COMPTABILITÉ (version Supabase)
// Connecté à une base de données partagée
// ============================================================

const SUPABASE_URL = "https://sfuuzluaysxrdcqtvuto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdXV6bHVheXN4cmRjcXR2dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTU2OTEsImV4cCI6MjA5NzU5MTY5MX0.2N6_dYs56LLV6hLLkxippeyxrMNSp9VlBUt_GUdEdcM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NAVY = "#0A1B3D";
const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2E2A8";
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

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
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
  const [salaires, setSalaires] = useState([]);
  const [campagnes, setCampagnes] = useState([]);
  const [taux, setTaux] = useState({ eurUsd: 1.08, usdCdf: 2800 });

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
      const [r, d, s, c, t] = await Promise.all([
        supabase.from("recettes").select("*"),
        supabase.from("depenses").select("*"),
        supabase.from("salaires_verses").select("*"),
        supabase.from("campagnes").select("*"),
        supabase.from("taux_change").select("*").eq("id", "main").maybeSingle(),
      ]);
      if (r.data) setRecettes(r.data);
      if (d.data) setDepenses(d.data);
      if (s.data) setSalaires(s.data.map(x => ({ ...x, cnssSal: x.cnss_sal, cnssPat: x.cnss_pat })));
      if (c.data) setCampagnes(c.data.map(x => ({ ...x, dateDebut: x.date_debut, dateFin: x.date_fin, resultatEstime: x.resultat_estime })));
      if (t.data) setTaux({ eurUsd: t.data.eur_usd, usdCdf: t.data.usd_cdf });
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

  // ─── Salaires ────────────────────────────────────────────────
  const TAUX_CHARGES = { cnssSal: 0.05, ipr: 0.15, cnssPat: 0.13, inpp: 0.03, onem: 0.02 };
  function calcSalaire(brut) {
    const cnssSal = brut * TAUX_CHARGES.cnssSal;
    const ipr = Math.max(0, (brut - cnssSal) * TAUX_CHARGES.ipr);
    const net = brut - cnssSal - ipr;
    const cnssPat = brut * TAUX_CHARGES.cnssPat;
    const inpp = brut * TAUX_CHARGES.inpp;
    const onem = brut * TAUX_CHARGES.onem;
    return { cnssSal, ipr, net, cnssPat, inpp, onem, coutTotal: brut + cnssPat + inpp + onem };
  }
  async function addSalaire(form) {
    const brut = parseFloat(form.brut);
    const c = calcSalaire(brut);
    const newRow = { id: uid(), date: form.date, nom: form.nom, poste: form.poste, brut, ...c };
    setSalaires(prev => [...prev, newRow]);
    await supabase.from("salaires_verses").insert({
      id: newRow.id, date: newRow.date, nom: newRow.nom, poste: newRow.poste, brut: newRow.brut,
      cnss_sal: newRow.cnssSal, ipr: newRow.ipr, net: newRow.net, cnss_pat: newRow.cnssPat, inpp: newRow.inpp, onem: newRow.onem, cout_total: newRow.coutTotal,
    });
  }
  async function removeSalaire(id) {
    setSalaires(prev => prev.filter(s => s.id !== id));
    await supabase.from("salaires_verses").delete().eq("id", id);
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
  const totalSalairesMois = salaires.filter(s => monthKey(s.date) === currentMonth).reduce((s, x) => s + (x.net || 0), 0);
  const resultatNet = totalRecettesMois - totalDepensesMois;

  if (connError) return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#B4322B" }}>⚠️ {connError}</div>;
  if (setupMode) return <SetupPasswordScreen newPw={newPw} setNewPw={setNewPw} newPw2={newPw2} setNewPw2={setNewPw2} onSubmit={handleSetupPassword} error={pwError} />;
  if (!unlocked) return <LoginScreen pwInput={pwInput} setPwInput={setPwInput} onSubmit={handleUnlock} error={pwError} />;
  if (!loaded) return <div style={{ padding: 40, fontFamily: "sans-serif", color: NAVY }}>Chargement des données...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", background: "#F6F5F1", color: "#1C1C1A" }}>
      <Sidebar page={page} setPage={setPage} onLock={() => setUnlocked(false)} />
      <div style={{ flex: 1, padding: "28px 36px", maxWidth: 1300, overflowX: "auto" }}>
        {page === "dashboard" && <DashboardPage totalRecettesMois={totalRecettesMois} totalDepensesMois={totalDepensesMois} resultatNet={resultatNet} totalSalairesMois={totalSalairesMois} taux={taux} setTaux={updateTaux} recettesUSD={recettesUSD} />}
        {page === "recettes" && <RecettesPage recettes={recettes} addRecette={addRecette} removeRecette={removeRecette} taux={taux} />}
        {page === "depenses" && <DepensesPage depenses={depenses} addDepense={addDepense} removeDepense={removeDepense} taux={taux} />}
        {page === "salaires" && <SalairesPage salaires={salaires} addSalaire={addSalaire} removeSalaire={removeSalaire} calcSalaire={calcSalaire} />}
        {page === "campagnes" && <CampagnesPage campagnes={campagnes} addCampagne={addCampagne} removeCampagne={removeCampagne} taux={taux} />}
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 36, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700, textAlign: "center" }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 20, textAlign: "center", color: NAVY, margin: "8px 0 4px" }}>Comptabilité — Première utilisation</h1>
        <p style={{ fontSize: 12.5, color: "#6B6B63", textAlign: "center", marginBottom: 24 }}>Crée ton mot de passe. Tu seras le seul à le connaître.</p>
        <label style={labelStyle}>Nouveau mot de passe</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={loginInputStyle} placeholder="Au moins 4 caractères" />
        <label style={{ ...labelStyle, marginTop: 12 }}>Confirme le mot de passe</label>
        <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={loginInputStyle} placeholder="Retape le mot de passe" />
        {error && <div style={{ color: "#B4322B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={onSubmit} style={{ width: "100%", background: GOLD, color: NAVY, border: "none", padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer" }}>Créer mon mot de passe</button>
      </div>
    </div>
  );
}

function LoginScreen({ pwInput, setPwInput, onSubmit, error }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 36, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700, textAlign: "center" }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 20, textAlign: "center", color: NAVY, margin: "8px 0 20px" }}>🔒 Accès Comptabilité</h1>
        <label style={labelStyle}>Mot de passe</label>
        <input type="password" value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && onSubmit()} style={loginInputStyle} placeholder="Saisis ton mot de passe" autoFocus />
        {error && <div style={{ color: "#B4322B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={onSubmit} style={{ width: "100%", background: GOLD, color: NAVY, border: "none", padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer" }}>Déverrouiller</button>
        <div style={{ textAlign: "center", fontSize: 11, color: "#999", marginTop: 16 }}>Accès strictement réservé à la Direction</div>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ page, setPage, onLock }) {
  const items = [["dashboard", "Tableau de bord"], ["recettes", "Recettes"], ["depenses", "Dépenses"], ["salaires", "Salaires & Charges"], ["campagnes", "Campagnes Clients"], ["parametres", "Paramètres"]];
  return (
    <div style={{ width: 230, background: NAVY, color: "white", padding: "24px 0", flexShrink: 0 }}>
      <div style={{ padding: "0 24px 24px", borderBottom: "1px solid rgba(255,255,255,.1)", marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>ASK GROUP</div>
        <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>Comptabilité</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>🟢 Données partagées en ligne</div>
      </div>
      {items.map(([key, label]) => (
        <div key={key} onClick={() => setPage(key)} style={{ padding: "13px 24px", fontSize: 13, cursor: "pointer", borderLeft: page === key ? `3px solid ${GOLD}` : "3px solid transparent", background: page === key ? "rgba(212,175,55,.12)" : "transparent", color: page === key ? GOLD_LIGHT : "rgba(255,255,255,.65)", fontWeight: page === key ? 600 : 400 }}>{label}</div>
      ))}
      <div style={{ margin: "24px 24px 0" }}>
        <button onClick={onLock} style={{ width: "100%", background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.8)", border: "none", padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔒 Verrouiller la session</button>
      </div>
    </div>
  );
}

// ============================================================
// PAGE : TABLEAU DE BORD
// ============================================================
function DashboardPage({ totalRecettesMois, totalDepensesMois, resultatNet, totalSalairesMois, taux, setTaux, recettesUSD }) {
  const recentRecettes = [...recettesUSD].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Tableau de bord financier</h1>
        <div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>ASK GROUP SARL · Devise de référence : USD</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
        <Kpi label="Recettes du mois" value={fmt(totalRecettesMois)} color="#1E7A4C" />
        <Kpi label="Dépenses du mois" value={fmt(totalDepensesMois)} color="#B4322B" />
        <Kpi label="Résultat net" value={fmt(resultatNet)} color={resultatNet >= 0 ? "#1E7A4C" : "#B4322B"} />
        <Kpi label="Salaires versés ce mois" value={fmt(totalSalairesMois)} color="#8a6500" />
      </div>
      <Panel title="Taux de change actifs — Mets à jour chaque lundi">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div><label style={labelStyle}>1 EUR =</label><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="number" step="0.01" value={taux.eurUsd} onChange={e => setTaux({ ...taux, eurUsd: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 90 }} /><span style={{ fontSize: 12, color: "#6B6B63" }}>USD</span></div></div>
          <div><label style={labelStyle}>1 USD =</label><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="number" value={taux.usdCdf} onChange={e => setTaux({ ...taux, usdCdf: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: 90 }} /><span style={{ fontSize: 12, color: "#6B6B63" }}>CDF</span></div></div>
        </div>
      </Panel>
      <Panel title="Dernières recettes enregistrées">
        {recentRecettes.length === 0 ? <EmptyState text="Aucune recette enregistrée encore." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Date</Th><Th>Client</Th><Th>Description</Th><Th>Devise</Th><Th>Montant USD</Th></tr></thead>
            <tbody>{recentRecettes.map(r => (<tr key={r.id}><Td>{new Date(r.date).toLocaleDateString("fr-FR")}</Td><Td><b>{r.client}</b></Td><Td>{r.description}</Td><Td>{r.devise}</Td><Td><b style={{ color: "#1E7A4C" }}>{fmt(r.montantUSD)}</b></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : RECETTES
// ============================================================
function RecettesPage({ recettes, addRecette, removeRecette, taux }) {
  const [form, setForm] = useState({ date: todayISO(), client: "", description: "", devise: "USD", montant: "", statut: "Reçu" });
  function submit() { if (!form.client || !form.montant) return; addRecette(form); setForm({ date: todayISO(), client: "", description: "", devise: "USD", montant: "", statut: "Reçu" }); }
  const total = recettes.reduce((s, r) => s + convertToUSD(r.montant, r.devise, taux), 0);
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Recettes</h1><div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Enregistre chaque paiement reçu</div></div>
      <Panel title="Ajouter une recette">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
          <Field label="Client"><input type="text" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Nom du client" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détail" style={{ ...inputStyle, width: 180 }} /></Field>
          <Field label="Devise"><select value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })} style={inputStyle}><option>USD</option><option>EUR</option><option>CDF</option></select></Field>
          <Field label="Montant"><input type="number" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder="0.00" style={{ ...inputStyle, width: 100 }} /></Field>
          <Field label="Statut"><select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}><option>Reçu</option><option>En attente</option><option>Partiel</option><option>Annulé</option></select></Field>
          <button onClick={submit} style={{ background: GOLD, color: NAVY, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Ajouter</button>
        </div>
      </Panel>
      <Panel title={`Toutes les recettes — Total : ${fmt(total)}`}>
        {recettes.length === 0 ? <EmptyState text="Aucune recette enregistrée." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Date</Th><Th>Client</Th><Th>Description</Th><Th>Devise</Th><Th>Montant</Th><Th>USD</Th><Th>Statut</Th><Th></Th></tr></thead>
            <tbody>{[...recettes].sort((a, b) => b.date.localeCompare(a.date)).map(r => (<tr key={r.id}><Td>{new Date(r.date).toLocaleDateString("fr-FR")}</Td><Td><b>{r.client}</b></Td><Td>{r.description}</Td><Td>{r.devise}</Td><Td>{r.montant}</Td><Td><b style={{ color: "#1E7A4C" }}>{fmt(convertToUSD(r.montant, r.devise, taux))}</b></Td><Td><StatutBadge value={r.statut} /></Td><Td><button onClick={() => removeRecette(r.id)} style={delBtnStyle}>Suppr.</button></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : DÉPENSES
// ============================================================
function DepensesPage({ depenses, addDepense, removeDepense, taux }) {
  const categories = ["Loyer & charges locaux", "Internet & téléphonie", "Logiciels CRM & VoIP", "Matériel informatique", "Électricité & eau", "Transport", "Fournitures de bureau", "Formation", "Frais bancaires", "Taxes & impôts", "Autres"];
  const [form, setForm] = useState({ date: todayISO(), fournisseur: "", categorie: categories[0], description: "", devise: "USD", montant: "" });
  function submit() { if (!form.fournisseur || !form.montant) return; addDepense(form); setForm({ date: todayISO(), fournisseur: "", categorie: categories[0], description: "", devise: "USD", montant: "" }); }
  const total = depenses.reduce((s, d) => s + convertToUSD(d.montant, d.devise, taux), 0);
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Dépenses</h1><div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Enregistre chaque dépense de la société</div></div>
      <Panel title="Ajouter une dépense">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
          <Field label="Fournisseur"><input type="text" value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} placeholder="Nom" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Catégorie"><select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} style={{ ...inputStyle, width: 180 }}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détail" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Devise"><select value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })} style={inputStyle}><option>USD</option><option>EUR</option><option>CDF</option></select></Field>
          <Field label="Montant"><input type="number" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder="0.00" style={{ ...inputStyle, width: 100 }} /></Field>
          <button onClick={submit} style={{ background: GOLD, color: NAVY, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Ajouter</button>
        </div>
      </Panel>
      <Panel title={`Toutes les dépenses — Total : ${fmt(total)}`}>
        {depenses.length === 0 ? <EmptyState text="Aucune dépense enregistrée." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Date</Th><Th>Fournisseur</Th><Th>Catégorie</Th><Th>Description</Th><Th>Montant</Th><Th>USD</Th><Th></Th></tr></thead>
            <tbody>{[...depenses].sort((a, b) => b.date.localeCompare(a.date)).map(d => (<tr key={d.id}><Td>{new Date(d.date).toLocaleDateString("fr-FR")}</Td><Td><b>{d.fournisseur}</b></Td><Td>{d.categorie}</Td><Td>{d.description}</Td><Td>{d.montant} {d.devise}</Td><Td><b style={{ color: "#B4322B" }}>{fmt(convertToUSD(d.montant, d.devise, taux))}</b></Td><Td><button onClick={() => removeDepense(d.id)} style={delBtnStyle}>Suppr.</button></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : SALAIRES & CHARGES
// ============================================================
function SalairesPage({ salaires, addSalaire, removeSalaire, calcSalaire }) {
  const [form, setForm] = useState({ date: todayISO(), nom: "", poste: "", brut: "" });
  function submit() { if (!form.nom || !form.brut) return; addSalaire(form); setForm({ date: todayISO(), nom: "", poste: "", brut: "" }); }
  const totalCout = salaires.reduce((s, x) => s + x.coutTotal, 0);
  const preview = form.brut ? calcSalaire(parseFloat(form.brut) || 0) : null;
  return (
    <>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Salaires & Charges</h1><div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Saisis le brut — charges sociales RDC calculées automatiquement</div></div>
      <Panel title="Ajouter un versement de salaire">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: preview ? 14 : 0 }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
          <Field label="Nom"><input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Nom employé" style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Poste"><input type="text" value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} placeholder="Ex: Agent..." style={{ ...inputStyle, width: 160 }} /></Field>
          <Field label="Salaire BRUT (USD)"><input type="number" value={form.brut} onChange={e => setForm({ ...form, brut: e.target.value })} placeholder="0.00" style={{ ...inputStyle, width: 120 }} /></Field>
          <button onClick={submit} style={{ background: GOLD, color: NAVY, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Ajouter</button>
        </div>
        {preview && (
          <div style={{ background: "#F6F5F1", borderRadius: 8, padding: 12, fontSize: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>CNSS sal. (5%) : <b style={{ color: "#B4322B" }}>{fmt(preview.cnssSal)}</b></span>
            <span>IPR (15%) : <b style={{ color: "#B4322B" }}>{fmt(preview.ipr)}</b></span>
            <span>NET versé : <b style={{ color: "#1E7A4C" }}>{fmt(preview.net)}</b></span>
            <span>Charges patronales : <b style={{ color: "#8a6500" }}>{fmt(preview.cnssPat + preview.inpp + preview.onem)}</b></span>
            <span>Coût total employeur : <b style={{ color: NAVY }}>{fmt(preview.coutTotal)}</b></span>
          </div>
        )}
      </Panel>
      <Panel title={`Historique des salaires — Coût total cumulé : ${fmt(totalCout)}`}>
        {salaires.length === 0 ? <EmptyState text="Aucun salaire enregistré." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><Th>Date</Th><Th>Nom</Th><Th>Poste</Th><Th>Brut</Th><Th>CNSS sal.</Th><Th>IPR</Th><Th>NET versé</Th><Th>Charges pat.</Th><Th>Coût total</Th><Th></Th></tr></thead>
              <tbody>{[...salaires].sort((a, b) => b.date.localeCompare(a.date)).map(s => (<tr key={s.id}><Td>{new Date(s.date).toLocaleDateString("fr-FR")}</Td><Td><b>{s.nom}</b></Td><Td>{s.poste}</Td><Td>{fmt(s.brut)}</Td><Td style={{ color: "#B4322B" }}>{fmt(s.cnssSal)}</Td><Td style={{ color: "#B4322B" }}>{fmt(s.ipr)}</Td><Td><b style={{ color: "#1E7A4C" }}>{fmt(s.net)}</b></Td><Td style={{ color: "#8a6500" }}>{fmt(s.cnssPat + s.inpp + s.onem)}</Td><Td><b>{fmt(s.coutTotal)}</b></Td><Td><button onClick={() => removeSalaire(s.id)} style={delBtnStyle}>Suppr.</button></Td></tr>))}</tbody>
            </table>
          </div>
        )}
      </Panel>
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
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Campagnes Clients</h1><div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Suivi commercial par client</div></div>
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
          <button onClick={submit} style={{ background: GOLD, color: NAVY, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Ajouter</button>
        </div>
      </Panel>
      <Panel title="Toutes les campagnes">
        {campagnes.length === 0 ? <EmptyState text="Aucune campagne enregistrée." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><Th>Client</Th><Th>Pays</Th><Th>Secteur</Th><Th>Période</Th><Th>Statut</Th><Th>Montant</Th><Th>USD</Th><Th>Résultat est.</Th><Th></Th></tr></thead>
              <tbody>{campagnes.map(c => (<tr key={c.id}><Td><b>{c.client}</b></Td><Td>{c.pays}</Td><Td>{c.secteur}</Td><Td>{c.dateDebut && new Date(c.dateDebut).toLocaleDateString("fr-FR")} {c.dateFin && "→ " + new Date(c.dateFin).toLocaleDateString("fr-FR")}</Td><Td><StatutBadge value={c.statut} /></Td><Td>{c.montant} {c.devise}</Td><Td><b style={{ color: "#1E7A4C" }}>{fmt(convertToUSD(c.montant, c.devise, taux))}</b></Td><Td>{fmt(c.resultatEstime)}</Td><Td><button onClick={() => removeCampagne(c.id)} style={delBtnStyle}>Suppr.</button></Td></tr>))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// PAGE : PARAMÈTRES
// ============================================================
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
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Paramètres</h1><div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Sécurité du compte</div></div>
      <Panel title="Changer le mot de passe">
        <div style={{ maxWidth: 320 }}>
          <label style={labelStyle}>Mot de passe actuel</label>
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: "white", color: "#1C1C1A" }} />
          <label style={labelStyle}>Nouveau mot de passe</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: "white", color: "#1C1C1A" }} />
          <label style={labelStyle}>Confirme le nouveau mot de passe</label>
          <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 14, background: "white", color: "#1C1C1A" }} />
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "#1E7A4C" : "#B4322B", marginBottom: 10 }}>{msg}</div>}
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
  return (<div style={{ background: "white", border: "1px solid #E4E1D8", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid #E4E1D8" }}><h2 style={{ fontSize: 14.5, margin: 0, fontWeight: 700, color: NAVY }}>{title}</h2></div><div style={{ padding: 18 }}>{children}</div></div>);
}
function Kpi({ label, value, color }) {
  return (<div style={{ background: "white", border: "1px solid #E4E1D8", borderRadius: 12, padding: "14px 16px" }}><div style={{ fontSize: 10, color: "#6B6B63", textTransform: "uppercase", fontWeight: 600 }}>{label}</div><div style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: color || NAVY }}>{value}</div></div>);
}
function Field({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }
function Th({ children }) { return <th style={{ textAlign: "left", padding: "8px 10px", background: "#FAFAF7", color: "#6B6B63", fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #E4E1D8", whiteSpace: "nowrap" }}>{children}</th>; }
function Td({ children, style }) { return <td style={{ padding: "8px 10px", borderBottom: "1px solid #E4E1D8", ...style }}>{children}</td>; }
function StatutBadge({ value }) {
  const map = { "Reçu": ["#1E7A4C", "#E6F4EC"], "En cours": ["#1E7A4C", "#E6F4EC"], "En attente": ["#8a6500", "#FFF3CD"], "Partiel": ["#8a6500", "#FFF3CD"], "Annulé": ["#B4322B", "#FBE9E7"], "Suspendu": ["#B4322B", "#FBE9E7"], "Terminé": ["#6B6B63", "#F0F0EE"] };
  const [color, bg] = map[value] || ["#6B6B63", "#F0F0EE"];
  return <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, color, background: bg }}>{value}</span>;
}
function EmptyState({ text }) { return <div style={{ textAlign: "center", padding: "30px 10px", color: "#999", fontSize: 13 }}>{text}</div>; }

const inputStyle = { border: "1px solid #E4E1D8", borderRadius: 5, padding: "7px 9px", fontSize: 12, background: "#EAF1FF", color: "#1A4FB4", fontWeight: 600 };
const loginInputStyle = { width: "100%", border: "1px solid #E4E1D8", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginTop: 4 };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#6B6B63", marginBottom: 4 };
const delBtnStyle = { background: "#FBE9E7", color: "#B4322B", border: "none", padding: "4px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
