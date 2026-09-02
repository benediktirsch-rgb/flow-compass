/* ============================================================================
   compass-i18n.js — Der Flow Compass in drei Sprachen: Deutsch · English · العربية
   (die Nutzerin 28.08.2026)

   WARUM SO UND NICHT MIT data-i18n:
   dashboard.html ist eine einzige Seite mit ~4.900 Zeilen, in der fast jeder
   sichtbare Text zur Laufzeit aus JavaScript entsteht (render(), pkBoardHtml(),
   schrittMalen(), kinoMalen() …). Hunderte data-i18n-Attribute zu verteilen
   hieße, jede dieser Render-Funktionen anzufassen — und bei der nächsten
   Änderung wieder. Deshalb derselbe Weg wie auf der Team-Website
   (f/i18n-text.js): ein **Overlay**, das die fertig gerenderten Textknoten
   übersetzt. Schlüssel ist der deutsche Quelltext, Wert ist [Englisch, Arabisch].
   Ein MutationObserver hängt sich an den Seiteninhalt — was der Compass neu
   zeichnet, ist im selben Frame übersetzt. Render-Funktionen bleiben unberührt.

   WAS ÜBERSETZT WIRD: die Bedienoberfläche — Kopf, Rituale, Sektionen, Karten-
   überschriften, Mein Board, Kompass, Kennzahlen-Blüten, Dialoge, Coach, Menüs,
   Level und Abzeichen, Tastenhilfe.

   WAS BEWUSST DEUTSCH BLEIBT: **deine Inhalte.** Jira-Titel, Trello-Karten,
   Rückfragen, „Diese Woche“, Projektzeilen, Checkin-Antworten, Coach- Antworten
   und der Übergabetext an Claude. Das ist keine Lücke, sondern Absicht: ein
   Wörterbuch darf Inhalte nicht raten, und der Text, der an Claude, an den
   john-server und in checkins\ geht, muss in einer Sprache stabil bleiben.
   Fehlt ein Schlüssel, steht Deutsch da — nie ein leeres Feld.

   ARABISCH: setzt dir <html dir="rtl">; das Spiegel-Stylesheet dazu steht in
   dashboard.html („Arabisch / RTL“). Zahlen bleiben westlich (ar-u-nu-latn),
   damit Kennzahlen, Ticketnummern und Uhrzeit überall gleich aussehen.

   PFLEGE: Konsole öffnen und `compassSprache.luecken()` aufrufen — die Liste
   zeigt jeden deutschen Text, der gerade auf dem Bildschirm steht und keinen
   Eintrag hat. `compassSprache.luecken(true)` gibt sie als fertige
   Wörterbuchzeilen aus, die man hier unten einfügen kann.

   UMSCHALTEN: Design-Menü (Taste D) → „Sprache“, `?lang=en|ar|de`, oder
   `compassSprache.setzen('ar')`. Merkt sich die Wahl in localStorage
   (`compassLang`, liegt in EXPORT_KEYS und zieht damit mit dem Fortschritt um).
   ============================================================================ */
(function () {
  'use strict';

  const SPRACHEN = {
    de: { kurz: 'DE', eigen: 'Deutsch',  wie: 'Deutsch',  dir: 'ltr', loc: 'de-DE' },
    en: { kurz: 'EN', eigen: 'English',  wie: 'Englisch', dir: 'ltr', loc: 'en-GB' },
    ar: { kurz: 'AR', eigen: 'العربية',  wie: 'Arabisch', dir: 'rtl', loc: 'ar-u-nu-latn' }
  };

  /* ==========================================================================
     WÖRTERBUCH — "deutscher Quelltext": ['English', 'العربية']

     Zahlen sind Platzhalter: steht im Schlüssel {1}, {2} …, passt der Eintrag
     auf jede Zahl an dieser Stelle ("6 offen" → "{1} offen").
     Führende Emoji und abschließende Pfeile darf man weglassen — der Layer
     trennt sie ab, übersetzt den Kern und hängt sie wieder an (im Arabischen
     gespiegelt: → wird ←).
     ========================================================================== */
  const W = {

    /* ---- Kopf, Rahmen, Zugang ------------------------------------------- */
    'Team Flow Compass · die Nutzerin': ['Team Flow Compass · die Nutzerin', 'بوصلة الفريق للتدفّق · المستخدِم'],
    'Know what matters next': ['Know what matters next', 'اعرف ما يهمّ تاليًا'],
    'Team Flow Compass · Know what matters next': ['Team Flow Compass · Know what matters next', 'بوصلة الفريق للتدفّق · اعرف ما يهمّ تاليًا'],
    'Ein Login für Compass und Team-Cockpit: dein Name (wie in Jira) und das Team-Passwort. Gilt 30 Tage auf diesem Gerät.':
      ['One login for Compass and the Team-Cockpit: your name (as in Jira) and the team password. Valid for 30 days on this device.',
       'تسجيل دخول واحد للبوصلة ولقُمرة الفريق: اسمك (كما في Jira) وكلمة مرور الفريق. صالح 30 يومًا على هذا الجهاز.'],
    'Dein Name — Vorname reicht': ['Your name — first name is enough', 'اسمك — الاسم الأول يكفي'],
    'Team-Passwort': ['Team password', 'كلمة مرور الفريق'],
    'Anmelden': ['Sign in', 'تسجيل الدخول'],
    'Zugang': ['Access', 'الدخول'],
    'Name': ['Name', 'الاسم'],
    'Guten Morgen,': ['Good morning,', 'صباح الخير،'],
    'Guten Tag,': ['Hello,', 'مرحبًا،'],
    'Guten Abend,': ['Good evening,', 'مساء الخير،'],
    'Gute Nacht,': ['Good night,', 'تصبح على خير،'],
    'Kompass — Orientierung, Ordnung, Takt': ['Compass — orientation, order, rhythm', 'البوصلة — التوجّه والنظام والإيقاع'],
    'Orientierung · Ordnung · Takt': ['Orientation · order · rhythm', 'توجّه · نظام · إيقاع'],
    '20 Leitsätze im Umlauf — wechselt täglich, Klick blättert weiter':
      ['20 guiding sentences in rotation — changes daily, click to move on', '20 مبدأً في التداول — تتغيّر يوميًا، انقر للتالي'],
    'Tage': ['days', 'أيام'],
    'Tage in Folge': ['days in a row', 'أيام متتالية'],
    'XP gesamt': ['XP total', 'مجموع نقاط الخبرة'],
    'XP': ['XP', 'نقاط الخبرة'],
    '{1} XP': ['{1} XP', '{1} نقطة خبرة'],
    '{1} XP · {2} bis {3}': ['{1} XP · {2} to {3}', '{1} نقطة · {2} حتى {3}'],
    'XP · Endstufe': ['XP · top level', 'نقاط الخبرة · أعلى مرتبة'],
    'Team Flow Compass · lokal, nicht veröffentlicht · gebaut mit Claude':
      ['Team Flow Compass · local, not published · built with Claude', 'بوصلة الفريق للتدفّق · محلّية، غير منشورة · بُنيت مع كلود'],
    'Datenstand: –': ['Data as of: –', 'حالة البيانات: –'],
    'Datenstand:': ['Data as of:', 'حالة البيانات:'],
    'Neu laden': ['Reload', 'إعادة التحميل'],
    'Fokus-Modus': ['Focus mode', 'وضع التركيز'],
    'Layout': ['Layout', 'التخطيط'],
    'Layout bearbeiten: Karten verschieben, Breite aendern, oben andocken (Taste E)':
      ['Edit layout: move cards, change width, pin to top (key E)', 'تحرير التخطيط: نقل البطاقات وتغيير العرض والتثبيت أعلى (المفتاح E)'],

    /* ---- Tagesphase & Design-Menü --------------------------------------- */
    'Sonnenaufgang': ['Sunrise', 'الشروق'],
    'Morgen': ['Morning', 'الصباح'],
    'Tag': ['Day', 'النهار'],
    'Abend': ['Evening', 'المساء'],
    'Nacht': ['Night', 'الليل'],
    'fix': ['fixed', 'ثابت'],
    'hell': ['light', 'فاتح'],
    'dunkel': ['dark', 'داكن'],
    'Tagesphase — der Compass färbt sich mit dem Tag': ['Time of day — the Compass takes on the colour of the day', 'مرحلة اليوم — تتلوّن البوصلة مع النهار'],
    'Design wählen — Farbschema und Tagesphase (Taste D)': ['Choose the look — colour scheme and time of day (key D)', 'اختر المظهر — نظام الألوان ومرحلة اليوم (المفتاح D)'],
    'Farbschema: Automatisch (folgt dem Tag) → Hell → Dunkel': ['Colour scheme: automatic (follows the day) → light → dark', 'نظام الألوان: تلقائي (يتبع النهار) → فاتح → داكن'],
    'Farbschema': ['Colour scheme', 'نظام الألوان'],
    'Sprache': ['Language', 'اللغة'],
    'Automatisch': ['Automatic', 'تلقائي'],
    'hell am Tag, dunkel ab dem Abend': ['light by day, dark from evening on', 'فاتح نهارًا، داكن من المساء'],
    'Hell': ['Light', 'فاتح'],
    'immer helles Design': ['always the light design', 'التصميم الفاتح دائمًا'],
    'Dunkel': ['Dark', 'داكن'],
    'immer dunkles Design': ['always the dark design', 'التصميم الداكن دائمًا'],
    'Tagesphase': ['Time of day', 'مرحلة اليوم'],
    'färbt Hintergrund und Lotusblüten': ['colours the background and the lotus flowers', 'يلوّن الخلفية وزهور اللوتس'],
    'folgt der Uhr': ['follows the clock', 'يتبع الساعة'],
    'jetzt Sonnenaufgang': ['now sunrise', 'الآن الشروق'],
    'jetzt Morgen': ['now morning', 'الآن الصباح'],
    'jetzt Tag': ['now day', 'الآن النهار'],
    'jetzt Abend': ['now evening', 'الآن المساء'],
    'jetzt Nacht': ['now night', 'الآن الليل'],
    '5–8 Uhr · Blüten öffnen sich': ['5–8 h · the flowers open', '5–8 · تتفتّح الأزهار'],
    '8–12 Uhr · voller Tau': ['8–12 h · full of dew', '8–12 · مليئة بالندى'],
    '12–17 Uhr · Blüten weit offen': ['12–17 h · flowers wide open', '12–17 · الأزهار متفتّحة تمامًا'],
    '17–21 Uhr · Blüten neigen sich': ['17–21 h · the flowers bow', '17–21 · تميل الأزهار'],
    '21–5 Uhr · Knospen, tiefes Blau': ['21–5 h · buds, deep blue', '21–5 · براعم، أزرق عميق'],
    'Feste Phase bleibt, bis du wieder „Automatisch“ wählst — gut zum Ausprobieren am Abend. Das eingebettete Team-Cockpit übernimmt das Farbschema.':
      ['A fixed phase stays until you pick “Automatic” again — handy for trying things out in the evening. The embedded Team-Cockpit follows the colour scheme.',
       'تبقى المرحلة الثابتة حتى تختار «تلقائي» مجددًا — مفيد للتجربة مساءً. وقُمرة الفريق المدمجة تتبع نظام الألوان.'],
    'Oberfläche, Rituale und Menüs. Deine Inhalte — Jira, Trello, Rückfragen, Checkins — bleiben in der Sprache, in der sie geschrieben wurden.':
      ['Interface, rituals and menus. Your own content — Jira, Trello, decisions, check-ins — stays in the language it was written in.',
       'الواجهة والطقوس والقوائم. أمّا محتواك — Jira وTrello والأسئلة وتقارير المتابعة — فيبقى بلغته الأصلية.'],

    /* ---- Rituale (Leiste) ----------------------------------------------- */
    'Morgencheck': ['Morning check', 'فحص الصباح'],
    'Abendcheck': ['Evening check', 'فحص المساء'],
    'Wochenstart': ['Week start', 'بداية الأسبوع'],
    'Wochen-Rückschau': ['Weekly review', 'مراجعة الأسبوع'],
    'Rückschau': ['Review', 'المراجعة'],
    'Rückfragen von Claude': ['Questions from Claude', 'أسئلة من كلود'],
    'Rückfragen': ['Open questions', 'أسئلة معلّقة'],
    'Meine Rückfragen': ['My questions for you', 'أسئلتي إليك'],
    'Ritual': ['Ritual', 'طقس'],
    '5 Minuten, dann läuft der Tag': ['Five minutes, then the day runs', 'خمس دقائق، ثم ينطلق اليوم'],
    '{1} Min': ['{1} min', '{1} د'],
    'ab 17 Uhr · Sport, Erholung, dein Projekt': ['from 17:00 · exercise, rest, your own project', 'من الساعة 17 · رياضة وراحة ومشروعك'],
    'ab 17 h': ['from 17:00', 'من 17'],
    'Tag schließen · Sport, Erholung, dein Projekt': ['Close the day · exercise, rest, your own project', 'أغلق اليوم · رياضة وراحة ومشروعك'],
    'Tag geschlossen — der Abend gehört dir': ['Day closed — the evening is yours', 'أُغلق اليوم — المساء لك'],
    'montags': ['on Mondays', 'أيام الاثنين'],
    'freitags': ['on Fridays', 'أيام الجمعة'],
    'Heute — Woche setzen': ['Today — set the week', 'اليوم — حدّد الأسبوع'],
    'Heute — Woche abschließen': ['Today — close the week', 'اليوم — أغلق الأسبوع'],
    'fällig': ['due', 'مستحق'],
    '{1} warten auf eine Entscheidung': ['{1} waiting for a decision', '{1} بانتظار قرار'],
    '{1} offen': ['{1} open', '{1} مفتوح'],
    'alles beantwortet': ['all answered', 'أُجيب عن الكل'],
    'Kurz entscheiden — das entsperrt meine Arbeit.': ['A quick decision — it unblocks my work.', 'قرار سريع — يفتح لي طريق العمل.'],
    '„Später“ ist auch eine Antwort.': ['“Later” is an answer too.', '«لاحقًا» جواب أيضًا.'],
    'Ein Klick reicht, „später“ ist auch eine Antwort.': ['One click is enough — “later” is an answer too.', 'نقرة واحدة تكفي، و«لاحقًا» جواب أيضًا.'],
    'Liegengebliebenes freigeben': ['Release what is left lying around', 'إطلاق ما بقي معلّقًا'],
    'Was seit gestern uncommittet herumliegt — freigeben oder liegen lassen?':
      ['What has been sitting uncommitted since yesterday — release it or leave it?', 'ما بقي دون تثبيت منذ أمس — أنُطلقه أم نتركه؟'],
    'Freigeben = committen und pushen. Ohne Ziel-Angabe hat sich keine Session gemeldet: dann lieber später und nachfragen.':
      ['Release = commit and push. With no stated goal, no session has checked in: better to wait and ask.',
       'الإطلاق = تثبيت ودفع. وإن لم يُذكر هدف فلم تُسجّل أي جلسة نفسها: الأفضل التأجيل والسؤال.'],
    'Fluss der Woche': ['Flow of the week', 'تدفّق الأسبوع'],
    'Was sagt dein Board — was hat den Fluss gebremst?': ['What does your board say — what slowed the flow?', 'ماذا يقول لوحك — ما الذي أبطأ التدفّق؟'],
    'WIP, Alterung, Wartet, Fertig. Ein Satz Erkenntnis reicht (Personal Kanban: sehen → begrenzen → anpassen).':
      ['WIP, ageing, waiting, done. One sentence of insight is enough (personal kanban: see → limit → adjust).',
       'العمل الجاري والتقادم والانتظار والمنجز. جملة واحدة تكفي (كانبان الشخصي: انظر ← حدّد ← عدّل).'],

    /* ---- Ritual-Schritte (rhythmus-data.js) ------------------------------ */
    'Das Eine': ['The One Thing', 'الأمر الواحد'],
    'Das Eine · heute': ['The One Thing · today', 'الأمر الواحد · اليوم'],
    'Das Eine für morgen': ['The One Thing for tomorrow', 'الأمر الواحد للغد'],
    'Noch nicht gesetzt — starte den Morgencheck': ['Not set yet — start the morning check', 'لم يُحدَّد بعد — ابدأ فحص الصباح'],
    'Wenn heute nur eine Sache fertig wird — welche?': ['If only one thing gets finished today — which one?', 'إن أُنجز شيء واحد اليوم — فما هو؟'],
    'Wenn morgen nur eine Sache fertig wird — welche?': ['If only one thing gets finished tomorrow — which one?', 'إن أُنجز شيء واحد غدًا — فما هو؟'],
    'Ein Satz. Nicht die Liste, das Ergebnis.': ['One sentence. Not the list — the result.', 'جملة واحدة. لا القائمة بل النتيجة.'],
    'Ein Satz. Der Morgencheck schlägt ihn dir morgen zum Übernehmen vor — ins Feld geschrieben wird nur, was du antippst.':
      ['One sentence. Tomorrow’s morning check will offer it to you — only what you tap goes into the field.',
       'جملة واحدة. سيعرضها عليك فحص الصباح غدًا — ولا يُكتب في الحقل إلا ما تنقره.'],
    'Zahlen-Blick': ['A look at the numbers', 'نظرة على الأرقام'],
    'Hat sich über Nacht etwas bewegt?': ['Has anything moved overnight?', 'هل تحرّك شيء خلال الليل؟'],
    'Kommt automatisch aus den Kennzahlen.': ['Comes straight from the metrics.', 'يأتي تلقائيًا من المؤشرات.'],
    'Was heute ansteht': ['What is on for today', 'ما ينتظرك اليوم'],
    'Passt der Tag zu dem Einen von eben?': ['Does the day fit the One Thing you just named?', 'هل يتوافق اليوم مع الأمر الواحد الذي حدّدته؟'],
    'Wenn nicht: eine Sache streichen.': ['If not: cut one thing.', 'إن لم يكن كذلك: احذف شيئًا واحدًا.'],
    'Übergabe an Claude': ['Handover to Claude', 'التسليم إلى كلود'],
    'Woran soll ich heute arbeiten, während du anderes machst?': ['What should I work on today while you do other things?', 'على ماذا أعمل اليوم بينما تنشغل بغيره؟'],
    'Am Ende kopierst du alles in einem Rutsch in den Chat.': ['At the end you copy everything into the chat in one go.', 'في النهاية تنسخ كل شيء دفعة واحدة إلى المحادثة.'],
    'Tagesbilanz': ['Day’s balance', 'حصيلة اليوم'],
    'Ist „das Eine“ von heute Morgen fertig geworden?': ['Did “the One Thing” from this morning get finished?', 'هل أُنجز «الأمر الواحد» الذي حدّدته صباحًا؟'],
    'Ehrlich, ohne Drama. Halb fertig ist auch eine Antwort.': ['Honestly, without drama. Half done is an answer too.', 'بصدق ودون مبالغة. «نصف منجز» جواب أيضًا.'],
    'Fertig': ['Done', 'منجز'],
    'Halb — morgen weiter': ['Half — continuing tomorrow', 'نصفه — نكمل غدًا'],
    'Nicht angefangen': ['Not started', 'لم يبدأ'],
    'Anderes wurde wichtiger': ['Something else became more important', 'صار غيره أهم'],
    'Ablegen': ['Set aside', 'التنحية'],
    'Was bleibt bewusst bis morgen liegen?': ['What are you deliberately leaving until tomorrow?', 'ما الذي تتركه عمدًا حتى الغد؟'],
    'Aufschreiben heißt loslassen — der Kopf muss es nicht mehr tragen.': ['Writing it down means letting go — your head no longer has to carry it.', 'الكتابة تعني الإفلات — لم يعد على رأسك حمله.'],
    'Dein Abend': ['Your evening', 'مساؤك'],
    'Was tust du heute für Körper oder Kopf?': ['What are you doing today for body or mind?', 'ماذا تفعل اليوم لجسدك أو لذهنك؟'],
    'Bewegung oder echte Erholung — mindestens 20 Minuten. Nicht verdienen, einfach machen.':
      ['Movement or real rest — at least 20 minutes. Not earned, just done.', 'حركة أو راحة حقيقية — 20 دقيقة على الأقل. لا تُستحقّ، بل تُفعل.'],
    'Sport': ['Exercise', 'رياضة'],
    'Draußen / Spaziergang': ['Outdoors / a walk', 'في الخارج / نزهة'],
    'Yoga / Dehnen': ['Yoga / stretching', 'يوغا / إطالة'],
    'Lesen / Musik': ['Reading / music', 'قراءة / موسيقى'],
    'Früh schlafen': ['An early night', 'نوم مبكر'],
    'Heute nichts': ['Nothing today', 'لا شيء اليوم'],
    'Privatprojekt': ['Personal project', 'مشروع شخصي'],
    '20 Minuten für dein eigenes Ding — KI-Master oder etwas anderes?': ['Twenty minutes for your own thing — AI mastery or something else?', 'عشرون دقيقة لمشروعك الخاص — إتقان الذكاء الاصطناعي أم غيره؟'],
    'Kleine Schritte zählen doppelt: eine Lektion, ein Kapitel, ein Experiment. Deine Lern-Tickets stehen in der KI-Trainer-Karte.':
      ['Small steps count double: one lesson, one chapter, one experiment. Your learning tickets are in the AI trainer card.',
       'الخطوات الصغيرة تُحتسب مرتين: درس، فصل، تجربة. تذاكر تعلّمك في بطاقة مدرّب الذكاء الاصطناعي.'],
    'KI-Master: eine Lektion': ['AI mastery: one lesson', 'إتقان الذكاء الاصطناعي: درس واحد'],
    'KI-Experiment / Tool testen': ['AI experiment / try a tool', 'تجربة ذكاء اصطناعي / اختبار أداة'],
    'Anderes Projekt': ['Another project', 'مشروع آخر'],
    'Heute nicht': ['Not today', 'ليس اليوم'],
    'Was muss diese Woche wahr sein, damit sie gut war?': ['What has to be true this week for it to have been a good one?', 'ما الذي يجب أن يتحقّق هذا الأسبوع ليكون أسبوعًا جيدًا؟'],
    'Ein Ergebnis, kein Tätigkeitswort.': ['A result, not a verb.', 'نتيجة، لا فعلًا.'],
    'Die drei Brocken der Woche?': ['The three big rocks of the week?', 'الصخور الثلاث الكبرى للأسبوع؟'],
    'Mehr als drei sind keine Prioritäten.': ['More than three are not priorities.', 'أكثر من ثلاث ليست أولويات.'],
    'Was lässt du diese Woche bewusst liegen?': ['What are you deliberately leaving undone this week?', 'ما الذي تتركه عمدًا هذا الأسبوع؟'],
    'Ohne diese Antwort wird die Woche wieder voll.': ['Without this answer the week fills up again.', 'بدون هذا الجواب سيمتلئ الأسبوع من جديد.'],
    'Welchen Brocken übernehme ich?': ['Which rock do I take on?', 'أيّ صخرة أتولّاها؟'],
    'Ich arbeite ihn über die Woche ab und melde mich mit Rückfragen.': ['I will work through it during the week and come back with questions.', 'سأعمل عليها خلال الأسبوع وأعود إليك بالأسئلة.'],
    'Was ist wirklich fertig geworden?': ['What actually got finished?', 'ما الذي أُنجز فعلًا؟'],
    'Zahlen dazu stehen oben — nimm sie ernst, auch wenn sie klein sind.': ['The numbers are above — take them seriously, even when they are small.', 'الأرقام في الأعلى — خذها بجدّية وإن كانت صغيرة.'],
    'Was blieb liegen — und warum?': ['What was left undone — and why?', 'ما الذي بقي معلّقًا — ولماذا؟'],
    'Warum ist wichtiger als was.': ['Why matters more than what.', '«لماذا» أهم من «ماذا».'],
    'Was nimmst du in die nächste Woche mit?': ['What are you taking into next week?', 'ما الذي تحمله معك إلى الأسبوع القادم؟'],
    'Eine Erkenntnis reicht.': ['One insight is enough.', 'استنتاج واحد يكفي.'],
    'Welches Ticket darf sterben?': ['Which ticket is allowed to die?', 'أيّ تذكرة يُسمح لها بأن تموت؟'],
    'Erholung ist keine Belohnung, sondern Teil der Arbeit.': ['Rest is not a reward — it is part of the work.', 'الراحة ليست مكافأة، بل جزء من العمل.'],
    '20 Minuten Bewegung heute schlagen den Vorsatz für morgen.': ['Twenty minutes of movement today beat a resolution for tomorrow.', 'عشرون دقيقة من الحركة اليوم خير من عزم على الغد.'],
    'Wer den Tag schließt, kann morgen wieder öffnen.': ['Whoever closes the day can open it again tomorrow.', 'من يُغلق يومه يستطيع فتحه غدًا.'],
    'Kopf aus, Körper an — die guten Ideen kommen beim Gehen.': ['Head off, body on — the good ideas come while walking.', 'أطفئ رأسك وشغّل جسدك — الأفكار الجيدة تأتي أثناء المشي.'],
    'Ein Kapitel heute ist mehr als ein Kurs „irgendwann“.': ['One chapter today beats a course “some day”.', 'فصل اليوم خير من دورة «يومًا ما».'],

    /* ---- Ritual-Overlay -------------------------------------------------- */
    'Schritt {1}/{2}': ['Step {1}/{2}', 'الخطوة {1}/{2}'],
    'Zurück': ['Back', 'رجوع'],
    'Weiter': ['Next', 'التالي'],
    'Überspringen': ['Skip', 'تخطٍّ'],
    'Schließen': ['Close', 'إغلاق'],
    'Schließen (Esc)': ['Close (Esc)', 'إغلاق (Esc)'],
    'weiter': ['go on', 'تابع'],
    'später': ['later', 'لاحقًا'],
    'fertig': ['done', 'تم'],
    'Gestern Abend vorgenommen': ['Set yourself last night', 'ما عزمت عليه مساء أمس'],
    'Gestern bewusst auf heute verschoben': ['Deliberately moved to today yesterday', 'أُجّل عمدًا إلى اليوم'],
    'übernehmen': ['use this', 'اعتمده'],
    'Und was du dir vorgenommen hast:': ['And what you set out to do:', 'وما عزمت عليه:'],
    'In einem Satz …': ['In one sentence …', 'في جملة واحدة …'],
    'Was noch heute passieren muss …': ['What still has to happen today …', 'ما الذي يجب أن يحدث اليوم …'],
    'z. B. Aufräum-Vorschlag umsetzen, Domain-Umzugsplan, Kennzahlen ziehen':
      ['e.g. carry out the clean-up proposal, the domain migration plan, pull the metrics',
       'مثلًا: تنفيذ اقتراح التنظيف، خطة نقل النطاق، سحب المؤشرات'],
    'Aus „{1}“. Reicht dir das? Sonst hier notieren:': ['From “{1}”. Is that enough? Otherwise note it here:', 'من «{1}». أيكفيك ذلك؟ وإلا فدوّنه هنا:'],
    'Heute schon gemacht — kein zusätzliches XP.': ['Already done today — no extra XP.', 'أُنجز اليوم — لا نقاط إضافية.'],
    'Tag geschlossen. Der Abend gehört dir — und morgen liegt „das Eine“ schon bereit.':
      ['Day closed. The evening is yours — and tomorrow’s One Thing is already waiting.',
       'أُغلق اليوم. المساء لك — والأمر الواحد للغد جاهز بالفعل.'],
    'Rückruf-Anfragen (echt)': ['call-back requests (real)', 'طلبات معاودة اتصال (حقيقية)'],
    'Details in den': ['Details in the', 'التفاصيل في'],
    'Aufrufe gestern · -{1} % ggü. Ø {2} T': ['Views yesterday · -{1} % vs. Ø {2} d', 'زيارات أمس · -{1} % مقابل متوسط {2} يومًا'],
    'Aufrufe gestern · −{1} % ggü. Ø {2} T': ['Views yesterday · −{1} % vs. Ø {2} d', 'زيارات أمس · −{1} % مقابل متوسط {2} يومًا'],
    'Postfach-Rückstand (live über john-server, GET /api/postfach — gefüllt von der Aufgabe „compass-postfach“)':
      ['Inbox backlog (live via the Coach server, GET /api/postfach — filled by the “compass-postfach” task)',
       'متراكم البريد (مباشر عبر خادم مدرّب، GET /api/postfach — تملؤه مهمة «compass-postfach»)'],
    'Alles beantwortet — danke. Neue Rückfragen lege ich hier ab, sobald welche auftauchen.':
      ['All answered — thank you. New questions will appear here as soon as there are any.', 'أُجيب عن الكل — شكرًا. سأضع الأسئلة الجديدة هنا فور ظهورها.'],
    'Nichts liegengeblieben — alle vier Repos sind sauber. Schön.': ['Nothing left lying around — all four repositories are clean. Good.', 'لم يبقَ شيء معلّق — المستودعات الأربعة نظيفة. جميل.'],
    'Freigeben': ['Release', 'إطلاق'],
    'Womit soll der Commit überschrieben werden?': ['What should the commit be called?', 'بأيّ عنوان يُثبَّت التغيير؟'],
    'Text der Übergabe zeigen': ['Show the handover text', 'إظهار نص التسليم'],
    'Kopieren': ['Copy', 'نسخ'],
    'kopiert': ['copied', 'نُسخ'],
    'Bitte oben markieren': ['Please select it above', 'يُرجى تحديده أعلاه'],
    'Bitte manuell markieren': ['Please select it manually', 'يُرجى تحديده يدويًا'],
    'Übergabe an Claude läuft …': ['Handover to Claude in progress …', 'جارٍ التسليم إلى كلود …'],
    'Übergabe läuft …': ['Handover in progress …', 'جارٍ التسليم …'],
    'Angekommen': ['Delivered', 'وصل'],
    'Angekommen.': ['Delivered.', 'وصل.'],
    'Nachgereicht.': ['Delivered after all.', 'سُلِّم لاحقًا.'],
    'Rückfragen mit Coach': ['Questions with Coach', 'أسئلة مع مدرّب'],
    'Für Claude kopieren': ['Copy for Claude', 'انسخ لكلود'],
    /* Die Warnzeile ist ein einziger Textknoten ohne Elementgrenze — sie braucht den
       vollen Wortlaut als Schlüssel. Deshalb bekommt ein Netzfehler in dashboard.html
       den deutschen Klartext „Server nicht erreichbar“ statt der Browsermeldung
       „Failed to fetch“: sonst wäre die Zeile nicht auflösbar und bliebe deutsch. */
    '⚠ Noch nicht übergeben: Server nicht erreichbar — ich versuche es weiter und melde mich hier, sobald sie angekommen ist. Du musst nichts tun und nichts neu laden.':
      ['⚠ Not handed over yet: server not reachable — I keep trying and will say so here as soon as it has arrived. You do not have to do anything, and nothing needs reloading.',
       '⚠ لم يُسلَّم بعد: الخادم غير متاح — سأواصل المحاولة وسأخبرك هنا حالما يصل. لا يلزمك فعل شيء ولا إعادة تحميل.'],
    'Liegengebliebene Übergabe nachgereicht': ['Pending handover delivered', 'تم تسليم ما تبقّى'],
    'Server nicht erreichbar': ['Server not reachable', 'الخادم غير متاح'],
    'Läuft': ['Running', 'يعمل'],
    'Antworten auf deine Rückfragen:': ['Answers to your questions:', 'إجابات أسئلتك:'],
    'Feierabend für mich. Was liegen bleibt, nimm bitte in den Morgencheck von morgen; das Eine für morgen steht oben.':
      ['That is me done for the day. Whatever is left, take into tomorrow’s morning check; the One Thing for tomorrow is above.',
       'انتهى يومي. ما بقي فخُذه إلى فحص الغد الصباحي؛ والأمر الواحد للغد مذكور أعلاه.'],
    'Bitte arbeite damit weiter und frag nach, wo es klemmt.': ['Please carry on with this and ask where it gets stuck.', 'تابع من هنا واسأل عند التعثّر.'],

    /* ---- Kontext-Leiste -------------------------------------------------- */
    'Alle': ['All', 'الكل'],
    'Kontext 1': ['Kontext 1', 'الفريق أرتيستس'],
    'Projekt': ['Projekt', 'المشروع'],
    'Privat': ['Private', 'شخصي'],
    'privat': ['private', 'شخصي'],
    'Finanzen': ['Finance', 'المالية'],
    'Finanzen & Sonstiges': ['Finance & other', 'المالية وغيرها'],
    'Arbeit': ['Work', 'العمل'],
    'Alle Kontexte zusammen (Taste 0)': ['All contexts together (key 0)', 'كل السياقات معًا (المفتاح 0)'],
    'Nur Kontext 1 — Strg+Klick: dazunehmen': ['Kontext 1 only — Ctrl+click to add', 'الفريق أرتيستس فقط — Ctrl+نقر للإضافة'],
    'Nur Projekt — Strg+Klick: dazunehmen': ['Projekt only — Ctrl+click to add', 'المشروع فقط — Ctrl+نقر للإضافة'],
    'Nur Privat — Strg+Klick: dazunehmen': ['Private only — Ctrl+click to add', 'الشخصي فقط — Ctrl+نقر للإضافة'],
    'Nur Finanzen — Strg+Klick: dazunehmen': ['Finance only — Ctrl+click to add', 'المالية فقط — Ctrl+نقر للإضافة'],
    'Sektion ein-/ausklappen': ['Expand / collapse section', 'طيّ القسم أو فتحه'],
    'Karte zuklappen': ['Collapse card', 'طيّ البطاقة'],
    'zurück': ['back', 'رجوع'],

    /* ---- Sektionen & Karten --------------------------------------------- */
    'Heute im Blick': ['Today at a glance', 'اليوم في لمحة'],
    'Nächste Schritte': ['Next steps', 'الخطوات التالية'],
    'Jetzt wichtig · Termine · Vorbereiten · Diese Woche': ['Important now · appointments · prepare · this week', 'المهم الآن · المواعيد · التحضير · هذا الأسبوع'],
    'Mein Board': ['My board', 'لوحي'],
    'Team Kanban': ['Team kanban', 'كانبان الفريق'],
    'Arbeit & Tickets': ['Work & tickets', 'العمل والتذاكر'],
    'Aufräumen, Web-Meldungen': ['Clean-up, web reports', 'التنظيف وبلاغات الموقع'],
    'Projekte': ['Projects', 'المشاريع'],
    'Finance, Projekt, Neukunden, nächste Schritte': ['Finance, Projekt, new clients, next steps', 'المالية والمشروع والعملاء الجدد والخطوات التالية'],
    'Kanäle': ['Channels', 'القنوات'],
    'E-Mail, Slack, Facebook': ['Email, Slack, Facebook', 'البريد وسلاك وفيسبوك'],
    'Rhythmus & Claude': ['Rhythm & Claude', 'الإيقاع وكلود'],
    'Level, Badges, Arbeit mit Claude, offene Rückfragen': ['Level, badges, working with Claude, open questions', 'المستوى والأوسمة والعمل مع كلود والأسئلة المفتوحة'],
    'Kennzahlen': ['Metrics', 'المؤشرات'],
    'Kennzahlen & Melde-Knopf': ['Metrics & report button', 'المؤشرات وزر البلاغ'],
    'Kundenlage': ['Client situation', 'وضع العملاء'],
    'Coach fragen': ['Ask Coach', 'اسأل مدرّب'],
    'Jetzt wichtig': ['Important now', 'المهم الآن'],
    'Termine': ['Appointments', 'المواعيد'],
    'Vorbereiten': ['Prepare', 'التحضير'],
    'Diese Woche': ['This week', 'هذا الأسبوع'],
    'Deine Schritte': ['Your steps', 'خطواتك'],
    'Claude übernimmt': ['Claude takes over', 'كلود يتولّى'],
    'Dein Tag': ['Your day', 'يومك'],
    'Wartet auf dich': ['Waiting for you', 'بانتظارك'],
    'Wetter am Ort': ['Local weather', 'الطقس محليًا'],
    'Deine Seiten': ['Your sites', 'مواقعك'],
    'Deine Sicherungen': ['Your backups', 'نسخك الاحتياطية'],
    'Dein Rhythmus': ['Your rhythm', 'إيقاعك'],
    'Mit Claude als nächstes': ['Next up with Claude', 'التالي مع كلود'],
    'Ticket-Aufräumen': ['Ticket clean-up', 'تنظيف التذاكر'],
    'Web-Meldungen': ['Web reports', 'بلاغات الموقع'],
    'Jira (Team)': ['Jira (Team)', 'Jira (الفريق)'],
    'KI-Champion-Pfad': ['AI champion path', 'مسار بطل الذكاء الاصطناعي'],
    'Projekte · nächste Schritte': ['Projects · next steps', 'المشاريع · الخطوات التالية'],
    'E-Mail · Konten': ['Email · accounts', 'البريد · الحسابات'],
    'Slack': ['Slack', 'سلاك'],
    'Fragen an dich': ['questions for you', 'أسئلة لك'],
    '{1} Fragen an dich': ['{1} questions for you', '{1} أسئلة لك'],
    'warten auf deine Entscheidung': ['waiting for your decision', 'بانتظار قرارك'],
    'wartet auf deine Entscheidung': ['waiting for your decision', 'بانتظار قرارك'],
    'Jetzt entscheiden': ['Decide now', 'قرّر الآن'],
    'Jetzt freigeben': ['Release now', 'أطلق الآن'],
    'Entscheiden': ['Decide', 'قرّر'],
    'Rückfrage jetzt beantworten': ['Answer this question now', 'أجب عن السؤال الآن'],
    'Rückfragen jetzt beantworten': ['Answer the open questions now', 'أجب عن الأسئلة المفتوحة الآن'],
    'Durch alle {1} Fragen blättern': ['Page through all {1} questions', 'تصفّح الأسئلة الـ{1}'],
    '{1} weitere': ['{1} more', '{1} إضافية'],
    '{1}–{2} von {3}': ['{1}–{2} of {3}', '{1}–{2} من {3}'],
    '{1} weitere zeigen': ['Show {1} more', 'إظهار {1} إضافية'],
    'weniger zeigen': ['Show fewer', 'إظهار أقل'],
    'weitere zeigen': ['show more', 'إظهار المزيد'],
    'Öffnen': ['Open', 'فتح'],
    'Quelle': ['Source', 'المصدر'],
    'Quelle öffnen': ['Open source', 'فتح المصدر'],
    'Details & Herkunft anzeigen': ['Show details and origin', 'إظهار التفاصيل والمصدر'],
    'Quellen — Details anzeigen': ['sources — show details', 'مصادر — إظهار التفاصيل'],
    '{1} Quellen — Details anzeigen': ['{1} sources — show details', '{1} مصادر — إظهار التفاصيل'],
    'Pfad kopieren': ['Copy path', 'نسخ المسار'],
    'Pfad kopieren:': ['Copy path:', 'نسخ المسار:'],
    'Eintrag': ['Entry', 'مُدخل'],
    'in diesem Kontext nichts offen': ['nothing open in this context', 'لا شيء مفتوح في هذا السياق'],
    '{1} in anderen Kontexten': ['{1} in other contexts', '{1} في سياقات أخرى'],
    'Gefiltert nach deiner Kontextauswahl': ['Filtered by your context selection', 'مُرشَّح حسب اختيارك للسياق'],
    'offen': ['open', 'مفتوح'],
    'erledigt': ['done', 'منجز'],
    'in Arbeit': ['in progress', 'قيد العمل'],
    'geplant': ['planned', 'مخطَّط'],
    'laufend': ['ongoing', 'جارٍ'],
    'bald': ['soon', 'قريبًا'],
    'heute': ['today', 'اليوم'],
    'live': ['live', 'مباشر'],
    'abgelegt': ['set aside', 'مُنحّى'],
    'diese Woche': ['this week', 'هذا الأسبوع'],
    'wöchentlich': ['weekly', 'أسبوعيًا'],
    'wartet auf Go': ['waiting for your go-ahead', 'بانتظار موافقتك'],
    'in Vorbereitung': ['in preparation', 'قيد التحضير'],
    'offline': ['offline', 'غير متصل'],
    'nicht angebunden': ['not connected', 'غير مربوط'],
    'verbunden': ['connected', 'متصل'],
    'nicht verbunden': ['not connected', 'غير متصل'],
    'schließen': ['close', 'إغلاق'],
    'behalten': ['keep', 'إبقاء'],
    'in Jira öffnen': ['open in Jira', 'فتح في Jira'],
    'in der Quelle öffnen': ['open at the source', 'فتح في المصدر'],
    'Melde-Formular in neuem Tab — der Compass bleibt offen': ['Report form in a new tab — the Compass stays open', 'نموذج البلاغ في تبويب جديد — تبقى البوصلة مفتوحة'],
    'Bug/Feedback melden': ['Report a bug or feedback', 'أبلغ عن خلل أو ملاحظة'],

    /* ---- Mein Board (Personal Kanban) ------------------------------------ */
    'Personal Kanban': ['Personal kanban', 'كانبان شخصي'],
    'Backlog': ['Backlog', 'قائمة الانتظار'],
    'Bereit': ['Ready', 'جاهز'],
    'In Arbeit': ['In progress', 'قيد العمل'],
    'Wartet': ['Waiting', 'ينتظر'],
    'Optionen — noch nicht gezogen': ['Options — not pulled yet', 'خيارات — لم تُسحب بعد'],
    'Als Nächstes — klar, klein, ziehbar': ['Up next — clear, small, pullable', 'التالي — واضح وصغير وقابل للسحب'],
    'WIP-Limit — erst fertig, dann neu': ['WIP limit — finish first, then start', 'حدّ العمل الجاري — أنجز أولًا ثم ابدأ'],
    'Auf andere, auf Entscheidung, blockiert': ['On others, on a decision, blocked', 'بانتظار آخرين أو قرار، أو محجوب'],
    'letzte 7 Tage': ['last 7 days', 'آخر 7 أيام'],
    'Karten hierher ziehen': ['drag cards here', 'اسحب البطاقات إلى هنا'],
    'leer — zieh dir eine Karte': ['empty — pull yourself a card', 'فارغ — اسحب بطاقة'],
    'noch nichts diese Woche': ['nothing yet this week', 'لا شيء بعد هذا الأسبوع'],
    'Neue Karte': ['New card', 'بطاقة جديدة'],
    'Karte': ['Card', 'بطاقة'],
    'Ziehen': ['Pull', 'اسحب'],
    'In Arbeit ziehen (Pull)': ['Pull into “in progress”', 'اسحبها إلى «قيد العمل»'],
    'Direkt fertig': ['Straight to done', 'إلى المنجز مباشرة'],
    'Als fertig markieren (Compass-lokal)': ['Mark as done (Compass only)', 'وسمها منجزة (في البوصلة فقط)'],
    'Zurück in die Quelle-Spalte': ['Back to the source column', 'العودة إلى عمود المصدر'],
    'Doch nicht fertig': ['Not done after all', 'ليست منجزة بعد كل شيء'],
    'Eigene Karte löschen': ['Delete your own card', 'حذف بطاقتك'],
    'Limit {1}': ['Limit {1}', 'الحدّ {1}'],
    'WIP-Limit ändern': ['Change the WIP limit', 'تغيير حدّ العمل الجاري'],
    'WIP-Limit für „In Arbeit“ (Personal Kanban empfiehlt 3; ehrlich bleiben):':
      ['WIP limit for “in progress” (personal kanban suggests 3 — stay honest):', 'حدّ العمل الجاري لعمود «قيد العمل» (يوصي كانبان الشخصي بـ3 — كن صادقًا):'],
    'WIP': ['WIP', 'العمل الجاري'],
    'bereit': ['ready', 'جاهز'],
    'wartet': ['waiting', 'ينتظر'],
    'überfällig': ['overdue', 'متأخّر'],
    'ältestes in Arbeit': ['oldest in progress', 'الأقدم قيد العمل'],
    'fertig · 7 T': ['done · 7 d', 'منجز · 7 أيام'],
    'über Limit': ['over the limit', 'فوق الحدّ'],
    'das Eine': ['the One Thing', 'الأمر الواحد'],
    'das Eine heute': ['the One Thing today', 'الأمر الواحد اليوم'],
    'Rückfrage': ['Question', 'سؤال'],
    'Woche': ['Week', 'الأسبوع'],
    'Woche & Rückfragen': ['Week & questions', 'الأسبوع والأسئلة'],
    'eigene': ['own', 'خاصة'],
    'nicht mehr in der Quelle': ['no longer in the source', 'لم تعد في المصدر'],
    'Quelle filtern': ['Filter by source', 'ترشيح حسب المصدر'],
    'Nur Karten aus dem aktiven Kontext-Tab (wechselt mit 1–4)': ['Only cards from the active context tab (switch with 1–4)', 'بطاقات التبويب النشط فقط (بدّل بالمفاتيح 1–4)'],
    'Filter aufheben': ['Clear the filter', 'إلغاء الترشيح'],
    'dieser Tab': ['this tab', 'هذا التبويب'],
    'Nur im Compass': ['Compass only', 'في البوصلة فقط'],
    'Trello privat': ['Trello private', 'تريلو الشخصي'],
    'Trello Arbeit': ['Trello work', 'تريلو العمل'],
    'Trello-Listen': ['Trello lists', 'قوائم تريلو'],
    'Wertstrom über alle Quellen (Personal Kanban)': ['Value stream across all sources (personal kanban)', 'تدفّق القيمة عبر كل المصادر (كانبان شخصي)'],
    'Trello-Listen 1:1': ['Trello lists, one to one', 'قوائم تريلو كما هي'],
    'Karte ziehen (Maus) oder ▶/✓ · ↗ öffnet die Quelle · WIP-Limit {1}':
      ['Drag a card (mouse) or use ▶/✓ · ↗ opens the source · WIP limit {1}', 'اسحب بطاقة بالفأرة أو استخدم ▶/✓ · ↗ يفتح المصدر · حدّ العمل الجاري {1}'],
    'lokal': ['local', 'محلّي'],
    'synchron': ['in sync', 'متزامن'],
    'Erst eine Karte fertig machen, dann die nächste ziehen — sonst wird alles langsamer.':
      ['Finish one card before pulling the next — otherwise everything slows down.', 'أنجز بطاقة قبل سحب التالية — وإلا تباطأ كل شيء.'],
    '(Personal Kanban, Regel 2: WIP begrenzen)': ['(Personal kanban, rule 2: limit WIP)', '(كانبان شخصي، القاعدة 2: حدّد العمل الجاري)'],
    'Nichts in Arbeit.': ['Nothing in progress.', 'لا شيء قيد العمل.'],
    'oder die wichtigste Bereit-Karte — eine, nicht drei.': ['or the most important ready card — one, not three.', 'أو أهمّ بطاقة جاهزة — واحدة لا ثلاثًا.'],
    'Zerlegen, abgeben oder bewusst zurücklegen — Alterung ist das ehrlichste Signal.':
      ['Split it, hand it over or deliberately put it back — ageing is the most honest signal.', 'جزّئها أو سلّمها أو أعدها عمدًا — التقادم أصدق إشارة.'],
    '{1} Karten warten.': ['{1} cards are waiting.', '{1} بطاقة تنتظر.'],
    'Wer blockiert dich? Einmal nachfassen ist billiger als fünfmal hinschauen.':
      ['Who is blocking you? Following up once is cheaper than checking five times.', 'من يعيقك؟ متابعة واحدة أرخص من خمس نظرات.'],
    'Bereit ist leer.': ['Ready is empty.', 'عمود «جاهز» فارغ.'],
    'Nimm dir 2 Minuten und zieh 2–3 kleine Optionen aus dem Backlog nach vorn.':
      ['Take two minutes and pull two or three small options forward from the backlog.', 'خذ دقيقتين واسحب خيارين أو ثلاثة صغيرة من قائمة الانتظار.'],
    'Weiter so — eins nach dem anderen.': ['Keep it up — one thing at a time.', 'واصل — شيئًا واحدًا في كل مرة.'],
    'Fluss ok:': ['Flow is fine:', 'التدفّق جيد:'],
    'Karten auf Mein Board': ['cards on my board', 'بطاقات على لوحي'],
    'Karte im Compass angelegt': ['Card created in the Compass', 'أُنشئت البطاقة في البوصلة'],
    'Eine Zeile, ein Ergebnis. Wähle, wo die Karte leben soll — der Compass legt sie dort an und zeigt sie sofort im Board.':
      ['One line, one result. Choose where the card should live — the Compass creates it there and shows it on the board right away.',
       'سطر واحد ونتيجة واحدة. اختر أين تعيش البطاقة — تنشئها البوصلة هناك وتعرضها فورًا على اللوح.'],
    'Was soll fertig werden?': ['What should get finished?', 'ما الذي يجب إنجازه؟'],
    'Wo anlegen (Kontext)?': ['Where to create it (context)?', 'أين تُنشأ (السياق)؟'],
    'Trello-Liste': ['Trello list', 'قائمة تريلو'],
    'Jira-Projekt · Typ': ['Jira project · type', 'مشروع Jira · النوع'],
    'Spalte im Board': ['Column on the board', 'العمود على اللوح'],
    'Notiz / Link (optional)': ['Note / link (optional)', 'ملاحظة / رابط (اختياري)'],
    'Abbrechen': ['Cancel', 'إلغاء'],
    'Anlegen': ['Create', 'إنشاء'],
    'z. B. GA4-Dienstkonto-Schlüssel hinterlegen': ['e.g. store the GA4 service account key', 'مثلًا: احفظ مفتاح حساب خدمة GA4'],
    'Kontext oder Link — z. B. ein Miro-Board oder eine Confluence-Seite; die URL wird zum ↗-Quell-Link der Karte':
      ['Context or link — e.g. a Miro board or a Confluence page; the URL becomes the card’s ↗ source link',
       'سياق أو رابط — لوح Miro أو صفحة Confluence مثلًا؛ يصبح الرابط مصدر البطاقة ↗'],
    'Schnellkarte nur im Compass (localStorage) — für Gedanken, die noch kein Ticket sind.':
      ['A quick card in the Compass only (localStorage) — for thoughts that are not tickets yet.',
       'بطاقة سريعة في البوصلة فقط — لأفكار لم تصر تذاكر بعد.'],
    'Die Karte entsteht in Trello (Token braucht scope=read,write) und erscheint danach im Board.':
      ['The card is created in Trello (the token needs scope=read,write) and then appears on the board.',
       'تُنشأ البطاقة في تريلو (يحتاج الرمز إلى scope=read,write) ثم تظهر على اللوح.'],
    'Vorgang wird dir zugewiesen angelegt (JIRA_EMAIL/JIRA_TOKEN).': ['The issue is created and assigned to you (JIRA_EMAIL/JIRA_TOKEN).', 'تُنشأ المهمة وتُسند إليك (JIRA_EMAIL/JIRA_TOKEN).'],
    'Jira ist nicht angebunden (JIRA_EMAIL/JIRA_TOKEN) — Anlegen geht erst danach.':
      ['Jira is not connected (JIRA_EMAIL/JIRA_TOKEN) — creating works only after that.', 'Jira غير مربوط (JIRA_EMAIL/JIRA_TOKEN) — لا يمكن الإنشاء قبل ذلك.'],
    'Keine Liste gewählt': ['No list selected', 'لم تُختر قائمة'],
    'Trello nicht geladen — Coach-Server läuft?': ['Trello not loaded — is the Coach server running?', 'لم يُحمَّل تريلو — هل خادم مدرّب يعمل؟'],
    '(Board nicht geladen)': ['(board not loaded)', '(لم يُحمَّل اللوح)'],
    'Das Eine bleibt in Arbeit — ändere es im Morgencheck.': ['The One Thing stays in progress — change it in the morning check.', 'يبقى الأمر الواحد قيد العمل — غيّره في فحص الصباح.'],
    'Trello-Token darf nur lesen — die Spalte merkt sich vorerst nur der Compass.':
      ['The Trello token is read-only — for now only the Compass remembers the column.', 'رمز تريلو للقراءة فقط — لن يتذكّر العمود سوى البوصلة حاليًا.'],
    'Jira nicht angebunden (JIRA_EMAIL/JIRA_TOKEN) — Spalte nur im Compass gemerkt.':
      ['Jira not connected (JIRA_EMAIL/JIRA_TOKEN) — the column is remembered in the Compass only.', 'Jira غير مربوط — العمود محفوظ في البوصلة فقط.'],
    'Trello-Schlüssel fehlt — Spalte nur im Compass gemerkt.': ['Trello key missing — the column is remembered in the Compass only.', 'مفتاح تريلو مفقود — العمود محفوظ في البوصلة فقط.'],
    'Coach-Server nicht erreichbar — Spalte nur im Compass gemerkt.': ['Coach server not reachable — the column is remembered in the Compass only.', 'خادم مدرّب غير متاح — العمود محفوظ في البوصلة فقط.'],
    'Personal Kanban (Benson/Barry):': ['Personal kanban (Benson/Barry):', 'كانبان شخصي (بنسون/باري):'],
    'Arbeit sichtbar machen': ['make work visible', 'اجعل العمل مرئيًا'],
    'WIP begrenzen': ['limit WIP', 'حدّد العمل الجاري'],
    'Bedienbar:': ['How to use it:', 'طريقة الاستخدام:'],
    'Sync:': ['Sync:', 'المزامنة:'],
    'eine Sicht über Trello privat + Arbeit, Diese-Woche-Schritte, Rückfragen, Jira und das Eine — und':
      ['one view across Trello private + work, this week’s steps, open questions, Jira and the One Thing — and',
       'عرض واحد يجمع تريلو الشخصي والعمل وخطوات الأسبوع والأسئلة وJira والأمر الواحد — و'],
    'Verschieben schreibt zurück (Trello-Liste, Jira-Statuswechsel, ✓ archiviert die Trello-Karte); klappt das nicht (Nur-Lese-Token, kein Jira-Schlüssel, Server offline), steht':
      ['Moving a card writes back (Trello list, Jira status change, ✓ archives the Trello card); if that fails (read-only token, no Jira key, server offline), you will see',
       'نقل البطاقة يُكتب في المصدر (قائمة تريلو، تغيير حالة Jira، و✓ يؤرشف بطاقة تريلو)؛ وإن تعذّر ذلك (رمز للقراءة فقط، أو غياب مفتاح Jira، أو خادم متوقّف) ظهر'],
    'an der Karte und nur der Compass merkt es sich, sonst':
      ['on the card, and only the Compass remembers it — otherwise', 'على البطاقة، ولا تتذكّره سوى البوصلة — وإلا'],
    'Miro/Confluence sind nicht angebunden — solche Aufgaben als Compass- oder Trello-Karte mit Link führen. Wechsel mit':
      ['Miro/Confluence are not connected — keep such tasks as a Compass or Trello card with a link. Switch with',
       'Miro وConfluence غير مربوطين — اجعل تلك المهام بطاقة في البوصلة أو تريلو مع رابط. بدّل بـ'],
    'Karten per Maus in eine Spalte ziehen (oder ▶ / ⏸ / ✓), ↗ öffnet die Quelle, ＋ legt eine Karte an — wahlweise nur im Compass, in Trello oder als Jira-Vorgang.':
      ['Drag cards into a column with the mouse (or use ▶ / ⏸ / ✓), ↗ opens the source, ＋ creates a card — in the Compass only, in Trello or as a Jira issue.',
       'اسحب البطاقات إلى عمود بالفأرة (أو استخدم ▶ / ⏸ / ✓)، و↗ يفتح المصدر، و＋ ينشئ بطاقة — في البوصلة وحدها أو في تريلو أو كمهمة Jira.'],

    /* ---- Kompass-Kino (Tugenden, Zitat, Muster, Lob) --------------------- */
    'Kompass': ['Compass', 'البوصلة'],
    'TUGEND DES TAGES': ['VIRTUE OF THE DAY', 'فضيلة اليوم'],
    'ZUM NACHDENKEN': ['FOOD FOR THOUGHT', 'للتأمّل'],
    'MUSTER DES TAGES': ['PATTERN OF THE DAY', 'نمط اليوم'],
    'CODE-ANSICHT': ['CODE VIEW', 'عرض الشيفرة'],
    'ANERKENNUNG': ['RECOGNITION', 'تقدير'],
    'Ordnung': ['Order', 'النظام'],
    'Pünktlichkeit': ['Punctuality', 'الالتزام بالمواعيد'],
    'Fleiß': ['Diligence', 'الاجتهاد'],
    'Beharrlichkeit': ['Perseverance', 'المثابرة'],
    'Zuverlässigkeit': ['Reliability', 'الموثوقية'],
    'Mäßigung': ['Moderation', 'الاعتدال'],
    'Tapferkeit': ['Courage', 'الشجاعة'],
    'Aufrichtigkeit': ['Truthfulness', 'الصدق'],
    'Jedes Ding an seinem Platz': ['Everything in its place', 'كل شيء في مكانه'],
    'Zugesagt ist zugesagt': ['A promise is a promise', 'الوعد وعد'],
    'Stetig, nicht hektisch': ['Steady, not frantic', 'ثبات لا اضطراب'],
    'Angefangenes zu Ende bringen': ['Finish what you started', 'أتمم ما بدأت'],
    'Andere können sich auf dich verlassen': ['Others can rely on you', 'يستطيع الآخرون الاعتماد عليك'],
    'Nicht mehr aufnehmen, als du trägst': ['Take on no more than you can carry', 'لا تحمل أكثر مما تطيق'],
    'Das Unangenehme zuerst': ['The unpleasant thing first', 'الأصعب أولًا'],
    'Das Board sagt die Wahrheit': ['The board tells the truth', 'اللوح يقول الحقيقة'],
    '{1} von {2} Tugenden': ['{1} of {2} virtues', '{1} من {2} فضائل'],
    '{1} von {2} Tugenden stehen heute.': ['{1} of {2} virtues hold today.', '{1} من {2} فضائل قائمة اليوم.'],
    '{1} von {2} Tugenden stehen': ['{1} of {2} virtues hold', '{1} من {2} فضائل قائمة'],
    'stehen. Als Nächstes:': ['hold. Next up:', 'قائمة. والتالي:'],
    'Jeder Tag bekommt sein eigenes Muster — gezeichnet aus dem Datum, nicht geladen. Es dreht sich weiter, solange du hinschaust.':
      ['Every day gets its own pattern — drawn from the date, not loaded. It keeps turning as long as you watch.',
       'لكل يوم نمطه — مرسوم من التاريخ لا محمَّل. ويستمر في الدوران ما دمت تنظر.'],
    'Klick zeichnet ein neues.': ['A click draws a new one.', 'نقرة ترسم نمطًا جديدًا.'],
    'dein Tag als Quelltext': ['your day as source code', 'يومك بصيغة شيفرة'],
    '{1} Karten fertig': ['{1} cards done', '{1} بطاقة منجزة'],
    'in den letzten sieben Tagen': ['in the last seven days', 'في الأيام السبعة الأخيرة'],
    '{1} fertig in sieben Tagen. Zwei kleine Karten heute reichen schon.':
      ['{1} done in seven days. Two small cards today would already do it.', '{1} منجزة خلال سبعة أيام. بطاقتان صغيرتان اليوم تكفيان.'],

    /* ---- Kennzahlen-Blüten ---------------------------------------------- */
    'Offene Tickets': ['Open tickets', 'التذاكر المفتوحة'],
    'Lead Time p50': ['Lead time p50', 'زمن الإنجاز p50'],
    'Mit AI gearbeitet': ['Worked with AI', 'عمل مع الذكاء الاصطناعي'],
    'Prompts an Claude': ['Prompts to Claude', 'طلبات إلى كلود'],
    'Tickets fertig': ['Tickets done', 'تذاكر منجزة'],
    'Umsatz Monat': ['Revenue this month', 'إيراد الشهر'],
    'Energie heute': ['Energy today', 'الطاقة اليوم'],
    'Freie Stunden heute': ['Free hours today', 'ساعات فارغة اليوم'],
    'Seiten mit Störung': ['Sites with an outage', 'مواقع بها عطل'],
    'Zertifikat läuft noch': ['Certificate still valid', 'الشهادة سارية'],
    'Älteste Sicherung': ['Oldest backup', 'أقدم نسخة احتياطية'],
    'E-Mails geschrieben': ['Emails written', 'رسائل مكتوبة'],
    'Wartet auf Antwort': ['Waiting for a reply', 'بانتظار ردّ'],
    'Offene Web-Meldungen': ['Open web reports', 'بلاغات موقع مفتوحة'],
    'offene Web-Meldungen': ['open web reports', 'بلاغات موقع مفتوحة'],
    'offene Tickets': ['open tickets', 'تذاكر مفتوحة'],
    'offene Tickets (alle Projekte)': ['open tickets (all projects)', 'تذاكر مفتوحة (كل المشاريع)'],
    'offene Schritte': ['open steps', 'خطوات مفتوحة'],
    'Aufrufe projekt.example': ['Page views projekt.example', 'زيارات projekt.example'],
    'Aufrufe Kontext 1': ['Page views Kontext 1', 'زيارات الفريق أرتيستس'],
    'Aufrufe gestern': ['Views yesterday', 'زيارات أمس'],
    /* Traffic-Zeile im Zahlen-Blick (trafficZeile()). suche() zerlegt sie an ` · `,
       an der Klammer und am führenden Emoji — deshalb reichen diese Bausteine.
       Vorzeichen dreimal, weil die Zeile ein ASCII-Minus schreibt und andere
       Stellen ein typografisches. */
    'noch kein Snapshot': ['no snapshot yet', 'لا توجد لقطة بعد'],
    'Projekt {1} gestern': ['Projekt {1} yesterday', 'فايكونتا {1} أمس'],
    'Team {1} am {2}.': ['Team {1} on {2}.', 'الفريق {1} في {2}.'],
    '-{1} % ggü. Ø {2} T': ['-{1} % vs. Ø {2} d', '-{1} % مقابل متوسط {2} يومًا'],
    '−{1} % ggü. Ø {2} T': ['−{1} % vs. Ø {2} d', '−{1} % مقابل متوسط {2} يومًا'],
    '+{1} % ggü. Ø {2} T': ['+{1} % vs. Ø {2} d', '+{1} % مقابل متوسط {2} يومًا'],
    'Tage in Folge ': ['days in a row ', 'أيام متتالية '],
    'am Nordstern': ['at the north star', 'عند نجم الشمال'],
    'im Mittel': ['mid-range', 'في المتوسط'],
    'unter Plan': ['below plan', 'دون الخطة'],
    'noch kein Vergleichswert': ['no comparison value yet', 'لا قيمة للمقارنة بعد'],
    'kein Zielband gesetzt': ['no target band set', 'لم يُحدَّد نطاق هدف'],
    'blasse Blüte = kein Zielband hinterlegt': ['a pale flower = no target band set', 'زهرة باهتة = لا نطاق هدف'],
    'golden = Nordstern erreicht': ['golden = north star reached', 'ذهبي = بلغتَ نجم الشمال'],
    '{1} Kennzahlen gemessen · {2} ohne Zielband': ['{1} metrics measured · {2} without a target band', '{1} مؤشرًا مقيسًا · {2} دون نطاق هدف'],
    '{1} Kennzahlen mit Wert, davon {2} mit Zielband': ['{1} metrics with a value, {2} of them with a target band', '{1} مؤشرًا له قيمة، منها {2} بنطاق هدف'],
    'wechselt durch {1} Kennzahlen ·': ['cycling through {1} metrics ·', 'يتنقّل بين {1} مؤشرًا ·'],
    'anhalten': ['pause', 'إيقاف'],
    'nächste': ['next', 'التالي'],
    'Fokus wählen': ['Choose focus', 'اختر التركيز'],
    'Nächste drei (Taste W)': ['Next three (key W)', 'الثلاثة التالية (المفتاح W)'],
    'Beim aktuellen Trio stehen bleiben': ['Stay on the current three', 'ابقَ على الثلاثة الحالية'],
    'Oben angeheftet': ['Pinned at the top', 'مثبّت في الأعلى'],
    'Der Compass wechselt gerade durch alles, was einen Wert hat. Klick auf eine Kennzahl heftet sie fest (max. 3).':
      ['The Compass is cycling through everything that has a value. Click a metric to pin it (max. 3).',
       'تتنقّل البوصلة بين كل ما له قيمة. انقر مؤشرًا لتثبيته (3 كحدّ أقصى).'],
    'Vortragen': ['Read aloud', 'اقرأ بصوت'],
    'Neu': ['New', 'جديد'],
    'Besprechen': ['Discuss', 'ناقش'],
    'Coach trägt die Summary vor (Sprachausgabe)': ['Coach reads the summary aloud (speech output)', 'يقرأ مدرّب الملخّص بصوت مسموع'],
    'Neu formulieren lassen': ['Ask for a rewrite', 'اطلب صياغة جديدة'],
    'Im Chat mit Coach weiterdenken': ['Think it through with Coach in the chat', 'واصل التفكير مع مدرّب في المحادثة'],
    'Coach · Management-Summary': ['Coach · management summary', 'مدرّب · ملخّص إداري'],
    'Coach ist offline — starte john-server.cmd, dann kommt die Summary hier hin.':
      ['Coach is offline — start john-server.cmd and the summary will appear here.', 'مدرّب غير متصل — شغّل john-server.cmd ليظهر الملخّص هنا.'],
    'gestern': ['yesterday', 'أمس'],
    'Ziel': ['Target', 'الهدف'],
    'manuell (Monatswert eintragen — es ist keine Buchhaltung angebunden)': ['manual (enter the monthly figure — no accounting system is connected)', 'يدوي (أدخل قيمة الشهر — لا نظام محاسبة مربوط)'],
    'manuell (1–10, deine eigene Einschätzung — das misst dir niemand)': ['manual (1–10, your own estimate — nobody measures this for you)', 'يدوي (1–10، تقديرك الخاص — لا أحد يقيسه لك)'],
    'manuell (Zahl eintragen — was du schreibst, zählt dir niemand)': ['manual (enter a number — nobody counts what you write)', 'يدوي (أدخل رقمًا — لا أحد يحصي ما تكتب)'],
    'Rhythmus (lokal)': ['Rhythm (local)', 'الإيقاع (محلّي)'],
    'Rhythmus (lokal) · kein Zielband (wächst immer)': ['Rhythm (local) · no target band (always grows)', 'الإيقاع (محلّي) · لا نطاق هدف (ينمو دائمًا)'],

    /* ---- Level & Abzeichen ---------------------------------------------- */
    'Beobachter': ['Observer', 'مُراقب'],
    'Analyst': ['Analyst', 'محلّل'],
    'Navigator': ['Navigator', 'ملّاح'],
    'Stratege': ['Strategist', 'استراتيجي'],
    'Kapitän': ['Captain', 'قبطان'],
    'Leuchtturm': ['Lighthouse', 'منارة'],
    'Level {1} · {2}': ['Level {1} · {2}', 'المستوى {1} · {2}'],
    'Noch {1} XP bis „{2}“': ['{1} XP to go until “{2}”', '{1} نقطة حتى «{2}»'],
    'Höchste Stufe erreicht': ['Top level reached', 'بلغت أعلى مرتبة'],
    'Fragen beantwortet': ['questions answered', 'أسئلة مُجابة'],
    'Frühstarter': ['Early bird', 'المبكّر'],
    'Woche durch': ['Week done', 'أسبوع كامل'],
    'Wochenstarter': ['Week starter', 'مفتتح الأسبوع'],
    'Reviewer': ['Reviewer', 'مُراجع'],
    'Antwortgeber': ['Answerer', 'مُجيب'],
    'Zahlenmensch': ['Numbers person', 'صاحب الأرقام'],
    'Feierabend': ['Clocking off', 'نهاية الدوام'],
    'In Bewegung': ['On the move', 'في حركة'],
    'Tüftler': ['Tinkerer', 'مُجرّب'],
    'KI-Macher': ['AI doer', 'صانع بالذكاء الاصطناعي'],
    '{1} Morgenchecks gemacht': ['{1} morning checks done', '{1} فحوص صباحية'],
    '{1} Tage in Folge angefangen': ['started {1} days in a row', 'بدأتَ {1} أيام متتالية'],
    '{1}× montags die Woche gesetzt': ['set the week on {1} Mondays', 'حدّدت الأسبوع {1} مرات يوم الاثنين'],
    '{1}× freitags zurückgeschaut': ['looked back on {1} Fridays', 'راجعت {1} مرات يوم الجمعة'],
    '{1} Rückfragen beantwortet': ['{1} questions answered', 'أجبت عن {1} أسئلة'],
    '{1}× in die Kennzahlen geschaut': ['looked at the metrics {1} times', 'نظرت في المؤشرات {1} مرات'],
    '{1} Abendchecks — Tag bewusst geschlossen': ['{1} evening checks — the day deliberately closed', '{1} فحوص مسائية — أُغلق اليوم عن قصد'],
    '{1} Abende mit Sport oder echter Erholung': ['{1} evenings with exercise or real rest', '{1} أمسيات برياضة أو راحة حقيقية'],
    '{1} Abende am eigenen Projekt (z. B. KI-Master)': ['{1} evenings on your own project (e.g. AI mastery)', '{1} أمسيات على مشروعك (كإتقان الذكاء الاصطناعي)'],
    '{1} Tage praktisch mit Claude gearbeitet (≥ {2} aktive Minuten)': ['{1} days of hands-on work with Claude (≥ {2} active minutes)', '{1} أيام عمل عملي مع كلود (≥ {2} دقيقة نشطة)'],
    'Fortschritt sichern': ['Back up progress', 'حفظ التقدّم'],
    'Einspielen': ['Restore', 'استعادة'],
    'XP, Streak, Board-Zuordnung, Coach-Verlauf und Einstellungen als Text kopieren — z. B. um sie in den Live-Compass zu übernehmen':
      ['Copy XP, streak, board assignments, Coach history and settings as text — e.g. to move them into the live Compass',
       'انسخ النقاط والسلسلة وتوزيع اللوح وسجل مدرّب والإعدادات كنص — لنقلها إلى البوصلة المباشرة مثلًا'],
    'Kopierten Fortschritt hier einspielen (überschreibt den lokalen Stand)': ['Paste copied progress here (overwrites the local state)', 'الصق التقدّم المنسوخ هنا (يستبدل الحالة المحلّية)'],
    'Das war kein Compass-Export.': ['That was not a Compass export.', 'هذا ليس تصديرًا من البوصلة.'],

    /* ---- Coach ------------------------------------------------------------ */
    'Coach · Coach': ['Coach · coach', 'مدرّب · مدرّب'],
    'Coach — Coach & Sparringspartner': ['Coach — coach and sparring partner', 'مدرّب — مدرّب وشريك نقاش'],
    'Karriere-Coach · Claude Fable 5': ['Career coach · Claude Fable 5', 'مدرّب مهني · Claude Fable 5'],
    'Verbinde …': ['Connecting …', 'جارٍ الاتصال …'],
    'Senden': ['Send', 'إرسال'],
    'Schreib Coach … (Enter sendet, Shift+Enter = Zeile)': ['Write to Coach … (Enter sends, Shift+Enter for a new line)', 'اكتب إلى مدرّب … (Enter للإرسال، Shift+Enter لسطر جديد)'],
    'Heute?': ['Today?', 'اليوم؟'],
    'Pipeline': ['Pipeline', 'خط الفرص'],
    'Sparring': ['Sparring', 'نقاش'],
    'Ehrlich?': ['Honestly?', 'بصراحة؟'],
    'Was steht heute für mich an? Kurz und priorisiert.': ['What is on for me today? Short and prioritised.', 'ما الذي ينتظرني اليوم؟ باختصار وترتيب أولويات.'],
    'Pipeline-Check: Wo bin ich überfällig, was ist der nächste Schritt?': ['Pipeline check: where am I overdue, what is the next step?', 'فحص خط الفرص: أين تأخّرت، وما الخطوة التالية؟'],
    'Sparring: Ich will die Entscheidung von heute mit dir durchdenken.': ['Sparring: I want to think today’s decision through with you.', 'نقاش: أريد أن أفكّر معك في قرار اليوم.'],
    'Gib mir eine ehrliche Einschätzung: Was verschleppe ich gerade?': ['Give me an honest assessment: what am I putting off?', 'أعطني تقييمًا صادقًا: ما الذي أؤجّله؟'],
    'Coach will mit dir spielen': ['Coach wants to play', 'مدرّب يريد أن يلعب'],
    'Coach fordert dich heraus': ['Coach is challenging you', 'مدرّب يتحدّاك'],
    'Coach sieht ein Risiko': ['Coach sees a risk', 'مدرّب يرى خطرًا'],
    'Coach fasst dir die Lage zusammen': ['Coach sums up the situation for you', 'مدرّب يلخّص لك الوضع'],
    'Coach will besser mit dir arbeiten': ['Coach wants to work better with you', 'مدرّب يريد عملًا أفضل معك'],
    'ruft dich — du kommst, wenn du magst': ['is calling — come if you feel like it', 'يناديك — تعال إن شئت'],
    'Spielen': ['Play', 'العب'],
    'Fordern': ['Challenge', 'تحدَّ'],
    'Warnen': ['Warn', 'حذِّر'],
    'Briefen': ['Brief', 'أوجز'],
    'Zusammenarbeit': ['Collaboration', 'تعاون'],
    'Darauf eingehen': ['Take it up', 'استجب لذلك'],
    'Mit Coach besprechen': ['Discuss with Coach', 'ناقش مع مدرّب'],
    'Coach ist offline — starte john-server.cmd im Cockpit-Ordner (öffnet http://localhost:8787/dashboard.html).':
      ['Coach is offline — start john-server.cmd in the cockpit folder (opens http://localhost:8787/dashboard.html).',
       'مدرّب غير متصل — شغّل john-server.cmd في مجلّد القُمرة (يفتح http://localhost:8787/dashboard.html).'],

    /* ---- Server- und Statuszeilen ---------------------------------------- */
    'Coach-Server nicht erreichbar': ['Coach server not reachable', 'خادم مدرّب غير متاح'],
    'starten, dann ↻ Neu laden.': ['then reload with ↻.', 'ثم أعد التحميل بـ↻.'],
    'Kalender wird geladen …': ['Loading the calendar …', 'جارٍ تحميل التقويم …'],
    'keine Termine': ['no appointments', 'لا مواعيد'],
    'der Tag gehört dem Einen': ['the day belongs to the One Thing', 'اليوم للأمر الواحد'],
    'Termine heute': ['appointments today', 'مواعيد اليوم'],
    'kein weiterer Termin in den nächsten 7 Tagen': ['no further appointment in the next 7 days', 'لا موعد آخر خلال 7 أيام'],
    'läuft gerade:': ['happening now:', 'يجري الآن:'],
    'nächster Termin in': ['next appointment in', 'الموعد التالي بعد'],
    'frei zwischen': ['free between', 'فراغ بين'],
    'Daten-Refresh anstoßen': ['Trigger a data refresh', 'ابدأ تحديث البيانات'],
    'lädt …': ['loading …', 'جارٍ التحميل …'],
    'lade neu …': ['reloading …', 'جارٍ إعادة التحميل …'],
    'Hole das Board vom Team-Cockpit …': ['Fetching the board from the Team-Cockpit …', 'جارٍ جلب اللوح من قُمرة الفريق …'],
    'Der Datenstand ist leer — die Board-Datei ist da, sie enthält keinen einzigen Vorgang. Der stündliche Jira-Lauf liefert gerade nichts; das ist kein Ladeproblem.':
      ['The data file is empty — the board file loaded fine, it just holds no work items. The hourly Jira run is delivering nothing right now; this is not a loading problem.',
       'ملف البيانات فارغ — تم تحميل ملف اللوح لكنه لا يحتوي أي عنصر عمل. لا يجلب التشغيل الساعي من جيرا شيئاً حالياً؛ وهذه ليست مشكلة تحميل.'],
    'Hole Listen und Karten vom Coach-Server …': ['Fetching lists and cards from the Coach server …', 'جارٍ جلب القوائم والبطاقات من خادم مدرّب …'],
    'Noch keine Zusammenfassung. Sofort holen: „Claude, hol meine wichtigsten Slack-Nachrichten“.':
      ['No summary yet. To fetch one now: “Claude, get my most important Slack messages”.',
       'لا ملخّص بعد. لجلبه الآن: «كلود، أحضر أهم رسائل سلاك».'],
    'Der Feed kommt von facebook.com — beim Laden geht deine IP-Adresse an Meta. Deshalb erst auf deinen Klick.':
      ['The feed comes from facebook.com — loading it sends your IP address to Meta. That is why it waits for your click.',
       'يأتي المحتوى من facebook.com — وتحميله يرسل عنوانك إلى ميتا. لذلك ينتظر نقرتك.'],
    'Feed laden': ['Load the feed', 'تحميل المحتوى'],
    'Bei Facebook öffnen': ['Open on Facebook', 'فتح في فيسبوك'],
    'Weitere Konten verbinden: claude.ai → Einstellungen → Connectors (Gmail/Outlook) — muss die Nutzerin selbst autorisieren.':
      ['Connect more accounts: claude.ai → settings → connectors (Gmail/Outlook) — die Nutzerin has to authorise this himself.',
       'لربط حسابات أخرى: claude.ai ← الإعدادات ← الموصلات (Gmail/Outlook) — على المستخدِم منح الإذن بنفسه.'],

    /* ---- Bausteine zusammengesetzter Zeilen ------------------------------
       Diese Stücke stehen nie allein auf dem Bildschirm; suche() setzt aus
       ihnen die zusammengesetzten Beschriftungen und Kurzhilfen wieder
       zusammen (siehe TRENNER weiter unten).                                */
    'Kontext 1 öffnen': ['open Kontext 1', 'افتح الفريق أرتيستس'],
    'Projekt öffnen': ['open Projekt', 'افتح المشروع'],
    'Privat öffnen': ['open Private', 'افتح الشخصي'],
    'Finanzen & Sonstiges öffnen': ['open Finance & other', 'افتح المالية وغيرها'],
    'Endstufe': ['top level', 'أعلى مرتبة'],
    '{1} bis Analyst': ['{1} to Analyst', '{1} حتى المحلّل'],
    '{1} bis Navigator': ['{1} to Navigator', '{1} حتى الملّاح'],
    '{1} bis Stratege': ['{1} to Strategist', '{1} حتى الاستراتيجي'],
    '{1} bis Kapitän': ['{1} to Captain', '{1} حتى القبطان'],
    '{1} bis Leuchtturm': ['{1} to Lighthouse', '{1} حتى المنارة'],
    'gut': ['good', 'جيد'],
    'Ziel ≤ {1}': ['Target ≤ {1}', 'الهدف ≤ {1}'],
    'Ziel ≥ {1}': ['Target ≥ {1}', 'الهدف ≥ {1}'],
    'Jira live': ['Jira live', 'Jira مباشر'],
    'sonst kennzahlen-data.js': ['otherwise kennzahlen-data.js', 'وإلا kennzahlen-data.js'],
    'Jira live (eigene Tickets, 14 T)': ['Jira live (own tickets, 14 d)', 'Jira مباشر (تذاكرك، 14 يومًا)'],
    'sonst Kunde-Team (aggregated.json)': ['otherwise the Kunde team (aggregated.json)', 'وإلا فريق العميل (aggregated.json)'],
    'Kunde aggregated.json (live)': ['Kunde aggregated.json (live)', 'Kunde aggregated.json (مباشر)'],
    'Claude Code (live über john-server)': ['Claude Code (live via the Coach server)', 'Claude Code (مباشر عبر خادم مدرّب)'],
    'Claude Code (~/.claude/projects, live über john-server)': ['Claude Code (~/.claude/projects, live via the Coach server)', 'Claude Code (~/.claude/projects، مباشر عبر خادم مدرّب)'],
    'Google-Kalender über die geheime iCal-Adresse (live über john-server)':
      ['Google Calendar via the secret iCal address (live via the Coach server)', 'تقويم غوغل عبر عنوان iCal السرّي (مباشر عبر خادم مدرّب)'],
    'Seiten-Wächter (live über john-server, GET /api/wacht)': ['Site watchdog (live via the Coach server, GET /api/wacht)', 'حارس المواقع (مباشر عبر خادم مدرّب، GET /api/wacht)'],
    'Seiten-Wächter (TLS-Handschlag je Host, knappstes Zertifikat)': ['Site watchdog (TLS handshake per host, the closest expiry)', 'حارس المواقع (مصافحة TLS لكل مضيف، أقرب شهادة انتهاءً)'],
    'Sicherungs-Wächter (live über john-server, GET /api/sicherung)': ['Backup watchdog (live via the Coach server, GET /api/sicherung)', 'حارس النسخ الاحتياطي (مباشر عبر خادم مدرّب، GET /api/sicherung)'],
    'Tages-Snapshot (kennzahlen-data.js)': ['Daily snapshot (kennzahlen-data.js)', 'لقطة يومية (kennzahlen-data.js)'],
    'Tages-Snapshot (kennzahlen-data.js, eigener Zähler seit 17.08.)': ['Daily snapshot (kennzahlen-data.js, own counter since 17 Aug)', 'لقطة يومية (kennzahlen-data.js، عدّاد خاص منذ 17 آب)'],
    'kein Zielband gesetzt': ['no target band set', 'لم يُحدَّد نطاق هدف'],
    'Nordstern erreicht': ['north star reached', 'بلغتَ نجم الشمال'],
    'WIP {1}/{2}': ['WIP {1}/{2}', 'العمل الجاري {1}/{2}'],
    'das Board ist geordnet.': ['the board is in order.', 'اللوح مرتّب.'],
    'Nichts ist überfällig.': ['Nothing is overdue.', 'لا شيء متأخّر.'],
    'Nichts liegt lange.': ['Nothing has been sitting long.', 'لا شيء بقي طويلًا.'],
    'Das Eine für heute fehlt. Der Morgencheck setzt es in fünf Minuten.':
      ['Today’s One Thing is missing. The morning check sets it in five minutes.', 'الأمر الواحد لليوم غائب. يحدّده فحص الصباح في خمس دقائق.'],
    'Heute noch nichts bewegt. Ein Board, das nicht gepflegt wird, belügt dich.':
      ['Nothing moved yet today. A board that is not kept up lies to you.', 'لم يتحرّك شيء اليوم. واللوح غير المُعتنى به يكذب عليك.'],
    '{1} Karten warten. Einmal nachfassen ist billiger als fünfmal hinschauen.':
      ['{1} cards are waiting. Following up once is cheaper than checking five times.', '{1} بطاقة تنتظر. متابعة واحدة أرخص من خمس نظرات.'],
    '{1} Karten in „Bereit“. Auf drei eindampfen — der Rest bleibt Backlog.':
      ['{1} cards in “ready”. Boil it down to three — the rest stays in the backlog.', '{1} بطاقة في «جاهز». اختصرها إلى ثلاث — والباقي في قائمة الانتظار.'],

    /* ---- Kontext-Kacheln ------------------------------------------------- */
    'Anthropic-Zertifikate': ['Anthropic certificates', 'شهادات أنثروبيك'],
    'Aufrufe /f · {1}': ['Views /f · {1}', 'زيارات /f · {1}'],
    'Mitglieder · +{1} in {2} T': ['members · +{1} in {2} d', 'أعضاء · +{1} خلال {2} يومًا'],
    'aktive Mitglieder · {1} T': ['active members · {1} d', 'أعضاء نشطون · {1} يومًا'],
    'vorzubereiten': ['to prepare', 'للتحضير'],
    'Tage Streak': ['day streak', 'أيام متتالية'],
    'Tage bis Monatsende · Rechnungsreview': ['days to month end · invoice review', 'أيام حتى نهاية الشهر · مراجعة الفواتير'],
    'dringend (Sicherheit)': ['urgent (security)', 'عاجل (أمني)'],
    'Tage bis Prüfung': ['days to the exam', 'أيام حتى الامتحان'],
    'Tickets durch ({1} Wo)': ['tickets done ({1} wks)', 'تذاكر منجزة ({1} أسابيع)'],
    'min diese Woche': ['min this week', 'دقيقة هذا الأسبوع'],

    /* ---- Legenden und Statuszeilen --------------------------------------- */
    'Morgencheck {1}× · Abendcheck {2}× (🏃 {3} · 🎓 {4}) · Wochenstart {5}× · Rückschau {6}× · Karten fertig {7}':
      ['Morning check {1}× · evening check {2}× (🏃 {3} · 🎓 {4}) · week start {5}× · review {6}× · cards done {7}',
       'فحص الصباح {1}× · فحص المساء {2}× (🏃 {3} · 🎓 {4}) · بداية الأسبوع {5}× · المراجعة {6}× · بطاقات منجزة {7}'],
    'Arbeit mit Claude: john-server nicht erreichbar — Transkripte werden dann nicht gezählt':
      ['Working with Claude: the Coach server is not reachable — transcripts are not counted then',
       'العمل مع كلود: خادم مدرّب غير متاح — لا تُحتسب السجلات حينها'],
    'Quellen: Claude-Code-Transkripte (live) · Jira aus kennzahlen-data.js · Kunde-Cockpit live · Kalender – · Traffic aus dem Tages-Snapshot · Umsatz und Energie trägst du selbst ein · Rhythmus lokal. „–“ heißt: nicht gemessen, nicht erfunden.':
      ['Sources: Claude Code transcripts (live) · Jira from kennzahlen-data.js · Kunde cockpit live · calendar – · traffic from the daily snapshot · revenue and energy you enter yourself · rhythm local. “–” means: not measured, not invented.',
       'المصادر: سجلات Claude Code (مباشرة) · Jira من kennzahlen-data.js · قُمرة العميل مباشرة · التقويم – · الزيارات من اللقطة اليومية · الإيراد والطاقة تُدخلهما بنفسك · الإيقاع محلّي. و«–» تعني: غير مقيس، لا مُختلق.'],
    'starten, dann ↻ Neu laden. Ohne Server prüft niemand deine Seiten; grün heißt hier also nichts.':
      ['then reload with ↻. Without the server nobody checks your sites, so green means nothing here.',
       'ثم أعد التحميل بـ↻. فبدون الخادم لا أحد يفحص مواقعك، وبالتالي لا يعني اللون الأخضر شيئًا هنا.'],
    'starten, dann ↻ Neu laden. Ohne Server prüft niemand, ob deine Arbeit doppelt liegt; leer heißt hier also nichts.':
      ['then reload with ↻. Without the server nobody checks whether your work is backed up, so empty means nothing here.',
       'ثم أعد التحميل بـ↻. فبدون الخادم لا أحد يتحقّق من وجود نسخة ثانية لعملك، وبالتالي لا يعني الفراغ شيئًا هنا.'],
    'starten, dann ↻ Neu laden. Ohne Server zählt niemand nach; leer heißt hier also nichts.':
      ['then reload with ↻. Without the server nobody counts, so empty means nothing here.',
       'ثم أعد التحميل بـ↻. فبدون الخادم لا أحد يُحصي، وبالتالي لا يعني الفراغ شيئًا هنا.'],

    /* ---- Unterseite „Kennzahlen“ (kennzahlen.html) ----------------------- */
    'Kennzahlen · Projekt & Team': ['Metrics · Projekt & Team', 'المؤشرات · المشروع والفريق'],
    'Flow Compass': ['Flow Compass', 'بوصلة التدفّق'],
    'Live-Quellen neu laden': ['Reload live sources', 'إعادة تحميل المصادر المباشرة'],
    '7 Tage': ['7 days', '7 أيام'],
    '28 Tage': ['28 days', '28 يومًا'],
    'Quellen: –': ['Sources: –', 'المصادر: –'],
    'Stand': ['as of', 'حتى'],
    'Stand:': ['As of:', 'الحالة:'],
    'Datenstand:': ['Data as of:', 'حالة البيانات:'],
    'Live-Quelle:': ['Live source:', 'المصدر المباشر:'],
    'Rückruf-Anfragen (Team)': ['Call-back requests (Team)', 'طلبات معاودة الاتصال (الفريق)'],
    'Melden': ['Report', 'إبلاغ'],
    'Bug / Feedback melden — landet als Jira-Ticket': ['Report a bug or feedback — becomes a Jira ticket', 'أبلغ عن خلل أو ملاحظة — تصبح تذكرة Jira'],
    'Landet als Ticket im aktuellen Sprint (Projekt VA, Board 73).': ['Lands as a ticket in the current sprint (project VA, board 73).', 'تُسجَّل كتذكرة في السبرنت الحالي (مشروع VA، لوح 73).'],
    'Wer soll das übernehmen?': ['Who should take this on?', 'من يتولّى هذا؟'],
    'Claude löst das': ['Claude sorts it out', 'كلود يتكفّل بها'],
    'Wird in der nächsten Session abgearbeitet': ['Will be worked through in the next session', 'ستُنفَّذ في الجلسة القادمة'],
    'Mir vorlegen': ['Bring it to me', 'اعرضها عليّ'],
    'Braucht deine Entscheidung': ['Needs your decision', 'تحتاج قرارك'],
    'Bug': ['Bug', 'خلل'],
    'Idee': ['Idea', 'فكرة'],
    'Inhalt': ['Content', 'محتوى'],
    'Kennzahl fehlt': ['Missing metric', 'مؤشر ناقص'],
    'Dieses Cockpit': ['This cockpit', 'هذه القُمرة'],
    'Team-Website (/f/)': ['Team website (/f/)', 'موقع الفريق (/f/)'],
    'Was ist los?': ['What is going on?', 'ما الأمر؟'],
    'Ticket anlegen': ['Create ticket', 'إنشاء تذكرة'],
    'Kurz und konkret — was hast du gesehen, was hast du erwartet?':
      ['Short and concrete — what did you see, what did you expect?', 'باختصار ووضوح — ماذا رأيت، وماذا توقّعت؟'],
    'Bitte kurz beschreiben, worum es geht.': ['Please describe briefly what this is about.', 'صِف بإيجاز ما الأمر.'],
    'Lege Ticket an …': ['Creating the ticket …', 'جارٍ إنشاء التذكرة …'],
    'Angelegt:': ['Created:', 'أُنشئت:'],
    'im aktuellen Sprint': ['in the current sprint', 'في السبرنت الحالي'],
    'im Backlog': ['in the backlog', 'في قائمة الانتظار'],
    'Claude arbeitet es in der nächsten Session ab.': ['Claude will work through it in the next session.', 'سيعالجها كلود في الجلسة القادمة.'],
    'liegt zur Klärung bei dir.': ['is with you to clarify.', 'بانتظار توضيحك.'],
    'Angekommen — das Relay hat es zwischengespeichert und legt das Ticket nach, sobald es die Jira-Zugangsdaten hat.':
      ['Received — the relay has buffered it and will create the ticket as soon as it has the Jira credentials.',
       'وصلت — خزّنها المُرحِّل مؤقتًا وسينشئ التذكرة فور توفّر بيانات الدخول إلى Jira.'],
    'Keine Verbindung zum Relay. Sag mir den Punkt einfach im Chat — ich lege das Ticket dann direkt an.':
      ['No connection to the relay. Just tell me the point in the chat — then I will create the ticket directly.',
       'لا اتصال بالمُرحِّل. أخبرني بالأمر في المحادثة — وسأنشئ التذكرة مباشرة.'],
    '% ggü. Vorperiode': ['% vs. previous period', '% مقابل الفترة السابقة'],
    '% ggü. Ø 7 Tage': ['% vs. Ø 7 days', '% مقابل متوسط 7 أيام'],
    'Seitenaufrufe ·': ['Page views ·', 'مشاهدات الصفحة ·'],
    'Seitenaufrufe · Snapshot': ['Page views · snapshot', 'مشاهدات الصفحة · لقطة'],
    'von Claude gezogen · Live-Endpunkt gerade nicht erreichbar': ['pulled by Claude · live endpoint not reachable right now', 'سحبها كلود · نقطة النهاية المباشرة غير متاحة الآن'],
    'offene Bugs / Feedback': ['open bugs / feedback', 'أخطاء وملاحظات مفتوحة'],
    'Aufrufe am': ['Views on', 'زيارات في'],
    'Traffic-Verlauf': ['Traffic over time', 'مسار الزيارات'],
    'Live-Fetch nicht erreichbar': ['live fetch not reachable', 'الجلب المباشر غير متاح'],
    'Der Browser konnte die Zähler-Endpunkte gerade nicht laden (Origin/Netz). Gezeigt wird der von Claude dokumentierte Tagesstand aus kennzahlen-data.js.':
      ['The browser could not load the counter endpoints just now (origin/network). What you see is the daily figure documented by Claude in kennzahlen-data.js.',
       'تعذّر على المتصفّح تحميل نقاط العدّ الآن (المصدر/الشبكة). المعروض هو الحالة اليومية التي وثّقها كلود في kennzahlen-data.js.'],
    'Noch keine Messdaten.': ['No measurements yet.', 'لا بيانات قياس بعد.'],
    'Sobald ein Zähler-Endpunkt antwortet, steht hier der Tagesverlauf — mit Trend gegen die Vorperiode.':
      ['As soon as a counter endpoint answers, the daily curve appears here — with a trend against the previous period.',
       'فور استجابة نقطة عدّ، سيظهر هنا المسار اليومي — مع اتجاهه مقابل الفترة السابقة.'],
    'Was dafür fehlt, steht rechts unter „Datenquellen“.': ['What is missing for that is listed under “Data sources”.', 'ما ينقص لذلك مذكور تحت «مصادر البيانات».'],
    'Beliebteste Seiten': ['Most popular pages', 'أكثر الصفحات زيارة'],
    'Zählt noch niemand pro Seite.': ['Nobody counts per page yet.', 'لا أحد يَعُدّ لكل صفحة بعد.'],
    'Der Projekt-Zähler summiert bisher nur pro Tag, die Produktseite misst gar nicht.':
      ['The Projekt counter only totals per day so far, and the Team site does not measure at all.',
       'عدّاد المشروع يجمع يوميًا فقط حتى الآن، وموقع الفريق لا يقيس إطلاقًا.'],
    'Beide Erweiterungen sind gebaut — sie brauchen einen Upload bzw. einen Push.':
      ['Both extensions are built — they need an upload or a push.', 'كلا الإضافتين جاهزتان — تحتاجان إلى رفع أو دفع.'],
    'Anmeldungen & Anfragen': ['Sign-ups & enquiries', 'التسجيلات والاستفسارات'],
    'Projekt — Mitglieder:': ['Projekt — members:', 'المشروع — الأعضاء:'],
    'Team — Rückruf-Anfragen:': ['Team — call-back requests:', 'الفريق — طلبات معاودة الاتصال:'],
    'Gemeldete Bugs & Feedback': ['Reported bugs & feedback', 'الأخطاء والملاحظات المُبلَّغة'],
    '{1} offen · Label web-pro-bene': ['{1} open · label web-pro-bene', '{1} مفتوح · الوسم web-pro-bene'],
    'Max {1}/Tag': ['Max {1}/day', 'الحد الأقصى {1}/يوم'],
    'Für dieses Segment ist nichts offen.': ['Nothing is open for this segment.', 'لا شيء مفتوح في هذا القسم.'],
    'Neues melden': ['Report something new', 'أبلغ عن جديد'],
    'Alle in Jira': ['All in Jira', 'الكل في Jira'],
    'wartet auf Deploy': ['waiting for deployment', 'بانتظار النشر'],
    'Datenquellen': ['Data sources', 'مصادر البيانات'],
    'ehrlich, nicht geschönt': ['honest, not polished', 'صادقة لا مُجمَّلة'],
    'Jira-Zahlen zieht Claude (Browser kommt wegen Auth+CORS nicht ran) — „Claude, aktualisiere die Kennzahlen“.':
      ['Claude pulls the Jira figures (the browser cannot reach them because of auth + CORS) — “Claude, update the metrics”.',
       'كلود يسحب أرقام Jira (المتصفّح لا يصل إليها بسبب المصادقة وCORS) — «كلود، حدّث المؤشرات».'],
    'Dein Durchsatz': ['Your throughput', 'إنتاجيتك'],
    'erledigt · 14 Tage': ['done · 14 days', 'منجز · 14 يومًا'],
    'fließt in den Freitags-Review im Cockpit ein.': ['feeds into the Friday review in the cockpit.', 'يصبّ في مراجعة الجمعة داخل القُمرة.'],
    'Web-Analytics-Cockpit · lokal ·': ['Web analytics cockpit · local ·', 'قُمرة تحليلات الويب · محلّية ·'],

    /* ---- Unterseite „Kundenlage“ (kundenlage.html) ----------------------- */
    'Kundenlage · Flow Compass': ['Client situation · Flow Compass', 'وضع العملاء · بوصلة التدفّق'],
    'Compass': ['Compass', 'البوصلة'],
    'Produktrückmeldungen': ['Product feedback', 'ملاحظات على المنتج'],
    'kundenlage-data.js fehlt.': ['kundenlage-data.js is missing.', 'الملف kundenlage-data.js مفقود.'],
    'Erste Welle,': ['First wave,', 'الموجة الأولى،'],
    'alle als Testplatz.': ['all as pilot seats.', 'جميعها كمقاعد تجريبية.'],
    'Wartet auf Freigabe': ['Waiting for release', 'بانتظار الإفراج'],
    'Zahlungseingang prüfen, dann im Vorgang auf „Ready to work".': ['Check the incoming payment, then move the issue to “Ready to work”.', 'تحقّق من وصول الدفعة، ثم انقل المهمة إلى «Ready to work».'],
    'In Einrichtung': ['Being set up', 'قيد الإعداد'],
    'Freigegeben, Startmail raus, Instanz entsteht.': ['Released, welcome email sent, the instance is being built.', 'أُفرج عنها، وأُرسلت رسالة البدء، والنسخة قيد الإنشاء.'],
    'Übergeben, läuft allein.': ['Handed over, running on its own.', 'سُلّمت وتعمل وحدها.'],
    'noch offen': ['still open', 'ما زال مفتوحًا'],
    'registriert': ['registered', 'مسجَّل'],
    'noch nicht registriert': ['not registered yet', 'غير مسجَّل بعد'],
    'Schritten · als Nächstes:': ['steps · up next:', 'خطوات · التالي:'],
    'zugesagt bis': ['promised by', 'موعود حتى'],
    'Startmail raus': ['welcome email sent', 'أُرسلت رسالة البدء'],
    'Noch keine Registrierung.': ['No registration yet.', 'لا تسجيل بعد.'],
    'Aus dem Demo-Review abgearbeitet.': ['Worked through from the demo review.', 'مُعالَجة من مراجعة العرض التجريبي.'],
    'aus Instanzen': ['from instances', 'من النسخ'],
    'Über den Feedback-Knopf eingegangen — Projekt': ['Came in via the feedback button — project', 'وردت عبر زر الملاحظات — مشروع'],
    'Wahrheit ist Jira:': ['Jira is the truth:', 'المرجع هو Jira:'],
    'Rückmeldungen:': ['feedback:', 'ملاحظات:'],
    'Aktualisieren mit „Claude, aktualisiere die Kundenlage".': ['Update with “Claude, refresh the client situation”.', 'حدّثها بـ«كلود، حدّث وضع العملاء».'],

    /* ---- Verkaufs-Demo (31.08.2026, Rückfrage `compass-demo-sprachen`) --------
       Der Produkt-Build formuliert für die Demo eigene Sätze (aus „Coach“ wird „Coach“,
       aus „Rückfragen von Claude“ „Offene Entscheidungen“) und bringt eigene Beispieldaten
       mit. Diese Texte treffen keinen Schlüssel der Quelle — hier stehen sie. In ihren
       eigenem Compass laufen sie ins Leere, das ist der Preis für eine Demo, die in allen
       drei Sprachen etwas taugt. Lücken finden: compassSprache.luecken() IN DER DEMO.  */
    'Du siehst den Compass mit erfundenen Daten einer selbstständigen Beraterin —': ['You are looking at the Compass filled with the invented data of a freelance consultant —', 'أنت ترى البوصلة ببيانات متخيَّلة لمستشارة مستقلّة —'],
    'eine:': ['one:', 'واحدة:'],
    ': Karten ziehen, Morgencheck starten, Kontexte wechseln. Dein Fortschritt bleibt in diesem Browser und stört niemanden. In deiner eigenen Instanz stehen hier deine Quellen.': [': drag cards, start the morning check, switch contexts. Your progress stays in this browser and disturbs no one. In your own instance these are your sources.', ': اسحب البطاقات، وابدأ فحص الصباح، وبدّل السياقات. يبقى تقدّمك في هذا المتصفّح ولا يزعج أحدًا. وفي نسختك الخاصة تظهر هنا مصادرك أنت.'],
    '↺ Demo zurücksetzen': ['↺ Reset demo', '↺ إعادة ضبط العرض'],
    'Demo · aufgezeichneter Beispiel-Dialog — in deiner Instanz antwortet hier Claude live mit deinen Daten.': ['Demo · recorded sample dialogue — in your instance Claude answers here live, with your data.', 'عرض تجريبي · حوار نموذجي مسجَّل — في نسختك يجيب كلود هنا مباشرةً ببياناتك.'],
    'In deiner Instanz steht hier dein Tag: Termine, freie Fenster und der nächste Übergang. Die Demo läuft bewusst ohne Server.': ['In your instance this is your day: appointments, free windows and the next handover. The demo deliberately runs without a server.', 'في نسختك يظهر هنا يومك: المواعيد والنوافذ الحرة والانتقال التالي. ويعمل العرض التجريبي بلا خادم عن قصد.'],
    'Dein persönlicher Bereich. Name und Zugangswort hast du bei der Einrichtung bekommen — die Anmeldung gilt 30 Tage auf diesem Gerät.': ['Your personal area. You received the name and passphrase during setup — the login is valid for 30 days on this device.', 'مساحتك الشخصية. تلقّيت الاسم وكلمة الدخول عند الإعداد — ويبقى تسجيل الدخول صالحًا 30 يومًا على هذا الجهاز.'],
    'Einrichtung öffnen': ['Open setup', 'فتح الإعداد'],
    '— die Reihenfolge bestimmen die Kundinnen und Kunden. Sag uns, was dir fehlt.': ['— the customers set the order. Tell us what you are missing.', '— العملاء هم من يحدّدون الترتيب. أخبرنا بما ينقصك.'],
    'Der Compass sammelt dort ein, wo deine Arbeit ohnehin liegt — er ersetzt kein Werkzeug. Was du ziehst, wird zurückgeschrieben; was nicht geht, sagt er dir ehrlich.': ['The Compass collects where your work already lives — it replaces no tool. What you drag is written back; what does not work it tells you honestly.', 'تجمع البوصلة من حيث يوجد عملك أصلًا — وهي لا تحلّ محلّ أي أداة. ما تسحبه يُكتب مرة أخرى إلى مصدره، وما لا ينجح تخبرك به بصراحة.'],
    'Konten verbindest du im Einrichtungs-Assistenten (⚙️) — der Compass liest nur, was du freigibst.': ['You connect accounts in the setup assistant (⚙️) — the Compass reads only what you release.', 'تربط الحسابات في مساعد الإعداد (⚙️) — ولا تقرأ البوصلة إلا ما تسمح به.'],
    'Fortschritt, Board und Einstellungen als Datei sichern und auf einem anderen Rechner einspielen. Keine Cloud-Pflicht.': ['Save progress, board and settings as a file and load them on another computer. No cloud required.', 'احفظ التقدّم واللوحة والإعدادات كملف وأعد تحميلها على حاسوب آخر. لا حاجة إلى السحابة.'],
    'Compass-Server nicht erreichbar —': ['Compass server not reachable —', 'تعذّر الوصول إلى خادم البوصلة —'],
    'Was als Nächstes kommt': ['What comes next', 'ما القادم'],
    '5 nutzbar · 9 auf der Karte': ['5 usable · 9 on the roadmap', '5 جاهزة للاستخدام · 9 على الخارطة'],
    'alles ist bedienbar': ['everything is operable', 'كل شيء قابل للاستخدام'],
    '🔌 Was lässt sich anbinden?': ['🔌 What can be connected?', '🔌 ما الذي يمكن ربطه؟'],
    '🔔 Konnektor wünschen': ['🔔 Request a connector', '🔔 اطلب رابطًا'],
    '🎫 Meine Vorgänge': ['🎫 My issues', '🎫 مهامي'],
    'Deine Vorhaben und ihre nächsten Schritte': ['Your initiatives and their next steps', 'مبادراتك وخطواتها التالية'],
    'Kennzahlen, dein Board, Vorgänge, Kompass, Coach': ['Metrics, your board, issues, compass, coach', 'المؤشرات ولوحتك والمهام والبوصلة والمدرّب'],
    'Level, Badges, Arbeit mit dem Coach, offene Entscheidungen': ['Level, badges, work with the coach, open decisions', 'المستوى والأوسمة والعمل مع المدرّب والقرارات المفتوحة'],
    'Der Sprung von deinem persönlichen Fluss (FL1) auf Team, Koordination (FL2) und Strategie (FL3) — dieselbe Arbeit, eine Ebene höher.': ['The step from your personal flow (FL1) up to team and coordination (FL2) and strategy (FL3) — the same work, one level higher.', 'الانتقال من تدفّقك الشخصي (FL1) إلى الفريق والتنسيق (FL2) والاستراتيجية (FL3) — العمل نفسه، لكن بمستوى أعلى.'],
    'Coach — dein Sparringspartner': ['Coach — your sparring partner', 'المدرّب — شريكك في التفكير'],
    '🤖 Dein Coach übernimmt': ['🤖 Your coach takes over', '🤖 مدرّبك يتولّى الأمر'],
    '🤵 Mit dem Coach besprechen': ['🤵 Discuss with the coach', '🤵 ناقشه مع المدرّب'],
    '✨ Mit dem Coach als Nächstes': ['✨ Next with the coach', '✨ التالي مع المدرّب'],
    'Im Chat mit dem Coach weiterdenken': ['Keep thinking in the chat with the coach', 'واصل التفكير في المحادثة مع المدرّب'],
    'Der Coach trägt die Summary vor (Sprachausgabe)': ['The coach reads the summary aloud (speech output)', 'يقرأ المدرّب الملخّص بصوت مسموع'],
    'Ein Sparringspartner, der deine Board-Metriken kennt: was blockiert, was zu lange liegt, was heute das Eine ist.': ['A sparring partner who knows your board metrics: what is blocked, what has been lying around too long, what the one thing is today.', 'شريك تفكير يعرف مؤشرات لوحتك: ما المعطَّل، وما الذي طال بقاؤه، وما الشيء الواحد لهذا اليوم.'],
    '✨ Coach: Agenda und Auswertung der Retro': ['✨ Coach: agenda and evaluation of the retro', '✨ المدرّب: جدول الأعمال وتقييم المراجعة'],
    '✨ Coach: Nachfass-Text, Quartalsübersicht': ['✨ Coach: follow-up text, quarterly overview', '✨ المدرّب: نص المتابعة ونظرة الربع'],
    '✨ Coach: Rohentwurf und Gegenlesen': ['✨ Coach: first draft and proofreading', '✨ المدرّب: مسوّدة أولى ومراجعة'],
    '🤖 Arbeit mit dem Coach: john-server nicht erreichbar — Transkripte werden dann nicht gezählt': ['🤖 Work with the coach: server not reachable — transcripts are then not counted', '🤖 العمل مع المدرّب: تعذّر الوصول إلى الخادم — لن تُحتسب المحادثات عندئذٍ'],
    'Noch keine Zusammenfassung. Sofort holen: „Coach, fass mir die wichtigsten Nachrichten zusammen“.': ['No summary yet. Get one right away: “Coach, summarise the most important messages for me”.', 'لا ملخّص بعد. اطلبه فورًا: «أيها المدرّب، لخّص لي أهم الرسائل».'],
    'Du liest und schickst — der Entwurf steht schon': ['You read and send — the draft is already there', 'أنت تقرأ وترسل — المسوّدة جاهزة'],
    'Dein Hebel heute ist das Workshop-Konzept für Kunde Nord — zwei Stunden am Stück, bevor der Tag zerfasert. Danach das Angebot „Team-Kickoff“ anrufen und die blockierten Zugänge (PROJ-91) anstupsen: Beides wartet länger, als ihm guttut.': ['Your lever today is the workshop concept for Kunde Nord — two hours in one go, before the day frays. After that, call about the “Team-Kickoff” offer and nudge the blocked access (PROJ-91): both have been waiting longer than is good for them.', 'رافعتك اليوم هي مفهوم الورشة لعميل الشمال — ساعتان متّصلتان قبل أن يتشتّت اليوم. ثم اتصل بشأن عرض «انطلاقة الفريق» وذكّر بصلاحيات الدخول المعطَّلة (PROJ-91): كلاهما ينتظر أطول ممّا ينبغي.'],
    'Nichts brennt gerade. Genau dann lohnt der Blick nach vorn: Was wird in zwei Wochen ein Problem, wenn du heute nichts tust?': ['Nothing is on fire right now. That is exactly when looking ahead pays off: what becomes a problem in two weeks if you do nothing today?', 'لا شيء مشتعل الآن. وهنا بالذات يستحقّ النظر إلى الأمام: ما الذي سيصبح مشكلة بعد أسبوعين إن لم تفعل شيئًا اليوم؟'],
    'Fünf Karten liegen in „In Arbeit“, dein Limit ist drei. Was tun?': ['Five cards are in “In progress”, your limit is three. What now?', 'خمس بطاقات في «قيد العمل»، وحدّك ثلاث. ماذا تفعل؟'],
    'Über dem WIP-Limit wird nichts schneller fertig, es dauert nur alles länger. Zwei Karten zurück nach „Bereit“ wäre die ehrliche Antwort.': ['Above the WIP limit nothing gets finished faster, everything just takes longer. Two cards back to “Ready” would be the honest answer.', 'فوق حدّ العمل الجاري لا ينتهي شيء أسرع، بل يطول كل شيء فحسب. إعادة بطاقتين إلى «جاهز» هي الجواب الصادق.'],
    'Liegt seit Montag ohne Antwort. Je länger es offen steht, desto kälter wird es. Zwei Minuten Entscheidung sparen dir zwei Wochen Grübeln.': ['It has been unanswered since Monday. The longer it stays open, the colder it gets. Two minutes of decision save you two weeks of brooding.', 'بلا ردّ منذ الاثنين. وكلما طال بقاؤه مفتوحًا بَرَد أكثر. دقيقتان من الحسم توفّران عليك أسبوعين من التفكير.'],
    'Das Eine für heute. Zwei Stunden am Stück, danach raus damit — perfekt wird es beim Kunden, nicht am Schreibtisch.': ['The one thing for today. Two hours in one go, then out with it — it becomes perfect at the client, not at the desk.', 'الشيء الواحد لهذا اليوم. ساعتان متّصلتان ثم أرسله — فهو يكتمل عند العميل لا على المكتب.'],
    '🎯 Workshop-Konzept für Kunde Nord fertigstellen': ['🎯 Finish the workshop concept for Kunde Nord', '🎯 إنهاء مفهوم الورشة لعميل الشمال'],
    'Workshop-Konzept für Kunde Nord fertigstellen': ['Finish the workshop concept for Kunde Nord', 'إنهاء مفهوم الورشة لعميل الشمال'],
    'Das Eine für heute — zwei Stunden am Stück, danach raus damit': ['The one thing for today — two hours in one go, then out with it', 'الشيء الواحد لهذا اليوم — ساعتان متّصلتان ثم أرسله'],
    'Das Eine für heute — zwei Stunden am Stück, dana…': ['The one thing for today — two hours in one go, t…', 'الشيء الواحد لهذا اليوم — ساعتان متّصلتان ثم…'],
    '📞 Rückruf Angebot „Team-Kickoff“': ['📞 Call back about the “Team-Kickoff” offer', '📞 معاودة الاتصال بشأن عرض «انطلاقة الفريق»'],
    'Rückruf Angebot „Team-Kickoff“': ['Call back about the “Team-Kickoff” offer', 'معاودة الاتصال بشأن عرض «انطلاقة الفريق»'],
    'Angebot „Team-Kickoff“ — nachfassen oder abschließen?': ['“Team-Kickoff” offer — follow up or close it?', 'عرض «انطلاقة الفريق» — أتتابعه أم تُغلقه؟'],
    'Liegt seit Montag ohne Antwort. Heute anrufen oder bewusst schließen.': ['Unanswered since Monday. Call today or close it deliberately.', 'بلا ردّ منذ الاثنين. اتصل اليوم أو أغلقه عن قصد.'],
    'Liegt seit Montag. Entweder heute oder bewusst absagen': ['Sitting since Monday. Either today or deliberately decline', 'قائم منذ الاثنين. إمّا اليوم أو اعتذر عن قصد'],
    'Liegt seit Montag. Entweder heute oder bewusst a…': ['Sitting since Monday. Either today or deliberate…', 'قائم منذ الاثنين. إمّا اليوم أو اعتذر عن…'],
    'Zugänge für das Kunden-Board': ['Access for the client board', 'صلاحيات الدخول إلى لوحة العميل'],
    'Zugänge für das Kunden-Board klären': ['Sort out access for the client board', 'توضيح صلاحيات الدخول إلى لوحة العميل'],
    'PROJ-91 · Zugänge für das Kunden-Board': ['PROJ-91 · Access for the client board', 'PROJ-91 · صلاحيات الدخول إلى لوحة العميل'],
    'PROJ-91 · Zugänge für das Kunden-Board — in der Quelle öffnen ↗': ['PROJ-91 · Access for the client board — open in the source ↗', 'PROJ-91 · صلاحيات الدخول إلى لوحة العميل — افتحها في المصدر ↗'],
    'PROJ-91 blockiert seit 9 Tagen — die IT der Kundin braucht einen Anstupser.': ['PROJ-91 has been blocked for 9 days — the client’s IT needs a nudge.', 'PROJ-91 معطَّلة منذ 9 أيام — قسم تقنية المعلومات لدى العميلة يحتاج إلى تذكير.'],
    'Wartet auf IT der Kundin — seit 9 Tagen': ['Waiting for the client’s IT — for 9 days', 'بانتظار تقنية المعلومات لدى العميلة — منذ 9 أيام'],
    'Wartet auf Rückmeldung — seit 3 Tagen': ['Waiting for a reply — for 3 days', 'بانتظار ردّ — منذ 3 أيام'],
    'PROJ-88 · Retrospektive Team Nord vorbereiten — in der Quelle öffnen ↗': ['PROJ-88 · Prepare the Team Nord retrospective — open in the source ↗', 'PROJ-88 · التحضير لمراجعة فريق الشمال — افتحها في المصدر ↗'],
    'OPS-137 · Angebotsvorlage v3 gegenlesen lassen — in der Quelle öffnen ↗': ['OPS-137 · Have offer template v3 proofread — open in the source ↗', 'OPS-137 · مراجعة قالب العروض الإصدار 3 — افتحه في المصدر ↗'],
    'OPS-142 · Onboarding-Strecke für Neukunden dokumentieren': ['OPS-142 · Document the onboarding path for new clients', 'OPS-142 · توثيق مسار الانضمام للعملاء الجدد'],
    'OPS-142 · Onboarding-Strecke für Neukunden dokumentieren — in der Quelle öffnen ↗': ['OPS-142 · Document the onboarding path for new clients — open in the source ↗', 'OPS-142 · توثيق مسار الانضمام للعملاء الجدد — افتحه في المصدر ↗'],
    'Onboarding-Strecke für Neukunden dokumentieren': ['Document the onboarding path for new clients', 'توثيق مسار الانضمام للعملاء الجدد'],
    'OPS-142, fällig Freitag. Liegt seit 6 Tagen in Arbeit — zu lange für diese Größe.': ['OPS-142, due Friday. In progress for 6 days — too long for this size.', 'OPS-142، تستحقّ الجمعة. قيد العمل منذ 6 أيام — وقت أطول ممّا يستحقّه حجمها.'],
    'Fällig Freitag · liegt seit 6 Tagen in Arbeit': ['Due Friday · in progress for 6 days', 'تستحقّ الجمعة · قيد العمل منذ 6 أيام'],
    'Rückfrage · Kunde Nord': ['Query · Kunde Nord', 'استفسار · عميل الشمال'],
    'Nächster Termin: Workshop „Flight Level 1“ — Konzept fehlt noch': ['Next appointment: “Flight Level 1” workshop — the concept is still missing', 'الموعد التالي: ورشة «Flight Level 1» — لا يزال المفهوم ناقصًا'],
    'Steuerungsrunde mit der Bereichsleitung': ['Steering meeting with the division management', 'جلسة توجيه مع إدارة القطاع'],
    'Termin nächste Woche Dienstag': ['Appointment next Tuesday', 'موعد الثلاثاء المقبل'],
    'Verlängerung ab Quartalswechsel': ['Extension from the start of the next quarter', 'التمديد اعتبارًا من بداية الربع الجديد'],
    'Verlängerung ab Quartalswechsel: Entscheidung liegt bei der Bereichsleitung': ['Extension from the start of the next quarter: the decision rests with the division management', 'التمديد اعتبارًا من بداية الربع الجديد: القرار بيد إدارة القطاع'],
    'Team-Begleitung über 12 Wochen, Flight Level 1 im Aufbau.': ['Team support over 12 weeks, Flight Level 1 being set up.', 'مرافقة الفريق على مدى 12 أسبوعًا، وFlight Level 1 قيد الإنشاء.'],
    'Team misst seit vier Wochen Durchsatz; erste Kurve sieht stabil aus': ['The team has been measuring throughput for four weeks; the first curve looks stable', 'يقيس الفريق الإنتاجية منذ أربعة أسابيع، ويبدو المنحنى الأول مستقرًّا'],
    'Board-Metriken kommen wöchentlich automatisch': ['Board metrics arrive automatically every week', 'تصل مؤشرات اللوحة تلقائيًا كل أسبوع'],
    'Board aufräumen': ['Tidy up the board', 'ترتيب اللوحة'],
    'Karten älter als 14 Tage sammeln und zur Entscheidung vorlegen': ['Collect cards older than 14 days and put them up for decision', 'اجمع البطاقات الأقدم من 14 يومًا واعرضها للبتّ فيها'],
    'Zwei Rechnungen über 30 Tage offen — freundlich nachfassen': ['Two invoices open for more than 30 days — follow up politely', 'فاتورتان مفتوحتان لأكثر من 30 يومًا — تابِعْهما بلطف'],
    'Belege des Quartals sortieren (30 Minuten, einmal im Quartal)': ['Sort the quarter’s receipts (30 minutes, once a quarter)', 'رتّب إيصالات الربع (30 دقيقة، مرة كل ربع)'],
    'Auslastung des Monats gegen Ziel prüfen': ['Check the month’s utilisation against target', 'قارن استغلال الشهر بالهدف'],
    'Argumente und Zahlen sammeln': ['Collect arguments and figures', 'اجمع الحجج والأرقام'],
    'Antwortentwürfe für Angebotsanfragen': ['Draft replies for offer requests', 'مسوّدات ردود على طلبات العروض'],
    'Newsletter: nächste Ausgabe braucht ein Thema': ['Newsletter: the next issue needs a topic', 'النشرة البريدية: العدد القادم يحتاج إلى موضوع'],
    'Newsletter-Auswertung läuft automatisch': ['Newsletter analysis runs automatically', 'يجري تحليل النشرة تلقائيًا'],
    'Artikel im Entwurf': ['Article in draft', 'مقال في المسوّدة'],
    'Blog, Newsletter, Netzwerk — der langsame, verlässliche Kanal.': ['Blog, newsletter, network — the slow, reliable channel.', 'مدوّنة ونشرة وشبكة علاقات — القناة البطيئة الموثوقة.'],
    'Vier Netzwerk-Gespräche für den Monat eingetragen': ['Four networking conversations booked for the month', 'أُدرجت أربع محادثات تشبيك لهذا الشهر'],
    'Gespräche geplant': ['conversations planned', 'محادثات مخطَّطة'],
    'Termine im Monat': ['appointments this month', 'مواعيد هذا الشهر'],
    'Tage überfällig': ['days overdue', 'أيام متأخّرة'],
    'täglich': ['daily', 'يوميًا'],
    '0 fertig in 7 Tagen · WIP 1/3. Weiter so — eins nach dem anderen.': ['0 finished in 7 days · WIP 1/3. Keep it up — one thing at a time.', '0 مُنجزة خلال 7 أيام · العمل الجاري 1/3. واصِل — واحدًا تلو الآخر.'],
    'Nicht mehr aufnehmen, als du trägst — Bereit-Spalte mit 5 Karten schlank.': ['Do not take on more than you can carry — the Ready column is lean with 5 cards.', 'لا تحمل أكثر ممّا تطيق — عمود «جاهز» رشيق بخمس بطاقات.'],
    'Andere können sich auf dich verlassen — Nur 4 Karten warten auf andere.': ['Others can rely on you — only 4 cards are waiting on others.', 'يستطيع الآخرون الاعتماد عليك — أربع بطاقات فقط تنتظر غيرك.'],
    '12 Leitsätze im Umlauf — wechselt täglich, Klick blättert weiter': ['12 guiding principles in rotation — changes daily, click to move on', '12 مبدأً في التداول — تتبدّل يوميًا، وانقر للانتقال'],
    '„Ein System, das du nicht pflegst, pflegt dich nicht zurück.“': ['“A system you do not maintain will not maintain you.”', '«النظام الذي لا تعتني به لن يعتني بك.»'],
    '„Werde, der du bist.“': ['“Become who you are.”', '«كن من أنت.»'],
    'Friedrich Nietzsche · Die fröhliche Wissenschaft, 1882': ['Friedrich Nietzsche · The Gay Science, 1882', 'فريدريش نيتشه · العلم المرح، 1882'],
    'Tüftler — 5 Abende am eigenen Projekt (0/5)': ['Tinkerer — 5 evenings on your own project (0/5)', 'مثابر — 5 أمسيات على مشروعك الخاص (0/5)'],
    'E-Mail und Team-Chat': ['Email and team chat', 'البريد الإلكتروني ومحادثة الفريق'],
    'Gemerkte Nachrichten werden Karten; der Morgencheck fasst zusammen, was du wirklich lesen musst.': ['Saved messages become cards; the morning check summarises what you really have to read.', 'تتحوّل الرسائل المحفوظة إلى بطاقات، ويلخّص فحص الصباح ما يلزمك قراءته فعلًا.'],
    'Aufgaben aus To Do und markierte Mails als Karten, ohne dass dein Postfach zur Aufgabenliste wird.': ['Tasks from To Do and flagged mail as cards, without turning your inbox into a task list.', 'مهام من قائمة المهام والرسائل المُعلَّمة كبطاقات، دون أن يتحوّل بريدك إلى قائمة مهام.'],
    'Karten in beide Richtungen: Listen erscheinen auf Mein Board, Ziehen schreibt nach Trello zurück (verschieben, archivieren, Fälligkeit setzen).': ['Cards both ways: lists appear on My Board, dragging writes back to Trello (move, archive, set a due date).', 'بطاقات في الاتجاهين: تظهر القوائم على لوحتي، والسحب يُكتب مرة أخرى إلى Trello (نقل، أرشفة، تحديد موعد).'],
    'Deine offenen Vorgänge landen im Board, ein Statuswechsel geht als Übergang zurück nach Jira. Neue Vorgänge legst du direkt aus dem Compass an.': ['Your open issues land on the board, a status change goes back to Jira as a transition. You create new issues straight from the Compass.', 'تصل مهامك المفتوحة إلى اللوحة، ويعود تغيير الحالة إلى Jira كانتقال. وتنشئ المهام الجديدة من البوصلة مباشرةً.'],
    'Issues und Zyklen für Produktteams, gleiche Zwei-Wege-Logik wie bei Jira.': ['Issues and cycles for product teams, the same two-way logic as with Jira.', 'مهام ودورات لفرق المنتج، بالمنطق ثنائي الاتجاه نفسه كما مع Jira.'],
    'Datenbank-Einträge als Karten, Status schreibt der Compass zurück.': ['Database entries as cards, the Compass writes the status back.', 'مُدخلات قاعدة البيانات كبطاقات، وتكتب البوصلة الحالة مرة أخرى.'],
    'Aufgaben und Fälligkeiten in Mein Board, Abschluss zurück nach Asana.': ['Tasks and due dates on My Board, completion back to Asana.', 'المهام والمواعيد على لوحتي، والإنجاز يعود إلى Asana.'],
    'Zugewiesene Issues und offene Reviews — die stille Arbeit, die sonst in keinem Board steht.': ['Assigned issues and open reviews — the quiet work that appears on no board otherwise.', 'المهام المسندة والمراجعات المفتوحة — العمل الهادئ الذي لا يظهر على أي لوحة.'],
    'Echte Zeit gegen geschätzten Aufwand: woran der Tag wirklich vergangen ist.': ['Real time against estimated effort: where the day actually went.', 'الوقت الفعلي مقابل الجهد المقدَّر: أين ذهب اليوم حقًّا.'],
    'Die Termine des Tages neben dem Einen — und ein ehrlicher Blick, ob der Kalender zu deinem Fokus passt.': ['The day’s appointments next to the one thing — and an honest look at whether the calendar fits your focus.', 'مواعيد اليوم إلى جانب الشيء الواحد — ونظرة صادقة إن كان التقويم يناسب تركيزك.'],
    'Heute als Link-Karte geführt — das funktioniert, schreibt aber nichts zurück. Eine echte Anbindung steht auf der Karte.': ['Kept as a link card today — that works, but writes nothing back. A real connection is on the roadmap.', 'تُدار اليوم كبطاقة رابط — وهذا يعمل لكنه لا يكتب شيئًا مرة أخرى. والربط الحقيقي مدرَج على الخارطة.'],
    '. Miro/Confluence sind nicht angebunden — solche Aufgaben als Compass- oder Trello-Karte mit Link führen. Wechsel mit': ['. Miro/Confluence are not connected — keep such tasks as a Compass or Trello card with a link. Switch with', '. Miro وConfluence غير مربوطين — أدِر هذه المهام كبطاقة في البوصلة أو Trello مع رابط. بدّل بـ'],
    'Format wählen, Daten aus dem Board ziehen': ['Choose a format, pull the data from the board', 'اختر صيغة واسحب البيانات من اللوحة'],
    'offene Vorgänge': ['open issues', 'مهام مفتوحة'],
    'offene Vorgänge — Kunden öffnen': ['open issues — open clients', 'مهام مفتوحة — افتح العملاء'],
    'offene Schritte — Kunden öffnen': ['open steps — open clients', 'خطوات مفتوحة — افتح العملاء'],
    'offene Schritte — Finanzen öffnen': ['open steps — open finances', 'خطوات مفتوحة — افتح المالية'],
    'offene Schritte — Wachstum öffnen': ['open steps — open growth', 'خطوات مفتوحة — افتح النمو'],
    'vorzubereiten — Kunden öffnen': ['to prepare — open clients', 'للتحضير — افتح العملاء'],
    'vorzubereiten — Finanzen öffnen': ['to prepare — open finances', 'للتحضير — افتح المالية'],
    'vorzubereiten — Wachstum öffnen': ['to prepare — open growth', 'للتحضير — افتح النمو'],
    'Tage Streak — Kunden öffnen': ['day streak — open clients', 'أيام متتالية — افتح العملاء'],
    'Tage Streak — Finanzen öffnen': ['day streak — open finances', 'أيام متتالية — افتح المالية'],
    'Tage Streak — Wachstum öffnen': ['day streak — open growth', 'أيام متتالية — افتح النمو'],
    'Karten auf Mein Board — Kunden öffnen': ['cards on My Board — open clients', 'بطاقات على لوحتي — افتح العملاء'],
    'Karten auf Mein Board — Finanzen öffnen': ['cards on My Board — open finances', 'بطاقات على لوحتي — افتح المالية'],
    'Karten auf Mein Board — Wachstum öffnen': ['cards on My Board — open growth', 'بطاقات على لوحتي — افتح النمو'],
    'Quelle: dein Vorgangssystem · Stand: Demo-Datenstand': ['Source: your issue system · as of: demo data', 'المصدر: نظام مهامك · بتاريخ: بيانات العرض التجريبي'],
    'Jira live (Zugangsdaten im Compass-Server) · sonst kennzahlen-data.js': ['Jira live (credentials in the Compass server) · otherwise kennzahlen-data.js', 'Jira مباشرةً (بيانات الدخول في خادم البوصلة) · وإلا kennzahlen-data.js'],
    'Routinen-Wächter (live über john-server, GET /api/routinen)': ['Routine watch (live via the server, GET /api/routinen)', 'مراقب الروتينات (مباشرةً عبر الخادم، GET /api/routinen)'],
    'Analytics-Plugin auf projekt.example (live über john-server, GET /api/vaikuntha) · ohne Server der Tages-Snapshot aus kennzahlen-data.js': ['Analytics plugin on the project site (live via the server, GET /api/vaikuntha) · without a server the daily snapshot from kennzahlen-data.js', 'إضافة التحليلات على موقع المشروع (مباشرةً عبر الخادم، GET /api/vaikuntha) · وبلا خادم تُستخدم اللقطة اليومية من kennzahlen-data.js'],
    'Analytics-Plugin auf projekt.example (live über john-server)': ['Analytics plugin on the project site (live via the server)', 'إضافة التحليلات على موقع المشروع (مباشرةً عبر الخادم)'],
    'Analytics-Plugin auf projekt.example (live über john-server) — Kontakte, die Mitglied geworden sind': ['Analytics plugin on the project site (live via the server) — contacts who became members', 'إضافة التحليلات على موقع المشروع (مباشرةً عبر الخادم) — جهات الاتصال التي صارت أعضاء'],
    'Quellen: Aktivitätsprotokoll deines Rechners (live) · Jira aus kennzahlen-data.js · Kalender – · Traffic aus dem Tages-Snapshot · Umsatz und Energie trägst du selbst ein · Rhythmus lokal. „–“ heißt: nicht gemessen, nicht erfunden.': ['Sources: your computer’s activity log (live) · Jira from kennzahlen-data.js · calendar – · traffic from the daily snapshot · revenue and energy you enter yourself · rhythm local. “–” means: not measured, not invented.', 'المصادر: سجلّ نشاط حاسوبك (مباشرةً) · Jira من kennzahlen-data.js · التقويم – · الزيارات من اللقطة اليومية · الإيرادات والطاقة تُدخلها بنفسك · الإيقاع محليًّا. و«–» تعني: لم يُقَس، ولم يُختلق.'],
    '. Zeilen ohne erkennbaren Kontext bleiben überall stehen. Aus deinen Entscheidungen im Morgencheck (siehe rhythmus-data.js → entschieden); Fertiges fliegt raus, Neues kommt per Tages-Update.': ['. Rows without a recognisable context stay everywhere. From your decisions in the morning check (see rhythmus-data.js → entschieden); finished items drop out, new ones arrive with the daily update.', '. تبقى الأسطر بلا سياق واضح ظاهرةً في كل مكان. مصدرها قراراتك في فحص الصباح (انظر rhythmus-data.js ← entschieden)؛ ويخرج المنجَز ويأتي الجديد مع التحديث اليومي.'],

    'Hallo, ich bin dein Coach. Ich sehe dein Board, deine Kennzahlen und deine offenen Entscheidungen — frag mich etwas oder tipp auf einen Vorschlag.': ['Hello, I am your coach. I can see your board, your metrics and your open decisions — ask me something or tap a suggestion.', 'مرحبًا، أنا مدرّبك. أرى لوحتك ومؤشراتك وقراراتك المفتوحة — اسألني شيئًا أو انقر على اقتراح.'],
    'Was ist heute das Eine?': ['What is the one thing today?', 'ما الشيء الواحد اليوم؟'],
    'Kurz und priorisiert — so, wie dein Board gerade steht: 1. 🎯 Workshop-Konzept Kunde Nord — dein Eines für heute. Zwei Stunden am Stück, bevor der Tag zerfasert. Perfekt wird es beim Kunden, nicht am Schreibtisch. 2. 📞 Angebot „Team-Kickoff“ nachfassen — liegt seit Montag. Ein Anruf: gewinnen oder bewusst schließen, beides ist besser als offen halten. 3. 🔓 PROJ-91 anstupsen — die Zugänge blockieren seit 9 Tagen. Das ist keine Arbeit, das ist eine Zwei-Zeilen-Mail. Alles andere hat bis morgen Zeit. Dein WIP-Limit steht bei 3 — halt es ein.': ['Short and prioritised — the way your board stands right now: 1. 🎯 Workshop concept for Kunde Nord — your one thing today. Two hours in one go, before the day frays. It becomes perfect at the client, not at the desk. 2. 📞 Follow up the “Team-Kickoff” offer — it has been sitting since Monday. One call: win it or close it deliberately, either beats keeping it open. 3. 🔓 Nudge PROJ-91 — the access has been blocked for 9 days. That is not work, that is a two-line email. Everything else can wait until tomorrow. Your WIP limit is 3 — keep to it.', 'باختصار وبترتيب الأولوية، كما تبدو لوحتك الآن: 1. 🎯 مفهوم الورشة لعميل الشمال — شيئك الواحد اليوم. ساعتان متّصلتان قبل أن يتشتّت اليوم، فهو يكتمل عند العميل لا على المكتب. 2. 📞 متابعة عرض «انطلاقة الفريق» — قائم منذ الاثنين. اتصال واحد: اربحه أو أغلقه عن قصد، وكلاهما أفضل من إبقائه مفتوحًا. 3. 🔓 ذكِّر بـPROJ-91 — الصلاحيات معطَّلة منذ 9 أيام. هذا ليس عملًا، بل رسالة من سطرين. وما عداه يحتمل الانتظار إلى الغد. حدّ عملك الجاري 3 — التزم به.'],
    '📋 Für den Coach kopieren': ['📋 Copy for the coach', '📋 انسخه للمدرّب'],
    '⚠ Noch nicht übergeben: kein Compass-Server eingerichtet — ich versuche es weiter und melde mich hier, sobald sie angekommen ist. Du musst nichts tun und nichts neu laden.': ['⚠ Not handed over yet: no Compass server set up — I keep trying and will say so here as soon as it has arrived. You do not have to do anything, and nothing needs reloading.', '⚠ لم يُسلَّم بعد: لا خادم بوصلة مُعدّ — سأواصل المحاولة وسأخبرك هنا حالما يصل. لا يلزمك فعل شيء ولا إعادة تحميل.'],
    '20 Minuten für dein eigenes Ding?': ['20 minutes for your own thing?', '20 دقيقة لشأنك الخاص؟'],
    'Kleine Schritte zählen doppelt: eine Lektion, ein Kapitel, ein Experiment.': ['Small steps count double: one lesson, one chapter, one experiment.', 'الخطوات الصغيرة تُحتسب مرّتين: درس واحد، فصل واحد، تجربة واحدة.'],
    'Ein Satz. Der Morgencheck legt ihn dir morgen vor.': ['One sentence. The morning check will put it in front of you tomorrow.', 'جملة واحدة. سيعرضها عليك فحص الصباح غدًا.'],
    '3️⃣ Die drei Brocken der Woche?': ['3️⃣ The three big rocks of the week?', '3️⃣ الصخور الثلاث الكبرى لهذا الأسبوع؟'],
    '🤖 Welchen Brocken übernimmt dein Coach?': ['🤖 Which rock does your coach take on?', '🤖 أي صخرة يتولّاها مدرّبك؟'],
    'Er arbeitet ihn über die Woche ab und meldet sich mit Rückfragen.': ['He works through it over the week and comes back with questions.', 'يعالجها على مدار الأسبوع ويعود إليك بأسئلة.'],
    '⏰ Überfällig': ['⏰ Overdue', '⏰ متأخّر'],
    '⏱ Älteste Karte in Arbeit': ['⏱ Oldest card in progress', '⏱ أقدم بطاقة قيد العمل'],
    'Erkenntnis in einem Satz — z. B. „WIP war 5, zwei Karten hingen“': ['One sentence of insight — e.g. “WIP was 5, two cards were stuck”', 'خلاصة في جملة — مثلًا «العمل الجاري كان 5 وعلقت بطاقتان»'],
    '🧭 Fluss der Woche: Wie viele Karten sind fertig geworden — und lag etwas zu lange in Arbeit?': ['🧭 Flow of the week: how many cards were finished — and did anything sit in progress for too long?', '🧭 تدفّق الأسبوع: كم بطاقة أُنجزت — وهل بقي شيء قيد العمل مدة أطول من اللازم؟'],
    'Die Zahlen stehen auf Mein Board. Nimm sie ernst, auch wenn sie klein sind.': ['The numbers are on My Board. Take them seriously, even when they are small.', 'الأرقام على لوحتي. خذها على محمل الجدّ، حتى لو كانت صغيرة.'],
    'Ergebnisse, keine Aktivitäten.': ['Results, not activities.', 'نتائج لا أنشطة.'],
    'Ein volles Backlog ist kein Plan, sondern ein Archiv.': ['A full backlog is not a plan, it is an archive.', 'قائمة أعمال ممتلئة ليست خطة، بل أرشيف.'],
    'Bewusst schließen': ['Close it deliberately', 'أغلقه عن قصد'],
    'Limit bewusst erhöhen': ['Deliberately raise the limit', 'ارفع الحدّ عن قصد'],
    'Zwei zurücklegen': ['Put two back', 'أعِد اثنتين'],
    'Nächste Woche': ['Next week', 'الأسبوع المقبل'],
    '. Die Demo läuft bewusst ohne Server.': ['. The demo deliberately runs without a server.', '. يعمل العرض التجريبي بلا خادم عن قصد.'],
    'In deiner Instanz stehen hier die Karten aus': ['In your instance these are the cards from', 'في نسختك تظهر هنا البطاقات من'],
    'im Trello öffnen ↗': ['open in Trello ↗', 'افتحها في Trello ↗'],
    'Trello 1:1: dein Board, dein Tempo. Konto · live über den Compass-Server (Trello-API, 60 s Cache) · Klick auf eine Karte öffnet sie in Trello. Wechsel mit': ['Trello 1:1: your board, your pace. Account · live via the Compass server (Trello API, 60 s cache) · clicking a card opens it in Trello. Switch with', 'Trello كما هو: لوحتك وإيقاعك. الحساب · مباشرةً عبر خادم البوصلة (واجهة Trello، تخزين مؤقّت 60 ثانية) · والنقر على بطاقة يفتحها في Trello. بدّل بـ'],

    'Offene Entscheidungen': ['Open decisions', 'قرارات مفتوحة'],
    '🎫 Arbeit & Werkzeuge': ['🎫 Work & tools', '🎫 العمل والأدوات'],
    'Meldungen, verbundene Werkzeuge': ['Reports, connected tools', 'البلاغات والأدوات المرتبطة'],
    '🎮 Rhythmus & Coach': ['🎮 Rhythm & coach', '🎮 الإيقاع والمدرّب'],
    'Rhythmus gehalten': ['Rhythm kept', 'حافظتَ على الإيقاع'],
    'Morgenchecks': ['morning checks', 'فحوص الصباح'],
    'kein Zielband': ['no target band', 'لا نطاق هدف'],
    '+ Karte': ['+ Card', '+ بطاقة'],
    '⌂ lokal': ['⌂ local', '⌂ محلّي'],
    '🏅 Das hast du geschafft.': ['🏅 This is what you achieved.', '🏅 هذا ما أنجزته.'],
    '{1} Karten in anderen Kontexten': ['{1} cards in other contexts', '{1} بطاقات في سياقات أخرى'],
    'monatlich': ['monthly', 'شهريًا'],
    'Mein privates Board: Compass-Server offline': ['My private board: Compass server offline', 'لوحتي الخاصة: خادم البوصلة غير متصل'],
    'Team-Board: Compass-Server offline': ['Team board: Compass server offline', 'لوحة الفريق: خادم البوصلة غير متصل'],
    'Angebotsvorlage v3 gegenlesen lassen': ['Have offer template v3 proofread', 'مراجعة قالب العروض الإصدار 3'],
    'Retrospektive Team Nord vorbereiten': ['Prepare the Team Nord retrospective', 'التحضير لمراجعة فريق الشمال'],
    'Retrospektive Team Nord': ['Team Nord retrospective', 'مراجعة فريق الشمال'],
    'Retro-Agenda Team Nord': ['Team Nord retro agenda', 'جدول مراجعة فريق الشمال'],
    'Workshop-Konzept Kunde Nord': ['Workshop concept for Kunde Nord', 'مفهوم الورشة لعميل الشمال'],
    'Angebot „Team-Kickoff“ nachfassen': ['Follow up the “Team-Kickoff” offer', 'متابعة عرض «انطلاقة الفريق»'],
    'Workshop „Flight Level 1“': ['“Flight Level 1” workshop', 'ورشة «Flight Level 1»'],

    'Einrichten lassen': ['Get it set up', 'اطلب الإعداد'],
    'gesetzt': ['set', 'محدَّد'],
    'dringend': ['urgent', 'عاجل'],
    '{1} offen · Top {2}': ['{1} open · top {2}', '{1} مفتوح · أفضل {2}'],
    '{1} Tage': ['{1} days', '{1} أيام'],

    /* ---- Fußzeile / Tastenhilfe ------------------------------------------ */
    'Tasten: 1–4 Kontext (0 = alle, Strg+Klick kombiniert) · M Morgencheck · A Abendcheck · K Kennzahlen · B Kanban wechseln · F Fokus · J Coach · L Lotus · D Design · Esc schließt':
      ['Keys: 1–4 context (0 = all, Ctrl+click combines) · M morning check · A evening check · K metrics · B switch kanban · F focus · J Coach · L lotus · D look · Esc closes',
       'المفاتيح: 1–4 السياق (0 = الكل، Ctrl+نقر للدمج) · M فحص الصباح · A فحص المساء · K المؤشرات · B تبديل الكانبان · F التركيز · J مدرّب · L اللوتس · D المظهر · Esc للإغلاق']
  };

  /* ==========================================================================
     LAUFZEIT — ab hier nichts mehr zu übersetzen, nur Mechanik
     ========================================================================== */

  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, IFRAME: 1, CODE: 1, PRE: 1, SVG: 1 };
  const PFEILE = { '→': '←', '←': '→', '↗': '↖', '↖': '↗', '↘': '↙', '↙': '↘', '›': '‹', '‹': '›', '»': '«', '«': '»', '▸': '◂', '◂': '▸', '▶': '◀', '◀': '▶' };

  const ORIG = new WeakMap();     /* Textknoten  → deutscher Originaltext          */
  const ORIGA = new WeakMap();    /* Element     → { attribut: deutscher Original } */

  function gewaehlteSprache() {
    const p = new URLSearchParams(location.search).get('lang');
    if (SPRACHEN[p]) return p;
    try { const s = localStorage.getItem('compassLang'); if (SPRACHEN[s]) return s; } catch (e) {}
    return 'de';
  }
  let LANG = gewaehlteSprache();

  /* Wurzel sofort setzen (das Skript steht im <head>) — sonst blitzt beim
     ersten Bild kurz das linksbündige Layout auf, bevor RTL greift. */
  function wurzel() {
    const h = document.documentElement;
    h.lang = LANG;
    h.dir = SPRACHEN[LANG].dir;
    h.setAttribute('data-lang', LANG);
  }
  wurzel();

  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  const spalte = () => (LANG === 'en' ? 0 : 1);

  /* Platzhalter: Zahlen — und auf zweiter Stufe auch Zitiertes in „…“ — werden zu
     {1}, {2} …, damit ein Eintrag auf jede Ausprägung passt:
       "3 von 8 Tugenden"            → "{1} von {2} Tugenden"
       "Aus „Kontext 1“. Reicht…" → "Aus „{1}“. Reicht…"
     Erst wird nur mit Zahlen gesucht, dann mit Zahlen + Zitat. Andersherum
     verlöre man Einträge, in denen das Zitat fest zum Satz gehört
     („… 10 Karten in „Bereit“ …“). */
  const ZAHL = /\d+(?:[.,]\d+)*/g;
  const ZAHL_ZITAT = /\d+(?:[.,]\d+)*|„[^“]*“/g;
  function schablone(s, re) {
    const teile = [];
    const key = s.replace(re, m => {
      const zitat = m[0] === '„';
      teile.push(zitat ? m.slice(1, -1) : m);
      return zitat ? '„{' + teile.length + '}“' : '{' + teile.length + '}';
    });
    return { key, teile };
  }
  const fuellen = (t, teile) => t.replace(/\{(\d+)\}/g, (m, i) => (teile[i - 1] != null ? teile[i - 1] : m));

  function eintrag(t) {
    const d = W[t];
    if (d && d[spalte()]) return d[spalte()];
    for (const re of [ZAHL, ZAHL_ZITAT]) {
      const { key, teile } = schablone(t, re);
      if (key === t) continue;
      const d2 = W[key];
      if (d2 && d2[spalte()]) return fuellen(d2[spalte()], teile);
    }
    return null;
  }

  /* Führende Emoji / abschließende Pfeile abtrennen, Kern übersetzen, wieder
     anhängen — im Arabischen mit gespiegelten Pfeilen. */
  /* „Deko“ = Emoji, Pfeile, Trennpunkte und Gedankenstriche am Rand eines Textes.
     Satzzeichen (. ! ? : “) gehören ausdrücklich NICHT dazu — sonst suchte der
     Layer „… reichen schon“ ohne Punkt und fände den Wörterbucheintrag nicht. */
  const DEKO = '[\\p{Extended_Pictographic}\\uFE0F\\u2190-\\u21FF\\u25A0-\\u25FF\\u2600-\\u27FF\\u2900-\\u297F\\u2039\\u203A\\u00AB\\u00BB\\uFF0B\\u2022·…—–]';
  const VORN = new RegExp('^(?:' + DEKO + '|\\s)+', 'u');
  const HINTEN = new RegExp('(?:' + DEKO + '|\\s)+$', 'u');
  const KLAMMER = /^(.*\S)\s*\((.*)\)$/;
  const spiegeln = s => (SPRACHEN[LANG].dir === 'rtl' ? s.replace(/[→←↗↖↘↙›‹»«▸◂▶◀]/g, c => PFEILE[c] || c) : s);

  /* Zusammengesetzte Zeilen. Der Compass baut viele Texte aus Bausteinen:
     „Ordnung — WIP 3/3 — das Board ist geordnet.“, „offene Tickets — Projekt
     öffnen“, „Frühstarter — 5 Morgenchecks gemacht (0/5)“. Statt jede Kombination
     ins Wörterbuch zu schreiben, zerlegt suche() an den Trennern und übersetzt die
     Teile. Regel: **jeder** Teil muss auflösbar sein, sonst bleibt die ganze Zeile
     deutsch — eine halb übersetzte Zeile ist schlimmer als eine deutsche. */
  const TRENNER = [' — ', ' · '];
  /* Vorsilben, hinter denen beliebiger Inhalt stehen darf (Ticketschlüssel o. ä.) */
  const PRAEFIXE = ['Öffnen ↗', 'Stand:', 'Stand', 'Datenstand:', 'Live-Quelle:'];
  const hatBuchstaben = s => /\p{L}/u.test(s);

  function suche(t, tiefe) {
    tiefe = tiefe || 0;
    const direkt = eintrag(t);
    if (direkt != null) return direkt;
    if (tiefe > 3) return null;
    /* Teilstück ohne Buchstaben (Zahlen, ≤, Pfeile) geht unverändert durch. */
    const seite = x => (hatBuchstaben(x) ? suche(x, tiefe + 1) : x);

    const v = (t.match(VORN) || [''])[0];
    const rest = t.slice(v.length);
    const h = (rest.match(HINTEN) || [''])[0];
    const mitte = rest.slice(0, rest.length - h.length);
    if (mitte && (v || h)) {
      const kern = suche(mitte, tiefe + 1);
      if (kern != null) return spiegeln(v) + kern + spiegeln(h);
    }

    const k = t.match(KLAMMER);
    if (k) {
      const aussen = seite(k[1]);
      if (aussen != null) {
        const innen = seite(k[2]);
        if (innen != null) return aussen + ' (' + innen + ')';
      }
    }

    for (const tr of TRENNER) {
      let i = t.indexOf(tr);
      while (i > 0) {
        const l = seite(t.slice(0, i));
        if (l != null) {
          const r = seite(t.slice(i + tr.length));
          if (r != null) return l + tr + r;
        }
        i = t.indexOf(tr, i + 1);
      }
    }

    for (const p of PRAEFIXE) {
      if (t.length > p.length + 1 && t.slice(0, p.length + 1) === p + ' ') {
        const v = suche(p, tiefe + 1);
        if (v != null) return v + ' ' + t.slice(p.length + 1);
      }
    }
    return null;
  }

  /* Dieselben Texte laufen bei jedem render() wieder durch — einmal nachschlagen
     genügt. Schlüssel enthält die Sprache, ein Wechsel entwertet den Speicher. */
  const CACHE = new Map();
  function uebersetze(roh) {
    if (LANG === 'de') return roh;
    const t = norm(roh);
    if (!t) return roh;
    const ck = LANG + '|' + t;
    let v;
    if (CACHE.has(ck)) v = CACHE.get(ck);
    else { v = suche(t); if (CACHE.size < 4000) CACHE.set(ck, v); }
    if (v == null) return roh;
    return roh.match(/^\s*/)[0] + v + roh.match(/\s*$/)[0];
  }

  /* ---------- Textknoten ---------- */
  function knoten(n) {
    const de = ORIG.has(n) ? ORIG.get(n) : n.nodeValue;
    if (LANG === 'de') {
      if (ORIG.has(n)) { n.nodeValue = de; ORIG.delete(n); }
      return;
    }
    const p = n.parentElement;
    if (!p || SKIP[p.tagName.toUpperCase()] || p.closest('[data-nolang]')) return;
    const neu = uebersetze(de);
    if (neu === n.nodeValue) return;
    if (!ORIG.has(n)) ORIG.set(n, de);
    n.nodeValue = neu;
  }

  /* ---------- Attribute ---------- */
  function attrEl(el) {
    if (!el.getAttribute || el.closest('[data-nolang]')) return;
    const alt = ORIGA.get(el) || {};
    const liste = ATTRS.slice();
    /* Coach- Schnellfragen sind der Text, der an Coach geht — die dürfen mit. */
    if (el.matches && el.matches('#johnQuick [data-q]')) liste.push('data-q');
    liste.forEach(a => {
      const jetzt = el.getAttribute(a);
      if (jetzt == null) return;
      const de = a in alt ? alt[a] : jetzt;
      if (LANG === 'de') { if (a in alt) { el.setAttribute(a, de); delete alt[a]; } return; }
      const neu = uebersetze(de);
      if (neu === jetzt) return;
      if (!(a in alt)) alt[a] = de;
      el.setAttribute(a, neu);
    });
    if (Object.keys(alt).length) ORIGA.set(el, alt); else ORIGA.delete(el);
  }

  function attribute(root) {
    if (root.nodeType === 1) attrEl(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[title],[placeholder],[aria-label],[alt],#johnQuick [data-q]').forEach(attrEl);
  }

  /* ---------- ein Durchlauf über einen Teilbaum ---------- */
  function lauf(root) {
    const start = root || document.body;
    if (!start) return;
    if (start.nodeType === 3) { knoten(start); return; }
    if (start.nodeType !== 1) return;
    if (SKIP[start.tagName.toUpperCase()]) return;
    const w = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || SKIP[p.tagName.toUpperCase()]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const zu = [];
    let n;
    while ((n = w.nextNode())) zu.push(n);
    zu.forEach(knoten);
    attribute(start);
  }

  function titel() {
    const t = document.querySelector('title');
    if (t) knoten(t.firstChild || t.appendChild(document.createTextNode('')));
  }

  /* ---------- Beobachter: was neu gezeichnet wird, wird sofort übersetzt --- */
  const warte = new Set();
  let geplant = false;
  function plane() {
    if (geplant) return;
    geplant = true;
    let lief = false;
    const tun = () => {
      if (lief) return;
      lief = true;
      geplant = false;
      const liste = [...warte];
      warte.clear();
      if (liste.length > 60) lauf(document.body);
      else liste.forEach(n => { if (n.isConnected) lauf(n); });
    };
    /* Beides: rAF übersetzt im sichtbaren Tab noch vor dem Bild, der Timer ist
       die Rückfallebene — in einem Hintergrund-Tab feuert rAF nicht, und dann
       stünde nach jedem render() wieder Deutsch da. Wer zuerst kommt, gewinnt. */
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tun);
    setTimeout(tun, 50);
  }
  const beobachter = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type === 'childList') m.addedNodes.forEach(nd => { if (nd.nodeType === 1 || nd.nodeType === 3) warte.add(nd); });
      else if (m.type === 'attributes' && m.target.nodeType === 1) warte.add(m.target);
    });
    if (warte.size) plane();
  });

  function start() {
    if (!document.body) return;
    lauf(document.body);
    titel();
    beobachter.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* ---------- Umschalten ---------- */
  function setzen(l) {
    if (!SPRACHEN[l] || l === LANG) return;
    LANG = l;
    try { localStorage.setItem('compassLang', l); } catch (e) {}
    wurzel();
    /* Erst neu zeichnen, dann übersetzen: alles, was sein Datum, seine Uhrzeit
       oder seine Zahlen selbst formatiert, schreibt sonst hinterher wieder
       Deutsch in den fertig übersetzten Baum. */
    try { if (typeof kopfMalen === 'function') kopfMalen(); } catch (e) {}
    try { if (typeof rhythmMalen === 'function') rhythmMalen(); } catch (e) {}
    try { if (typeof uhr === 'function') uhr(); } catch (e) {}
    try { if (typeof phaseApply === 'function') phaseApply(); } catch (e) {}
    try { if (typeof render === 'function' && typeof aktuell !== 'undefined') render(aktuell); } catch (e) {}
    lauf(document.body);
    titel();
    document.dispatchEvent(new CustomEvent('compass-sprache', { detail: { lang: l } }));
  }

  /* ---------- Lückenbericht (Pflege) ---------- */
  const DEUTSCH = /[äöüßÄÖÜ]|\b(der|die|das|den|dem|und|oder|nicht|kein|keine|dein|deine|dir|dich|mit|für|von|aus|noch|ist|sind|wird|werden|auf|im|zum|zur|eine|einen|einem|hier|heute|morgen|schon|mehr|alle|nur)\b/;
  function luecken(alsZeilen) {
    const roh = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || SKIP[p.tagName.toUpperCase()] || p.closest('[data-nolang]')) return NodeFilter.FILTER_REJECT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let n;
    while ((n = w.nextNode())) {
      const de = norm(ORIG.has(n) ? ORIG.get(n) : n.nodeValue);
      if (de.length > 2 && DEUTSCH.test(de) && suche(de) == null) roh.add(de);
    }
    document.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(el => {
      const alt = ORIGA.get(el) || {};
      ATTRS.forEach(a => {
        const v = norm(a in alt ? alt[a] : (el.getAttribute(a) || ''));
        if (v.length > 2 && DEUTSCH.test(v) && suche(v) == null) roh.add(v);
      });
    });
    const liste = [...roh].sort((a, b) => a.localeCompare(b, 'de'));
    if (alsZeilen) return liste.map(s => "    " + JSON.stringify(s) + ": ['', ''],").join('\n');
    console.log('%c' + liste.length + ' Texte ohne Wörterbucheintrag', 'font-weight:bold');
    return liste;
  }

  /* ---------- Öffentliche Schnittstelle ---------- */
  window.compassSprache = {
    jetzt: () => LANG,
    setzen,
    sprachen: SPRACHEN,
    t: uebersetze,
    luecken,
    woerter: W
  };
  /* Kurzform für die onclick-Attribute im Design-Menü */
  window.langSet = setzen;
  /* Formatier-Gebietsschema für alle toLocale*-Aufrufe in dashboard.html.
     Arabisch mit westlichen Ziffern (ar-u-nu-latn): Ticketnummern, Uhrzeit und
     Kennzahlen sollen überall gleich aussehen. */
  window.LOC = () => SPRACHEN[LANG].loc;
})();
