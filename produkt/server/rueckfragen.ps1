# Private imported questions plus live reception questions; never invent answers.
function Get-CloudRueckfragen {
  $file = Join-Path $DatenDir 'vertretung/rueckfragen-import.json'
  $local = $null
  if (Test-Path -LiteralPath $file) { $local = [IO.File]::ReadAllText($file) | ConvertFrom-Json }
  $answers = Read-Antworten
  $known = @{}
  foreach ($d in @($local.entschieden)) {
    if ($d -and $d.Count -ge 3) { $known[[string]$d[1]] = @{a=[string]$d[2];ts=[string]$d[0];quelle='importierte Entscheidung'} }
  }
  foreach ($id in $answers.Keys) { $known[$id] = $answers[$id] }
  $questions = @{}
  foreach ($q in @($local.rueckfragen)) {
    if ($q -and $q.id) { $questions[[string]$q.id] = $q }
  }
  $hubOk = $false
  try {
    $hub = Invoke-MadeleneHub 'rueckfragen' $null '&status=alle'
    if (-not $hub.ok) { throw 'HUB_REJECTED' }
    foreach ($q in @($hub.rueckfragen)) {
      if (-not $q.id) { continue }
      if ($q.status -eq 'offen') { $questions[[string]$q.id] = $q }
      elseif ($q.status -eq 'beantwortet') { $known[[string]$q.id] = $q.antwort }
      elseif ($q.status -eq 'zurueckgezogen') { $questions.Remove([string]$q.id) }
    }
    $hubOk = $true
  } catch { }
  $open = @($questions.Values | Where-Object {
    -not $known.ContainsKey([string]$_.id) -and
    (-not $_.wann -or $_.wann -eq 'immer' -or [string]$_.wann -le (Get-Date -Format 'yyyy-MM-dd'))
  } | Sort-Object @{Expression={[bool]$_.dringend};Descending=$true},wann,id)
  return @{ok=$true;vollstaendig=$hubOk -and ($null -ne $local);rueckfragen=$open;antworten=$known
    importStand=$local.quellstand;rezeptionErreichbar=$hubOk;lokalerBestandImportiert=($null -ne $local)
    hinweis='Lokaler Bestand ist ein Import; neue Rezeptionsfragen und Cloud-Antworten werden live abgeglichen.'}
}
function Invoke-RueckfragenRoute($ctx,$req,[string]$path) {
  if ($path -in @('/api/postfach','/api/slack')) {
    if ($req.HttpMethod -ne 'GET') { Send-Json $ctx @{ok=$false;error='NUR_LESEN'} 405; return $true }
    $source = $path.Substring(5)
    $file = Join-Path $DatenDir "vertretung/$source-connector.json"
    if (-not (Test-Path -LiteralPath $file)) { Send-Json $ctx @{ok=$false;error='NO_DATA';hint='Erster Cloud-Connector-Lauf noch nicht erfolgreich.'}; return $true }
    try {
      $data = [IO.File]::ReadAllText($file) | ConvertFrom-Json -AsHashtable
      $stamp = $data.stand
      $last = if ($stamp -is [datetime] -or $stamp -is [DateTimeOffset]) { [DateTimeOffset]$stamp } else { [DateTimeOffset]::Parse([string]$stamp,[Globalization.CultureInfo]::InvariantCulture) }
      $data.alterMin = [int]([DateTimeOffset]::Now - $last).TotalMinutes
      $data.frisch = $data.alterMin -lt 120
      $data.vollstaendig = $data.frisch
      $runFile = Join-Path $DatenDir "vertretung/$source-lauf.json"
      if (Test-Path -LiteralPath $runFile) {
        $run = [IO.File]::ReadAllText($runFile) | ConvertFrom-Json
        if ($run.status -eq 'fehlgeschlagen') {
          $data.vollstaendig = $false
          $data.hinweis = 'Letzter Quellenversuch fehlgeschlagen; angezeigt wird der vorherige erfolgreiche Stand.'
        }
      }
      if (-not $data.frisch) { $data.hinweis = 'Letzter erfolgreicher Quellenlauf ist veraltet.' }
      foreach ($row in @($data.wartend) + @($data.kenntnisse)) {
        if (-not $row) { continue }
        $row.tage = [int][Math]::Floor(([DateTimeOffset]::Now - $(if ($row.seit -is [datetime] -or $row.seit -is [DateTimeOffset]) { [DateTimeOffset]$row.seit } else { [DateTimeOffset]::Parse([string]$row.seit,[Globalization.CultureInfo]::InvariantCulture) })).TotalDays)
        if ($source -eq 'postfach') { $row.id = $row.threadId; $row.url = "https://mail.google.com/mail/u/0/#all/$($row.threadId)" }
        else { $row.id = "$($row.kanalId)/$($row.ts)"; $row.url = "https://app.slack.com/archives/$($row.kanalId)/p$(([string]$row.ts).Replace('.',''))" }
      }
      $waiting = @($data.wartend | Where-Object { $_.art -eq 'antwort' })
      $data.zusammenfassung.aeltesteTage = if ($waiting.Count) { ($waiting.tage | Measure-Object -Maximum).Maximum } else { $null }
      Send-Json $ctx $data
    } catch { Send-Json $ctx @{ok=$false;error='SOURCE_SNAPSHOT_UNLESBAR'} 503 }
    return $true
  }
  if ($path -ne '/api/rueckfragen') { return $false }
  if ($req.HttpMethod -ne 'GET') { Send-Json $ctx @{ok=$false;error='NUR_LESEN'} 405; return $true }
  try { Send-Json $ctx (Get-CloudRueckfragen) }
  catch { Send-Json $ctx @{ok=$false;error='RUECKFRAGEN_UNLESBAR'} 503 }
  return $true
}
