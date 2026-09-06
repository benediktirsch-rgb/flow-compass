/* ============================================================================
   portal.js — die eine Datei, in der steht, wem dieses Portal gehört und welche
   Kacheln es zeigt. Sie wird beim Einrichten je Person aus dieser Vorlage kopiert
   (build-portal.ps1 legt sie an, wenn keine da ist) und danach nie überschrieben —
   ein Rebau zieht nur den Portalcode nach, deine Einträge bleiben stehen.

   Name und Mailadresse müssen hier NICHT stehen: fehlen sie, nimmt das Portal
   beides aus compass/instanz.js. Eine Pflegestelle, nicht zwei.

   Keine Geheimnisse hier hinein — die Datei liegt im Browser jeder Person, die
   sich auf der Subdomain anmeldet.
   ============================================================================ */
window.PORTAL = {
  version: 1,

  /* Anrede und Fußzeile. Leer lassen = aus compass/instanz.js übernehmen. */
  name:   '',
  person: '',
  mail:   '',

  /* '' = Sprache des Browsers, 'de' oder 'en' = fest. Der Knopf oben rechts
     überschreibt das je Gerät (localStorage › portalSprache). */
  sprache: '',

  /* Eigener Satz unter der Begrüßung; leer = Standardsatz der Sprache. */
  lead: '',

  /* true = alles eine Schriftstufe größer (für Menschen, die das brauchen). */
  gross: false,

  /* Welche Kachel zuerst steht und hervorgehoben ist: '' = der Compass,
     sonst eine Kachel-Kennung (compass · cockpit · backstage · vaikuntha · raumschiff). */
  haupt: '',

  /* Die Kacheln. Was hier nicht steht, steht auf Standard:
       compass    ./compass/                                (immer hier auf der Subdomain)
       cockpit    https://va.vishnuartists.com/
       backstage  https://vishnuartists.com/backstage.php
       vaikuntha  aus — nur für Menschen im Verein (dann die Adresse eintragen)
     false = Kachel ausblenden · true = Standardadresse · 'https://…' = eigene Adresse. */
  kacheln: {
    /* Vereinsmenschen: 'https://vaikuntha.eu/' — oder, damit die Anmeldung mitkommt,
       der Umweg über das Sprungbrett (SSO, 04.09.2026):
       'https://vishnuartists.com/weiter.php?zu=https%3A%2F%2Fvaikuntha.eu%2Fwp-json%2Fvishnu%2Fv1%2Fanmelden%3Fzu%3D%2Fmein-bereich%2F' */
    vaikuntha: false
  },

  /* Die zweite Ebene unter den Kacheln: kleine Zeilen in vier Spalten.
     Standardmäßig sichtbar (für alle):
       ich       profil · kennzahlen · freelancerportal
       menschen  team
       lernen    academy · buchung · jira
     Standardmäßig AUS — nur wer sie braucht, schaltet sie hier an:
       firma     finanzen · strategie · abos
       menschen  bewerbungen (FAP & JAP) · crm · portalpflege
     true = Standardadresse, false = ausblenden, 'https://…' = eigene Adresse.
     Wer sein Profil lieber im CRM pflegt, trägt die eigene Personenseite ein
     (die Nummer steht in der Adresse, wenn man sie im CRM öffnet):
       profil: 'https://vishnuartists.com/crm.php?v=person&id=<nr>' */
  mehr: {
    /* finanzen: true, strategie: true, bewerbungen: true, crm: true */
  },

  /* Alter Name derselben Sache (bis 04.09.2026). Was hier steht, wirkt weiter. */
  neben: {}
};
