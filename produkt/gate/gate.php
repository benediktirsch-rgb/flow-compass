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

   WER DARF, steht in gate-config.php neben dieser Datei:
       $GATE_MAIL   = 'jan@vishnuartists.com';         // die Person, der diese Instanz gehört
       $GATE_ROLLEN = array( 'gruender' );             // zusätzlich: wer diese Rolle im CRM trägt
       $GATE_TITEL  = 'Jans Portal';
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
$STUNDEN = 4;

$GATE_MAIL = ''; $GATE_ROLLEN = array( 'gruender' ); $GATE_TITEL = 'Vishnu Artists';
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
function g_cookie_bauen( $person, $mail ) {
	global $GEHEIM, $STUNDEN;
	$d = g_b64( json_encode( array( 'p' => (int) $person, 'm' => (string) $mail, 'exp' => time() + $STUNDEN * 3600 ) ) );
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

/* ————— Darf die Person hier herein? ————— */
function g_darf( $mail, $rollen ) {
	global $GATE_MAIL, $GATE_ROLLEN;
	$mail = strtolower( trim( (string) $mail ) );
	if ( $GATE_MAIL !== '' && $mail === strtolower( trim( $GATE_MAIL ) ) ) { return true; }
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
	if ( ! g_darf( $d['mail'] ?? '', $d['rollen'] ?? array() ) ) {
		g_seite( 403, 'Das ist nicht deine Tür',
			'Angemeldet als <b>' . g_h( $d['voll'] ?? $d['name'] ?? '' ) . '</b> — für <b>' . g_h( $GATE_TITEL ) . '</b> reicht das nicht. '
			. 'Persönliche Instanzen öffnen nur die Person selbst und die Geschäftsführung. Wenn das ein Irrtum ist: kurz melden, wir tragen es ein.',
			'<a class="b" href="https://vishnuartists.com/mein-vishnu.html">Zu Mein Vishnu</a>' );
	}
	$wert = g_cookie_bauen( (int) $d['person'], (string) $d['mail'] );
	setcookie( 'vf_gate', $wert, array( 'expires' => time() + $STUNDEN * 3600, 'path' => '/',
		'secure' => true, 'httponly' => true, 'samesite' => 'Lax' ) );
	header( 'Cache-Control: no-store' );
	header( 'Location: ' . g_meine_url() );
	exit;
}

/* ————— 2. Cookie prüfen, sonst weiterreichen ————— */
$ich = g_cookie_lesen();
if ( ! $ich ) {
	header( 'Cache-Control: no-store' );
	header( 'Location: ' . $PRUEFE . '?zu=' . rawurlencode( g_meine_url() ) );
	exit;
}
if ( ! file_exists( $KONFIG ) ) {
	g_seite( 503, 'Tür noch nicht eingerichtet', 'Auf dieser Adresse fehlt gate-config.php — wer hier hereindarf, ist damit nicht festgelegt. Bis das steht, bleibt die Tür zu.' );
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
