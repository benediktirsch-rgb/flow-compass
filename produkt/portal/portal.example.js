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

  /* Die Kacheln. Was hier nicht steht, steht auf Standard:
       compass    ./compass/                                (immer hier auf der Subdomain)
       cockpit    https://va.vishnuartists.com/
       backstage  https://vishnuartists.com/backstage.php
       vaikuntha  aus — nur für Menschen im Verein (dann die Adresse eintragen)
     false = Kachel ausblenden · true = Standardadresse · 'https://…' = eigene Adresse. */
  kacheln: {
    vaikuntha: false          /* Vereinsmenschen: 'https://vaikuntha.eu/' */
  },

  /* Die kleinen Verweise unter den Kacheln. Gleiche Regel: false = weg,
     Text = eigene Adresse. Wer seinen Eintrag lieber im CRM pflegt, trägt hier die
     eigene Personenseite ein (die Nummer steht in der Adresse, wenn man sie im CRM
     öffnet): 'https://vishnuartists.com/crm.php?v=person&id=<nr>'. */
  neben: {
    /* profil: 'https://vishnuartists.com/profil.php', */
    /* kennzahlen: false */
  }
};
