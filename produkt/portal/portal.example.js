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
  version: 2,

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
       backstage  https://vishnuartists.com/backstage.html
       vaikuntha  aus — nur für Menschen im Verein (dann die Adresse eintragen)
       raumschiff aus — zeigt private Konten, nur für die Crew (dann die Adresse eintragen)
     false = Kachel ausblenden · true = Standardadresse · 'https://…' = eigene Adresse. */
  kacheln: {
    /* Vereinsmenschen: 'https://vaikuntha.eu/' — oder, damit die Anmeldung mitkommt,
       der Umweg über das Sprungbrett (SSO, 04.09.2026):
       'https://vishnuartists.com/weiter.php?zu=https%3A%2F%2Fvaikuntha.eu%2Fwp-json%2Fvishnu%2Fv1%2Fanmelden%3Fzu%3D%252Fmein-bereich%252F' */
    vaikuntha: false
  },

  /* Die Bereiche (07.09.2026): ganze Rückseiten mit ihren Unterseiten, jeweils eine
     Sektion mit drei Spalten unter den Kacheln. Alle standardmäßig AUS — sie zeigen
     Verwaltung, Finanzen und Backends, die nicht jede Person etwas angehen.
       crm         CRM: Akten, Vertrieb & Termine, Pflege
       fap         Freelancer-Pool: Bewerbungen FAP & JAP, Unterlagen, Pool-KPIs
       raumschiff  Finanz-Raumschiff: alle Entitäten (Privat, GmbH, Luxemburg, Verein),
                   Steuerung, Finanzlauf der GmbH
       vishnu      Vishnu-Backend: Pflege & Zahlen, Website, Werkzeuge (Jira, GitHub, KAS …)
       vaikuntha   Vaikuntha-Backend: WordPress-Cockpit über das Sprungbrett (SSO)
     true = an, false = aus, 'https://…' = eigene Hauptadresse für den Knopf „Öffnen“.
     Ein Bereich, der an ist, ersetzt die gleichnamigen Zeilen der zweiten Ebene. */
  bereiche: {
    /* crm: true, fap: true, raumschiff: true, vishnu: true, vaikuntha: true */
  },

  /* Einzelne Zeilen eines Bereichs: '<bereich>.<zeile>': false = ausblenden,
     'https://…' = eigene Adresse. Die Kennungen stehen in portal.html › BEREICHE,
     zum Beispiel 'vishnu.stripe', 'fap.stajira', 'raumschiff.lux'. */
  links: {},

  /* Die zweite Ebene unter den Bereichen: kleine Zeilen in vier Spalten.
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
