<?php
/* gate.php — die Tür einer Produkt-Subdomain (Bene 04.09.2026, „bei all unseren
   Produkten soll die Anmeldung auch greifen").

   VORHER: Jede Subdomain (bene./jan./philipp./marwan./florian./va.) fragte per
   Basic-Auth nach einem gemeinsamen Team-Passwort. Ein Passwort für alle, in einer
   .htpasswd, das niemand wechseln kann, ohne es allen neu zu sagen — und ein
   Anmeldedialog, der nichts davon weiß, wer da eigentlich klopft.

   JETZT: Diese Datei liegt vor allem, was die Subdomain ausliefert (.htaccess leitet
   jede Anfrage hierher). Sie fragt: Ist hier jemand angemeldet, den wir kennen?

     1. Kein Nachweis → weiter zu https://vishnuartists.com/weiter.php?zu=<diese Adresse>.
        Dort liegt die Sitzung von anmelden.php. Wer angemeldet ist, kommt in derselben
        Sekunde mit einem Einmal-Ticket zurück; wer nicht, meldet sich einmal an — und
        landet danach wieder hier. Kein zweites Passwort, kein zweites Konto.
     2. Ticket (?vf_t=…) → wir lösen es von Server zu Server bei weiter.php ein und
        bekommen Person, Name, Mailadresse und Rollen zurück. Das Ticket ist danach
        verbraucht (90 Sekunden gültig, genau ein Einlösen).
     3. Wer darf, bekommt ein eigenes, kurzes Cookie (vf_gate, HMAC-signiert, 4 Stunden)
        — danach läuft jeder Aufruf ohne Netzverkehr durch.
     4. ?wer=1 sagt der Seite hinter der Tür, wer da ist (JSON: person, name, mail) — das
        Cookie ist httponly, der Compass könnte es sonst nicht lesen und würde ein zweites
        Mal nach Name und Passwort fragen. ?raus=1 löscht das Cookie und meldet das Konto ab.
     5. Maschinenschlüssel: Leser ohne Konto (john-server, Datenlauf) schicken den Kopf
        X-Vf-Key mit dem Wert aus $GATE_KEY (gate-config.php) und bekommen die Datei ohne
        Cookie. Leer = aus. Schwester-Subdomains (*.vishnuartists.com) dürfen per CORS mit
        Cookie lesen — so holt der persönliche Compass va-data.json vom Team-Cockpit.

   WER DARF, steht in gate-config.php neben dieser Datei:
       $GATE_MAIL   = array( 'jan@vishnuartists.com', 'jan.edinger@vishnuartists.com' );
                                                       // die Person, der diese Instanz gehört —
                                                       // alle ihre Adressen (String geht auch)
       $GATE_ROLLEN = array( 'gruender' );             // zusätzlich: wer diese Rolle im CRM trägt
       $GATE_TITEL  = 'Jans Portal';
   Verglichen wird gegen ALLE Adressen, die das CRM zu der angemeldeten Person kennt (weiter.php
   liefert `mails`), nicht nur gegen die Hauptadresse. Vorfall 07.09.2026: Jan stand vor seiner
   eigenen Tür — die Konfiguration kannte jan@, sein Postfach und das CRM führen jan.edinger@.
   Fehlt die Datei, kommt niemand durch — eine Tür ohne Schloss ist schlimmer als eine
   verschlossene.

   WAS DIESE DATEI NIEMALS AUSLIEFERT: sich selbst, gate-config.php, gate-secret.php,
   .htaccess/.htpasswd und alles außerhalb ihres eigenen Verzeichnisses. PHP-Dateien
   werden nicht ausgeführt, sondern verweigert — hier liegt nur Statisches.

   WENN DIE PRÜFUNG NICHT ANTWORTET (vishnuartists.com weg, Datenbank weg), sagt diese
   Seite das und lässt niemanden durch. Lieber eine ehrliche Störung als eine Tür, die
   bei Regen aufgeht. */

$WURZEL = __DIR__;
$GEHEIM = '';
$KONFIG = $WURZEL . '/gate-config.php';
$SECRET = $WURZEL . '/gate-secret.php';
$PRUEFE = 'https://vishnuartists.com/weiter.php';
$BRIEFE = $WURZEL . '/briefkasten';   /* liegengebliebene Übergaben aus dem Compass (07.09.2026) */
$STUNDEN = 4;

$GATE_MAIL = ''; $GATE_ROLLEN = array( 'gruender' ); $GATE_TITEL = 'Vishnu Artists'; $GATE_KEY = '';
if ( file_exists( $KONFIG ) ) { include $KONFIG; }
if ( file_exists( $SECRET ) ) { include $SECRET; }   /* setzt $GEHEIM */

function g_h( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES, 'UTF-8' ); }
function g_b64( $s ) { return rtrim( strtr( base64_encode( $s ), '+/', '-_' ), '=' ); }
function g_b64d( $s ) { return base64_decode( strtr( $s, '-_', '+/' ) ); }

function g_seite( $code, $titel, $text, $knopf = '' ) {
	http_response_code( $code );
	header( 'Content-Type: text/html; charset=utf-8' );
	header( 'Cache-Control: no-store' );
	header( 'X-Robots-Tag: noindex, nofollow' );
	echo '<!doctype html><html lang="de"><head><meta charset="utf-8">'
		. '<meta name="viewport" content="width=device-width,initial-scale=1">'
		. '<title>' . g_h( $titel ) . '</title><style>'
		. 'body{margin:0;background:#faf8f2;color:#1c2314;font-family:Inter,-apple-system,"Segoe UI",Roboto,sans-serif;'
		. 'display:flex;align-items:center;justify-content:center;min-height:100vh;line-height:1.6}'
		. '.k{max-width:460px;padding:32px;text-align:center}h1{font-size:26px;margin:0 0 10px}'
		. 'p{color:#686f5d;margin:0 0 16px}a.b{display:inline-block;background:#89c527;color:#11150d;'
		. 'text-decoration:none;font-weight:800;border-radius:999px;padding:10px 20px}'
		. '@media(prefers-color-scheme:dark){body{background:#11150d;color:#eef2e4}p{color:#a4ac95}}'
		. '</style></head><body><div class="k"><h1>' . g_h( $titel ) . '</h1><p>' . $text . '</p>' . $knopf . '</div></body></html>';
	exit;
}

/* ————— Cookie: signiert, kurz, ohne Serverspeicher ————— */
function g_cookie_bauen( $person, $mail, $name = '' ) {
	global $GEHEIM, $STUNDEN;
	$d = g_b64( json_encode( array( 'p' => (int) $person, 'm' => (string) $mail, 'n' => (string) $name, 'exp' => time() + $STUNDEN * 3600 ) ) );
	return $d . '.' . hash_hmac( 'sha256', $d, $GEHEIM );
}
function g_cookie_lesen() {
	global $GEHEIM;
	$c = isset( $_COOKIE['vf_gate'] ) ? (string) $_COOKIE['vf_gate'] : '';
	if ( $c === '' || $GEHEIM === '' || strpos( $c, '.' ) === false ) { return null; }
	list( $d, $sig ) = explode( '.', $c, 2 );
	if ( ! hash_equals( hash_hmac( 'sha256', $d, $GEHEIM ), $sig ) ) { return null; }
	$j = json_decode( g_b64d( $d ), true );
	if ( ! is_array( $j ) || empty( $j['exp'] ) || $j['exp'] < time() ) { return null; }
	return $j;
}

/* ————— Schwester-Subdomains dürfen mit Cookie lesen (persönlicher Compass ↔ Team-Cockpit) ————— */
function g_cors() {
	$o = isset( $_SERVER['HTTP_ORIGIN'] ) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
	if ( $o !== '' && preg_match( '/^https:\/\/[a-z0-9-]+\.vishnuartists\.com$/i', $o ) ) {
		header( 'Access-Control-Allow-Origin: ' . $o );
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Vary: Origin' );
	}
}

/* ————— Maschinenschlüssel: Server-zu-Server-Leser ohne Konto ————— */
function g_schluessel_ok() {
	global $GATE_KEY;
	if ( ! is_string( $GATE_KEY ) || strlen( $GATE_KEY ) < 16 ) { return false; }
	$k = isset( $_SERVER['HTTP_X_VF_KEY'] ) ? (string) $_SERVER['HTTP_X_VF_KEY'] : '';
	return $k !== '' && hash_equals( $GATE_KEY, $k );
}

/* ————— Darf die Person hier herein? —————
   $mails: alle Adressen der angemeldeten Person (weiter.php › mails, Rückfall: die eine Hauptadresse).
   $GATE_MAIL: String oder Liste. Trifft irgendeine Adresse irgendeine andere, ist es ihre Tür. */
function g_darf( $mails, $rollen ) {
	global $GATE_MAIL, $GATE_ROLLEN;
	$eigene = array();
	foreach ( (array) $GATE_MAIL as $m ) { $m = strtolower( trim( (string) $m ) ); if ( $m !== '' ) { $eigene[] = $m; } }
	foreach ( (array) $mails as $m ) {
		$m = strtolower( trim( (string) $m ) );
		if ( $m !== '' && in_array( $m, $eigene, true ) ) { return true; }
	}
	foreach ( (array) $GATE_ROLLEN as $r ) {
		if ( in_array( $r, (array) $rollen, true ) ) { return true; }
	}
	return false;
}

/* ————— Die eigene Adresse, so wie der Browser sie sieht ————— */
function g_meine_url( $ohne_ticket = true ) {
	$host = isset( $_SERVER['HTTP_HOST'] ) ? preg_replace( '/[^A-Za-z0-9\.\-:]/', '', $_SERVER['HTTP_HOST'] ) : '';
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '/';
	if ( $ohne_ticket ) {
		$uri = preg_replace( '/([?&])vf_t=[^&]*(&|$)/', '$1', $uri );
		$uri = rtrim( $uri, '?&' );
	}
	return 'https://' . $host . $uri;
}

/* ————— 1. Ticket einlösen ————— */
if ( isset( $_GET['vf_t'] ) ) {
	if ( $GEHEIM === '' ) { g_seite( 503, 'Tür noch nicht eingerichtet', 'Auf dieser Adresse fehlt das Türgeheimnis (gate-secret.php). Das legt der Veröffentlichungslauf an.' ); }
	$t = preg_replace( '/[^0-9a-f]/', '', (string) $_GET['vf_t'] );
	$antwort = @file_get_contents( $PRUEFE . '?tun=pruefen&t=' . rawurlencode( $t ), false,
		stream_context_create( array( 'http' => array( 'timeout' => 8, 'ignore_errors' => true ) ) ) );
	$d = $antwort ? json_decode( $antwort, true ) : null;
	if ( ! $d ) {
		g_seite( 503, 'Anmeldung nicht erreichbar', 'Wir konnten gerade nicht bei vishnuartists.com nachfragen, wer du bist. Bitte in einer Minute noch einmal versuchen.',
			'<a class="b" href="' . g_h( g_meine_url() ) . '">Noch einmal</a>' );
	}
	if ( empty( $d['ok'] ) ) {
		/* Abgelaufenes oder schon benutztes Ticket: einfach neu holen, nicht meckern. */
		header( 'Location: ' . $PRUEFE . '?zu=' . rawurlencode( g_meine_url() ) );
		exit;
	}
	$mails = ( ! empty( $d['mails'] ) && is_array( $d['mails'] ) ) ? $d['mails'] : array( $d['mail'] ?? '' );
	if ( ! g_darf( $mails, $d['rollen'] ?? array() ) ) {
		g_seite( 403, 'Das ist nicht deine Tür',
			'Angemeldet als <b>' . g_h( $d['voll'] ?? $d['name'] ?? '' ) . '</b> — für <b>' . g_h( $GATE_TITEL ) . '</b> reicht das nicht. '
			. 'Persönliche Instanzen öffnen nur die Person selbst und die Geschäftsführung. Wenn das ein Irrtum ist: kurz melden, wir tragen es ein.',
			'<a class="b" href="https://vishnuartists.com/mein-vishnu.html">Zu Mein Vishnu</a>' );
	}
	$wert = g_cookie_bauen( (int) $d['person'], (string) $d['mail'], (string) ( $d['name'] ?? '' ) );
	setcookie( 'vf_gate', $wert, array( 'expires' => time() + $STUNDEN * 3600, 'path' => '/',
		'secure' => true, 'httponly' => true, 'samesite' => 'Lax' ) );
	header( 'Cache-Control: no-store' );
	header( 'Location: ' . g_meine_url() );
	exit;
}

/* ————— 1b. Wer ist da? — für die Seite hinter der Tür —————
   Das Türcookie ist httponly, der Compass im Browser kann es nicht lesen. Er fragt hier nach und
   bekommt Person, Vorname und Mailadresse, wenn jemand angemeldet ist — sonst ok:false. Damit
   entfällt sein eigener Anmeldedialog (Name + Team-Passwort), sobald die Tür offen ist. */
if ( isset( $_GET['wer'] ) ) {
	g_cors();
	header( 'Content-Type: application/json; charset=utf-8' );
	header( 'Cache-Control: no-store' );
	$ich = g_cookie_lesen();
	if ( ! $ich || ! file_exists( $KONFIG ) ) { echo json_encode( array( 'ok' => false ) ); exit; }
	echo json_encode( array( 'ok' => true, 'person' => (int) $ich['p'], 'mail' => (string) $ich['m'], 'name' => (string) ( $ich['n'] ?? '' ) ), JSON_UNESCAPED_UNICODE );
	exit;
}

/* ————— 1c. Abmelden: Türcookie weg, dann das Konto selbst abmelden ————— */
if ( isset( $_GET['raus'] ) ) {
	setcookie( 'vf_gate', '', array( 'expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax' ) );
	header( 'Cache-Control: no-store' );
	header( 'Location: https://vishnuartists.com/anmelden.php?aus=1' );
	exit;
}

/* ————— 2. Cookie prüfen, sonst weiterreichen ————— */
$ich = g_cookie_lesen();
if ( ! $ich && ! g_schluessel_ok() ) {
	header( 'Cache-Control: no-store' );
	header( 'Location: ' . $PRUEFE . '?zu=' . rawurlencode( g_meine_url() ) );
	exit;
}
if ( ! file_exists( $KONFIG ) ) {
	g_seite( 503, 'Tür noch nicht eingerichtet', 'Auf dieser Adresse fehlt gate-config.php — wer hier hereindarf, ist damit nicht festgelegt. Bis das steht, bleibt die Tür zu.' );
}

/* ————— 2b. Briefkasten: eine Übergabe, die den john-server nicht erreicht hat —————
   Wozu: der Compass schickt jeden Checkin an Benes john-server auf seinem Rechner. Läuft der
   gerade nicht (am 07.09.2026 den ganzen Vormittag), blieb die Übergabe im Browser liegen und
   war für jedes andere Gerät unsichtbar; wer den Checkin auf dem Handy machte, wartete für
   immer, weil dort 'localhost' das Handy selbst ist. Diese Tür steht auf einem Server, der
   immer läuft, und kennt die Person schon — also wirft der Compass die Übergabe hier ein und
   der john-server holt sie ab, sobald er wieder da ist (briefkasten-abholen.ps1, Maschinen-
   schlüssel X-Vf-Key).
   Der Briefkasten ist Durchgang, kein Archiv: abgeholt heißt gelöscht. Ausgeliefert wird er
   nie als Datei (siehe die Sperre in Schritt 3) — nur über diese Handgriffe.

   ————— Madeleine hängt seit dem 08.09.2026 mit dran (Bene: „klemm Madelene auch an den
   Briefkasten an") —————
   Sie denkt auf Benes Rechner, also gilt für sie dasselbe wie für eine Übergabe: läuft der
   gerade nicht, oder sitzt Bene am Handy, kommt der Compass nicht zu ihr durch. Ein Brief mit
   art='madeleine' geht deshalb denselben Weg — nur muss bei ihm etwas zurückkommen. Er wird
   darum nicht beim Abholen gelöscht, sondern bekommt die Antwort hineingeschrieben; weg ist er,
   wenn der Compass sie übernommen hat, spätestens nach $MD_TAGE Tagen.
       GET  ?briefkasten=meine                → die eigenen Madeleine-Briefe samt Antwort
       POST ?briefkasten=antwort&brief=…      → Antwort bzw. gescheiterter Versuch (nur Maschine) */
$MD_TAGE     = 7;   /* so lange darf eine beantwortete Frage auf ihre Abholung warten */
$MD_VERSUCHE = 3;   /* danach gibt der Brief auf, statt für immer „wartet" zu zeigen */
if ( isset( $_GET['briefkasten'] ) ) {
	g_cors();
	header( 'Content-Type: application/json; charset=utf-8' );
	header( 'Cache-Control: no-store' );
	$tun = (string) $_GET['briefkasten'];

	/* Der Name kommt von außen: nur das selbst vergebene Muster zählt, nie ein Pfad. */
	$brief = isset( $_GET['brief'] ) ? strtolower( (string) $_GET['brief'] ) : '';
	if ( $brief !== '' && ! preg_match( '/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z]{1,20}-[0-9a-f]{8}\.json$/', $brief ) ) { $brief = ''; }

	/* Aufräumen bei jedem Zugriff: beantwortete Madeleine-Briefe, die niemand mehr abgeholt hat.
	   Ohne das wäre der einzige Brief, der nicht beim Abholen verschwindet, auch der einzige, der
	   den Kasten volllaufen lassen kann. */
	foreach ( (array) glob( $BRIEFE . '/*-madeleine-*.json' ) as $alt ) {
		if ( is_file( $alt ) && ( time() - (int) filemtime( $alt ) ) > $MD_TAGE * 86400 ) { @unlink( $alt ); }
	}

	if ( $tun === 'liste' ) {
		$aus = array();
		if ( is_dir( $BRIEFE ) ) {
			$namen = scandir( $BRIEFE );
			sort( $namen );
			foreach ( $namen as $n ) {
				if ( ! preg_match( '/^[0-9]{4}-[0-9]{2}-[0-9]{2}-([a-z]{1,20})-[0-9a-f]{8}\.json$/', $n, $m ) ) { continue; }
				$f = $BRIEFE . '/' . $n;
				$e = array( 'brief' => $n, 'art' => $m[1], 'groesse' => (int) filesize( $f ), 'zeit' => gmdate( 'c', filemtime( $f ) ) );
				/* Der Abholer soll einen schon beantworteten Madeleine-Brief nicht noch einmal
				   Madeleine vorlegen — also steht der Stand hier dran. */
				if ( $m[1] === 'madeleine' ) {
					$j = json_decode( (string) @file_get_contents( $f ), true );
					$e['status'] = is_array( $j ) ? (string) ( $j['status'] ?? 'offen' ) : 'kaputt';
				}
				$aus[] = $e;
				if ( count( $aus ) >= 100 ) { break; }
			}
		}
		/* Herzschlag: dass überhaupt jemand nachgesehen hat. Ohne ihn kann der Compass nicht
		   unterscheiden zwischen „Madeleine rechnet noch" und „niemand holt gerade ab". */
		if ( g_schluessel_ok() && is_dir( $BRIEFE ) ) { @file_put_contents( $BRIEFE . '/zuletzt-abgeholt.txt', gmdate( 'c' ) ); }
		echo json_encode( array( 'ok' => true, 'briefe' => $aus ), JSON_UNESCAPED_UNICODE );
		exit;
	}

	/* Die eigenen Madeleine-Briefe — das ist die Seite, die der Compass liest. */
	if ( $tun === 'meine' ) {
		$aus = array();
		foreach ( (array) glob( $BRIEFE . '/*-madeleine-*.json' ) as $f ) {
			$j = json_decode( (string) @file_get_contents( $f ), true );
			if ( ! is_array( $j ) ) { continue; }
			/* Auf einer persönlichen Instanz ist das immer dieselbe Person; auf einer geteilten
			   nicht — deshalb wird gefiltert und nicht darauf vertraut. */
			if ( $ich && isset( $j['person'] ) && (int) $j['person'] !== (int) $ich['p'] ) { continue; }
			$aus[] = array(
				'brief' => basename( $f ), 'frage' => (string) ( $j['frage'] ?? '' ),
				'status' => (string) ( $j['status'] ?? 'offen' ), 'antwort' => (string) ( $j['antwort'] ?? '' ),
				'modell' => (string) ( $j['modell'] ?? '' ), 'gestellt' => (string) ( $j['gestellt'] ?? '' ),
				'beantwortet' => (string) ( $j['beantwortet'] ?? '' ), 'letzterFehler' => (string) ( $j['letzterFehler'] ?? '' ),
			);
		}
		usort( $aus, fn( $a, $b ) => strcmp( $a['gestellt'], $b['gestellt'] ) );
		$puls = @file_get_contents( $BRIEFE . '/zuletzt-abgeholt.txt' );
		echo json_encode( array( 'ok' => true, 'fragen' => $aus, 'abgeholt' => (string) $puls, 'jetzt' => gmdate( 'c' ) ), JSON_UNESCAPED_UNICODE );
		exit;
	}

	/* Antwort eintragen — nur die Maschine. Eine Antwort, die die Seite selbst schreiben könnte,
	   wäre keine Antwort von Madeleine, sondern eine Behauptung. */
	if ( $tun === 'antwort' ) {
		if ( ! g_schluessel_ok() ) { http_response_code( 403 ); echo json_encode( array( 'ok' => false, 'error' => 'NUR_MASCHINE' ) ); exit; }
		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || strtoupper( $_SERVER['REQUEST_METHOD'] ) !== 'POST' ) {
			http_response_code( 405 ); echo json_encode( array( 'ok' => false, 'error' => 'NUR_POST' ) ); exit;
		}
		$f = $BRIEFE . '/' . $brief;
		if ( $brief === '' || ! is_file( $f ) ) { http_response_code( 404 ); echo json_encode( array( 'ok' => false, 'error' => 'KEIN_BRIEF' ) ); exit; }
		$j = json_decode( (string) @file_get_contents( $f ), true );
		if ( ! is_array( $j ) || ( $j['art'] ?? '' ) !== 'madeleine' ) { http_response_code( 400 ); echo json_encode( array( 'ok' => false, 'error' => 'FALSCHE_ART' ) ); exit; }
		$in = json_decode( (string) file_get_contents( 'php://input' ), true );
		$antwort = is_array( $in ) ? trim( (string) ( $in['antwort'] ?? '' ) ) : '';
		$fehler  = is_array( $in ) ? trim( (string) ( $in['fehler'] ?? '' ) ) : '';
		if ( $antwort === '' && $fehler === '' ) { http_response_code( 400 ); echo json_encode( array( 'ok' => false, 'error' => 'LEER' ) ); exit; }
		if ( ( $j['status'] ?? '' ) !== 'fertig' ) {   /* zweimal geliefert ist kein Fehler */
			if ( $antwort !== '' ) {
				$j['antwort']     = mb_substr( $antwort, 0, 12000 );
				$j['modell']      = mb_substr( (string) ( $in['modell'] ?? '' ), 0, 60 );
				$j['status']      = 'fertig';
				$j['beantwortet'] = gmdate( 'c' );
				unset( $j['letzterFehler'] );
			} else {
				$j['versuche']      = (int) ( $j['versuche'] ?? 0 ) + 1;
				$j['letzterFehler'] = mb_substr( $fehler, 0, 300 );
				if ( $j['versuche'] >= $MD_VERSUCHE ) { $j['status'] = 'fehler'; }
			}
			if ( file_put_contents( $f, json_encode( $j, JSON_UNESCAPED_UNICODE ), LOCK_EX ) === false ) {
				http_response_code( 500 ); echo json_encode( array( 'ok' => false, 'error' => 'NICHT_GESCHRIEBEN' ) ); exit;
			}
		}
		echo json_encode( array( 'ok' => true, 'status' => (string) $j['status'] ) );
		exit;
	}

	if ( $tun === 'hol' ) {
		if ( $brief === '' || ! is_file( $BRIEFE . '/' . $brief ) ) { http_response_code( 404 ); echo json_encode( array( 'ok' => false, 'error' => 'KEIN_BRIEF' ) ); exit; }
		$roh = file_get_contents( $BRIEFE . '/' . $brief );
		$d = json_decode( (string) $roh, true );
		if ( ! is_array( $d ) ) { http_response_code( 500 ); echo json_encode( array( 'ok' => false, 'error' => 'KAPUTT' ) ); exit; }
		echo json_encode( array( 'ok' => true, 'brief' => $brief, 'nutzlast' => $d ), JSON_UNESCAPED_UNICODE );
		exit;
	}

	if ( $tun === 'weg' ) {
		if ( $brief === '' ) { http_response_code( 400 ); echo json_encode( array( 'ok' => false, 'error' => 'KEIN_BRIEF' ) ); exit; }
		$f = $BRIEFE . '/' . $brief;
		if ( is_file( $f ) ) { @unlink( $f ); }
		echo json_encode( array( 'ok' => true, 'brief' => $brief ) );
		exit;
	}

	/* Einwerfen. Nur POST — ein GET, das schreibt, wäre über einen Link auslösbar. */
	if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || strtoupper( $_SERVER['REQUEST_METHOD'] ) !== 'POST' ) {
		http_response_code( 405 ); echo json_encode( array( 'ok' => false, 'error' => 'NUR_POST' ) ); exit;
	}
	/* Ohne Maschinenschlüssel holt niemand den Brief je ab — dann nimmt der Kasten auch nichts an.
	   Sonst sammelte eine Instanz ohne john-server Briefe, die bis zum Anschlag liegen bleiben. */
	if ( ! is_string( $GATE_KEY ) || strlen( $GATE_KEY ) < 16 ) {
		http_response_code( 503 ); echo json_encode( array( 'ok' => false, 'error' => 'KEIN_ABHOLER' ) ); exit;
	}
	$roh = file_get_contents( 'php://input' );
	if ( strlen( (string) $roh ) > 262144 ) { http_response_code( 413 ); echo json_encode( array( 'ok' => false, 'error' => 'ZU_GROSS' ) ); exit; }
	$d = json_decode( (string) $roh, true );
	$art = is_array( $d ) && isset( $d['art'] ) ? strtolower( (string) $d['art'] ) : '';
	$datum = is_array( $d ) && isset( $d['datum'] ) ? (string) $d['datum'] : '';
	if ( ! preg_match( '/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $datum ) ) {
		http_response_code( 400 ); echo json_encode( array( 'ok' => false, 'error' => 'UNBRAUCHBAR' ) ); exit;
	}
	/* Die Art wird nur zum Dateinamen — deshalb eine Liste und kein Durchreichen. Was nicht darauf
	   steht, wird trotzdem angenommen und heißt 'checkin' (09.09.2026): bis heute wies der Kasten
	   eine Freigaben-Übergabe mit 400 zurück, weil ihre Art hier fehlte — der Abschluss sagte dann
	   „Noch nicht übergeben“ statt „Im Briefkasten“, und die fertige Übergabe lag nur im Browser.
	   Eine neue Ritual-Art darf nie wieder dazu führen, dass eine Übergabe nirgends liegt. Nur
	   'madeleine' zählt wörtlich: an ihr hängt der andere Weg (Antwort hinein statt Löschen). */
	if ( ! in_array( $art, array( 'morgen', 'abend', 'wochenstart', 'wochenreview', 'fragen', 'freigaben', 'trichter', 'checkin', 'madeleine' ), true ) ) { $art = 'checkin'; }
	/* Ein Brief ohne Inhalt wäre nur Müll, den der Abholer bis zum Ablauf immer wieder
	   dem john-server anbietet (der lehnt leeren Text mit 'LEER' ab). Madeleine trägt ihre
	   Frage statt eines Textes — sie wird gleich darunter geprüft. */
	if ( $art !== 'madeleine' && trim( (string) ( $d['text'] ?? '' ) ) === '' ) {
		http_response_code( 400 ); echo json_encode( array( 'ok' => false, 'error' => 'LEER' ) ); exit;
	}
	if ( $art === 'madeleine' ) {
		$frage = trim( (string) ( $d['frage'] ?? '' ) );
		if ( $frage === '' ) { http_response_code( 400 ); echo json_encode( array( 'ok' => false, 'error' => 'LEER' ) ); exit; }
		/* Höchstens drei offene Fragen: Madeleine rechnet Minuten je Antwort, und ein Kasten voller
		   Fragen, die alle gleichzeitig warten, hilft niemandem. */
		$warten = 0;
		foreach ( (array) glob( $BRIEFE . '/*-madeleine-*.json' ) as $x ) {
			$y = json_decode( (string) @file_get_contents( $x ), true );
			if ( is_array( $y ) && ( $y['status'] ?? '' ) === 'offen' ) { $warten++; }
		}
		if ( $warten >= 3 ) { http_response_code( 429 ); echo json_encode( array( 'ok' => false, 'error' => 'ZU_VIELE' ) ); exit; }
		$d = array(
			'art' => 'madeleine', 'datum' => $datum,
			'frage'   => mb_substr( $frage, 0, 3000 ),
			'kontext' => mb_substr( (string) ( $d['kontext'] ?? '' ), 0, 8000 ),
			'status'  => 'offen', 'antwort' => '', 'gestellt' => gmdate( 'c' ),
			/* Wer fragt, sagt die Tür — nicht der Browser. */
			'person'  => $ich ? (int) $ich['p'] : 0,
			'wer'     => $ich ? (string) ( $ich['n'] ?? '' ) : '',
		);
	}
	if ( ! is_dir( $BRIEFE ) ) { @mkdir( $BRIEFE, 0700, true ); }
	if ( ! is_dir( $BRIEFE ) || ! is_writable( $BRIEFE ) ) { http_response_code( 500 ); echo json_encode( array( 'ok' => false, 'error' => 'KEIN_ORDNER' ) ); exit; }
	/* Ein Briefkasten, der volllaufen kann, ist ein Loch im Webspace. */
	$da = glob( $BRIEFE . '/*.json' );
	if ( is_array( $da ) && count( $da ) >= 200 ) { http_response_code( 507 ); echo json_encode( array( 'ok' => false, 'error' => 'VOLL' ) ); exit; }
	/* Dieselbe art+datum ersetzt sich selbst — sonst sammelt ein hartnäckiger Wächter Dubletten.
	   Für Madeleine gilt das ausdrücklich NICHT: an einem Tag darf man mehr als eine Frage stellen,
	   und die zweite darf die erste nicht verschlucken. */
	if ( $art !== 'madeleine' ) {
		foreach ( (array) $da as $alt ) {
			if ( strpos( basename( $alt ), $datum . '-' . $art . '-' ) === 0 ) { @unlink( $alt ); }
		}
	}
	$name = $datum . '-' . $art . '-' . bin2hex( random_bytes( 4 ) ) . '.json';
	if ( file_put_contents( $BRIEFE . '/' . $name, json_encode( $d, JSON_UNESCAPED_UNICODE ), LOCK_EX ) === false ) {
		http_response_code( 500 ); echo json_encode( array( 'ok' => false, 'error' => 'NICHT_GESCHRIEBEN' ) ); exit;
	}
	echo json_encode( array( 'ok' => true, 'brief' => $name ) );
	exit;
}

/* ————— 3. Datei ausliefern ————— */
$pfad = parse_url( isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH );
$pfad = rawurldecode( (string) $pfad );
if ( strpos( $pfad, "\0" ) !== false ) { g_seite( 400, 'Ungültige Adresse', 'Diese Adresse ergibt keinen Sinn.' ); }
$datei = $WURZEL . '/' . ltrim( $pfad, '/' );
if ( is_dir( $datei ) ) { $datei = rtrim( $datei, '/' ) . '/index.html'; }

$echt = realpath( $datei );
$wurzel_echt = realpath( $WURZEL );
if ( $echt === false || $wurzel_echt === false || strpos( $echt, $wurzel_echt ) !== 0 ) {
	g_seite( 404, 'Nicht gefunden', 'Diese Seite gibt es hier nicht. <a href="/">Zum Portal</a>' );
}
$name = strtolower( basename( $echt ) );
$endung = strtolower( pathinfo( $echt, PATHINFO_EXTENSION ) );
/* Nie ausliefern: die Tür selbst, ihre Konfiguration, ihr Geheimnis, Serverdateien. */
if ( $endung === 'php' || $name === '.htaccess' || strpos( $name, '.htpasswd' ) === 0 || strpos( $name, '.publish-state' ) === 0 ) {
	g_seite( 403, 'Nicht abrufbar', 'Diese Datei gehört zur Tür, nicht zum Haus.' );
}
/* Der Briefkasten ist kein Ordner zum Blättern — an seinen Inhalt kommt man nur über Schritt 2b. */
$briefe_echt = realpath( $BRIEFE );
if ( $briefe_echt !== false && strpos( $echt, $briefe_echt ) === 0 ) {
	g_seite( 403, 'Nicht abrufbar', 'Der Briefkasten wird nicht ausgeliefert.' );
}

$typen = array(
	'html' => 'text/html; charset=utf-8', 'htm' => 'text/html; charset=utf-8',
	'js' => 'text/javascript; charset=utf-8', 'mjs' => 'text/javascript; charset=utf-8',
	'css' => 'text/css; charset=utf-8', 'json' => 'application/json; charset=utf-8',
	'webmanifest' => 'application/manifest+json; charset=utf-8', 'map' => 'application/json; charset=utf-8',
	'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
	'gif' => 'image/gif', 'webp' => 'image/webp', 'ico' => 'image/x-icon', 'avif' => 'image/avif',
	'woff2' => 'font/woff2', 'woff' => 'font/woff', 'ttf' => 'font/ttf',
	'txt' => 'text/plain; charset=utf-8', 'md' => 'text/plain; charset=utf-8',
	'pdf' => 'application/pdf', 'csv' => 'text/csv; charset=utf-8',
	'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mp3' => 'audio/mpeg', 'wav' => 'audio/wav',
	'xml' => 'application/xml; charset=utf-8', 'vtt' => 'text/vtt; charset=utf-8',
);
if ( ! isset( $typen[ $endung ] ) ) { g_seite( 403, 'Nicht abrufbar', 'Diesen Dateityp liefern wir hier nicht aus.' ); }

$zeit = filemtime( $echt );
$etag = '"' . dechex( $zeit ) . '-' . dechex( filesize( $echt ) ) . '"';
g_cors();
header( 'Content-Type: ' . $typen[ $endung ] );
header( 'X-Content-Type-Options: nosniff' );
header( 'X-Frame-Options: SAMEORIGIN' );
header( 'Referrer-Policy: strict-origin-when-cross-origin' );
header( 'ETag: ' . $etag );
header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', $zeit ) . ' GMT' );
/* Persönliche Inhalte: nie in einem gemeinsamen Zwischenspeicher, und Seiten und Code
   immer frisch prüfen (dieselbe Regel wie in der alten .htaccess). */
if ( in_array( $endung, array( 'html', 'htm', 'js', 'mjs', 'json', 'webmanifest' ), true ) ) {
	header( 'Cache-Control: private, no-cache' );
} else {
	header( 'Cache-Control: private, max-age=86400' );
}
$imf = isset( $_SERVER['HTTP_IF_NONE_MATCH'] ) ? trim( $_SERVER['HTTP_IF_NONE_MATCH'] ) : '';
if ( $imf !== '' && $imf === $etag ) { http_response_code( 304 ); exit; }
header( 'Content-Length: ' . filesize( $echt ) );
readfile( $echt );
