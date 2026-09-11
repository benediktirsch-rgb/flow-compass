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
  version: 3,

  /* Berechtigungsebene (v3, 11.09.2026). Das Portal zeigt jeder Person die Bereiche, die
     ihre Rechte öffnen — wie auf bene.vishnuartists.com, nur auf ihrer Ebene.
       rollen  CRM-Rollen wie in f/rollen.php › vf_roster(). Nur Rückfall: angemeldet
               liefert die Tür (gate.php?wer=1) die echten Rollen und die gewinnen.
               gruender · intern · finanzen · vertrag · freelancer · trainer · coach …
       crew    Rolle im Finanz-Raumschiff (raumschiff/zugang.php): 'kapitaen' | 'firma' |
               'vertraege' | '' — keine CRM-Rolle, deshalb nur hier.
       verein  Stufe bei Vaikuntha: 'admin' (wp-admin) | 'vorstand' | 'beirat' | 'mitglied' | ''
               — das Vishnu-CRM kennt sie nicht (Zwei Häuser, 02.09.2026). */
  rollen: [],
  crew:   '',
  verein: '',

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
       vaikuntha  an, sobald `verein` gesetzt ist (Mein Bereich über das Sprungbrett)
       raumschiff an, sobald `crew` gesetzt ist
     false = Kachel ausblenden · true = Standardadresse · 'https://…' = eigene Adresse. */
  kacheln: {},

  /* Die Bereiche: ganze Rückseiten mit ihren Unterseiten, je eine Sektion mit Spalten.
     Seit v3 erscheinen sie von selbst, sobald die Rechte mindestens eine Zeile öffnen:
       ich         Mein Vishnu: Profil, Rang, Backstage, Freelancer-Portal, Lernen, Zugang
       flow        Flow Compass (?go=…), Team-Cockpit (?go=…), alle Portale des Kollektivs
       crm         CRM (gruender · intern · finanzen)
       fap         Freelancer-Pool FAP & JAP (gruender · intern)
       raumschiff  Finanz-Raumschiff je Crew-Rolle, Finanzlauf (gruender · finanzen)
       vishnu      Vishnu-Backend: Pflege & Zahlen, Website, Werkzeuge
       vaikuntha   Verein je Stufe: Mitgliederbereich, bei 'admin' das WordPress-Cockpit
     false = trotzdem ausblenden, 'https://…' = eigene Hauptadresse für den Knopf „Öffnen“.
     Ein Bereich, der zu sehen ist, ersetzt die gleichnamigen Zeilen der zweiten Ebene. */
  bereiche: {},

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
     Seit v3 übernimmt „Mein Vishnu“ die meisten dieser Zeilen; hier bleibt, was
     keinem Bereich gehört. Wer sein Profil lieber im CRM pflegt, trägt die eigene
     Personenseite ein (die Nummer steht in der Adresse, wenn man sie im CRM öffnet):
       profil: 'https://vishnuartists.com/crm.php?v=person&id=<nr>' */
  mehr: {
    /* finanzen: true, strategie: true, bewerbungen: true, crm: true */
  },

  /* Alter Name derselben Sache (bis 04.09.2026). Was hier steht, wirkt weiter. */
  neben: {}
};
