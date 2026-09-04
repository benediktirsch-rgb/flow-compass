<?php
/* gate-config.php — wer diese Subdomain öffnen darf (04.09.2026).
   Wird je Instanz aus dieser Vorlage angelegt und danach NIE überschrieben
   (wie instanz.js und portal.js). Ohne diese Datei bleibt die Tür zu.

   $GATE_MAIL    Die Person, der diese Instanz gehört — ihre Mailadresse im CRM.
                 Leer lassen für gemeinsame Werkzeuge (dann zählen nur die Rollen).
   $GATE_ROLLEN  Wer sonst noch hereindarf, über die Rolle im CRM. Rollen aus
                 db.php › $VF_ROLLEN, z. B. gruender, intern, kollektiv, freelancer,
                 partner, finanzen. Persönliche Instanzen: nur 'gruender'
                 (Entscheidung Bene 04.09.2026 — persönliche Boards, Checkins und
                 Kennzahlen gehen nicht das ganze Kollektiv an).
   $GATE_TITEL   Was auf der Seite steht, wenn jemand vor der falschen Tür steht.
   $GATE_KEY     Maschinenschlüssel (mind. 16 Zeichen) für Leser ohne Konto: john-server
                 und Datenlauf schicken ihn im Kopf X-Vf-Key (User-Umgebungsvariable
                 VA_GATE_KEY). Leer = kein Maschinenzugang. Nie ins Repo — diese Datei
                 ist gitignored. */

$GATE_MAIL   = '';
$GATE_ROLLEN = array( 'gruender' );
$GATE_TITEL  = 'Vishnu Artists';
$GATE_KEY    = '';
