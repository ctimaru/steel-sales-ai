-- K3 — Public Standards Catalog.
--
-- Publishes the first editorial standard cluster for Steel Knowledge.
-- The catalog is deliberately summary-first: no licensed normative tables or
-- protected standard text are reproduced. Each published page carries reviewed
-- editorial copy, official reference links and a review date.

alter table public.steel_knowledge_standard_pages
  add column if not exists source_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_references)='array'),
  add column if not exists last_reviewed_at date,
  add column if not exists related_standard_slugs text[] not null default '{}'::text[];

alter table public.steel_knowledge_standard_pages
  drop constraint if exists steel_knowledge_standard_pages_published_sources_check;

alter table public.steel_knowledge_standard_pages
  add constraint steel_knowledge_standard_pages_published_sources_check
  check (
    page_status <> 'published'
    or (
      last_reviewed_at is not null
      and jsonb_array_length(source_references) > 0
    )
  );

comment on column public.steel_knowledge_standard_pages.source_references is
  'K3 reviewed public references, normally official standards-body catalog pages. Does not expose internal source/provenance tables.';
comment on column public.steel_knowledge_standard_pages.last_reviewed_at is
  'K3 editorial review date for public factual freshness.';
comment on column public.steel_knowledge_standard_pages.related_standard_slugs is
  'K3 editorial internal-link targets. Only published targets are returned by the public RPC.';

-- EN 10210 — public family guide.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10210: profilati cavi strutturali finiti a caldo',
  seo_description='Guida alla EN 10210: cosa disciplina, differenza tra parte 1 e parte 2, prodotti coperti, gradi collegati e rapporto con EN 10219.',
  intro='La EN 10210 è la famiglia di riferimento per i profilati cavi strutturali finiti a caldo. La sua logica è più facile da leggere separando le condizioni tecniche di fornitura dalle regole dimensionali: la Parte 1 riguarda il prodotto e le condizioni di consegna, mentre la Parte 2 tratta tolleranze, dimensioni e proprietà della sezione.',
  what_it_covers='Nel quadro attualmente pubblicato, EN 10210-1 definisce le condizioni tecniche di fornitura dei profilati cavi strutturali finiti a caldo, mentre EN 10210-2 definisce tolleranze, dimensioni e proprietà di sezione. La famiglia comprende sezioni circolari, quadrate, rettangolari ed ellittiche. Il catalogo UNI consultato per questa scheda indica UNI EN 10210-1:2006 e UNI EN 10210-2:2019 come riferimenti in vigore alla data di revisione.',
  how_to_read='Per una specifica commerciale non basta indicare "EN 10210" in modo generico. È utile distinguere il requisito di prodotto e materiale, normalmente ricondotto alla Parte 1, dai dati dimensionali e dalle tolleranze della Parte 2. Anche il grado deve essere letto insieme alla norma e alla condizione di fornitura: una sigla di acciaio, presa da sola, non dimostra automaticamente la conformità a una determinata parte della EN 10210.',
  typical_applications='La famiglia EN 10210 viene utilizzata per profilati cavi con funzione strutturale, per esempio in telai, colonne, travature reticolari, carpenterie e strutture dove la sezione cava contribuisce alla resistenza e alla rigidezza dell’insieme. L’idoneità a uno specifico progetto dipende comunque dal calcolo strutturale, dalla classe di esecuzione e dai requisiti contrattuali applicabili.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','EN 10210-1 e EN 10210-2: perché sono due riferimenti diversi',
      'body','La Parte 1 è centrata sulle condizioni tecniche di fornitura del profilato cavo strutturale. La Parte 2 è invece il riferimento per tolleranze, dimensioni e proprietà geometriche della sezione. In un ordine o in un capitolato i due livelli rispondono quindi a domande diverse: "che prodotto/materiale sto acquistando?" e "con quali caratteristiche dimensionali viene fornito?".'
    ),
    jsonb_build_object(
      'heading','EN 10210 oppure EN 10219?',
      'body','La distinzione principale è il percorso di fabbricazione descritto dalle due famiglie. EN 10210 riguarda profilati cavi finiti a caldo o ricondotti a condizioni metallurgiche equivalenti; EN 10219 riguarda profilati cavi saldati formati a freddo senza un successivo trattamento termico generale. Le due famiglie non vanno trattate come tabelle dimensionali intercambiabili.'
    ),
    jsonb_build_object(
      'heading','Come usare la norma in una richiesta di offerta',
      'body','Una richiesta ben definita dovrebbe riportare almeno famiglia di prodotto, norma/parte applicabile, grado, geometria, dimensioni e quantità. Quando la prestazione strutturale è rilevante, le condizioni progettuali e di esecuzione restano esterne alla sola designazione commerciale del tubo o del profilato.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che cos’è la EN 10210?',
      'answer','È una famiglia di norme europee dedicata ai profilati cavi strutturali finiti a caldo. Le parti principali separano condizioni tecniche di fornitura e requisiti dimensionali.'
    ),
    jsonb_build_object(
      'question','Qual è la differenza tra EN 10210 e EN 10219?',
      'answer','EN 10210 e EN 10219 descrivono famiglie di profilati cavi strutturali ottenuti con percorsi produttivi differenti. La scelta dipende dal prodotto richiesto e dai requisiti del progetto, non solo dalla forma della sezione.'
    ),
    jsonb_build_object(
      'question','Il grado S355J2H implica automaticamente EN 10210?',
      'answer','No. La designazione del grado non basta, da sola, a stabilire la norma di fornitura. Norma, grado, processo, dimensioni e documentazione devono essere verificati insieme.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','UNI EN 10210-1:2006 — Condizioni tecniche di fornitura',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10210-1-2006',
      'status','In vigore alla revisione K3'
    ),
    jsonb_build_object(
      'label','UNI EN 10210-2:2019 — Tolleranze, dimensioni e proprietà di sezione',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10210-2-2019',
      'status','In vigore alla revisione K3'
    )
  ),
  related_standard_slugs=array['en-10219']::text[],
  editorial_version=3,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10210';

-- EN 10219 — public family guide.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10219: profilati cavi strutturali formati a freddo',
  seo_description='Guida alla EN 10219 per profilati cavi saldati formati a freddo: parti della norma, forme, tolleranze, gradi e differenze rispetto a EN 10210.',
  intro='La EN 10219 è la famiglia europea dedicata ai profilati cavi strutturali saldati formati a freddo. Anche qui è essenziale distinguere le condizioni tecniche di fornitura della Parte 1 dai requisiti dimensionali e dalle proprietà di sezione della Parte 2.',
  what_it_covers='EN 10219-1 disciplina le condizioni tecniche di fornitura dei profilati cavi strutturali saldati formati a freddo; EN 10219-2 disciplina tolleranze, dimensioni e proprietà di sezione. La versione 2019 della Parte 2 comprende sezioni circolari, quadrate, rettangolari ed ellittiche. Alla data di revisione di questa pagina, il catalogo UNI indica UNI EN 10219-1:2006 e UNI EN 10219-2:2019 come documenti in vigore; è in corso un progetto di revisione della Parte 1, che non va confuso con una norma definitiva già pubblicata.',
  how_to_read='Quando una specifica cita EN 10219 è utile verificare quale parte viene richiesta. La Parte 1 definisce il quadro di fornitura; la Parte 2 serve per dimensioni, tolleranze e proprietà geometriche. La presenza di un grado in una gamma commerciale di produttore è un’indicazione utile, ma non sostituisce la verifica della norma e dell’edizione applicabili al contratto.',
  typical_applications='I profilati cavi EN 10219 sono impiegati in carpenteria e strutture metalliche, telai, elementi secondari e principali, colonne e altre applicazioni strutturali. La conformità del prodotto non sostituisce la verifica progettuale dell’elemento nella struttura.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Che cosa significa "formato a freddo"',
      'body','Nella famiglia EN 10219 il profilo strutturale viene formato a freddo e, nel quadro della Parte 1 attualmente in vigore, non è sottoposto a un trattamento termico generale successivo che lo riporti alle condizioni metallurgiche tipiche del prodotto finito a caldo. Questo distingue la famiglia EN 10219 dalla EN 10210.'
    ),
    jsonb_build_object(
      'heading','La funzione della Parte 2',
      'body','EN 10219-2 è il riferimento dimensionale della famiglia: organizza tolleranze, dimensioni e proprietà di sezione. La versione 2019 amplia anche il perimetro alle sezioni ellittiche. Per selezionare una misura commerciale serve comunque verificare la disponibilità del produttore oltre al campo normativo.'
    ),
    jsonb_build_object(
      'heading','Attenzione agli aggiornamenti in corso',
      'body','Nel 2026 è disponibile un progetto di revisione di EN 10219-1. Un progetto o draft serve a seguire l’evoluzione tecnica, ma non deve essere presentato come se avesse già sostituito la norma pubblicata in vigore. Steel Knowledge separa sempre stato corrente e lavori di revisione.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che cos’è la EN 10219?',
      'answer','È la famiglia di norme europee per profilati cavi strutturali saldati formati a freddo, con una parte dedicata alla fornitura e una alle dimensioni e tolleranze.'
    ),
    jsonb_build_object(
      'question','EN 10219 e EN 10210 sono equivalenti?',
      'answer','No. Sono famiglie correlate ma descrivono percorsi produttivi differenti e non vanno considerate automaticamente intercambiabili.'
    ),
    jsonb_build_object(
      'question','La bozza EN 10219-1:2026 ha già sostituito la versione precedente?',
      'answer','No. Alla revisione di questa pagina il progetto 2026 è ancora un draft in sviluppo; per la conformità occorre verificare la norma pubblicata applicabile al contratto.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','UNI EN 10219-1:2006 — Condizioni tecniche di fornitura',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10219-1-2006',
      'status','In vigore alla revisione K3'
    ),
    jsonb_build_object(
      'label','UNI EN 10219-2:2019 — Tolleranze, dimensioni e proprietà di sezione',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10219-2-2019',
      'status','In vigore alla revisione K3'
    ),
    jsonb_build_object(
      'label','prEN 10219-1:2026 — progetto di revisione',
      'publisher','BSI / CEN development',
      'url','https://standardsdevelopment.bsigroup.com/projects/2025-03975',
      'status','Draft; non è la norma definitiva'
    )
  ),
  related_standard_slugs=array['en-10210']::text[],
  editorial_version=3,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10219';

-- EN 10216-2.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10216-2: tubi senza saldatura per pressione',
  seo_description='Guida alla EN 10216-2: tubi senza saldatura per pressione e temperatura elevata, campo di applicazione, materiali e rapporto con EN 10217-2.',
  intro='EN 10216-2 riguarda tubi di acciaio senza saldatura per impieghi in pressione con proprietà specificate a temperatura elevata. La norma è particolarmente rilevante quando il requisito combina pressione, temperatura di esercizio e controllo delle caratteristiche del materiale.',
  what_it_covers='L’edizione EN 10216-2:2024 specifica condizioni tecniche di fornitura, in due categorie di prova, per tubi senza saldatura di sezione circolare prodotti in acciai non legati e legati con proprietà definite a temperatura elevata. Il documento prevede anche la possibilità di applicazione a sezioni non circolari previo accordo sugli adattamenti necessari in fase di richiesta e ordine.',
  how_to_read='La sigla EN 10216-2 identifica la norma di fornitura, mentre il grado identifica il materiale. Per esempio, P235GH, P265GH o 16Mo3 non sono sinonimi della norma: devono essere verificati come combinazione norma-grado-processo. Steel Knowledge mostra separatamente le associazioni provenienti da cataloghi di produttori o fornitori, senza trasformarle in equivalenze normative.',
  typical_applications='Questa famiglia è comunemente considerata per tubazioni, componenti e circuiti in pressione nei quali le proprietà a temperatura elevata sono un requisito di progetto, come impianti energetici, scambiatori, generatori di vapore e processi industriali. La selezione finale dipende dal progetto, dalla temperatura, dalla pressione e dalla documentazione richiesta.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Senza saldatura non significa "senza requisiti aggiuntivi"',
      'body','Il processo seamless descrive il modo in cui il tubo viene prodotto, ma la conformità richiede anche materiale, prove, condizioni di consegna, dimensioni e documentazione coerenti con la norma e con l’ordine.'
    ),
    jsonb_build_object(
      'heading','EN 10216-2 e proprietà a temperatura elevata',
      'body','La Parte 2 è distinta dalle parti della serie EN 10216 dedicate ad altri campi di proprietà. Il riferimento "elevated temperature" è quindi centrale per capire perché un capitolato richiama proprio questa parte della famiglia.'
    ),
    jsonb_build_object(
      'heading','Confronto con EN 10217-2',
      'body','EN 10216-2 e EN 10217-2 rispondono a un’esigenza applicativa simile per proprietà a temperatura elevata, ma differiscono per il percorso produttivo: la prima riguarda tubi senza saldatura, la seconda tubi saldati elettricamente. Non sono sostituti automatici.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Cosa indica EN 10216-2?',
      'answer','Indica condizioni tecniche di fornitura per tubi senza saldatura destinati a impieghi in pressione con proprietà specificate a temperatura elevata.'
    ),
    jsonb_build_object(
      'question','P265GH è sempre EN 10216-2?',
      'answer','No. P265GH è una designazione di materiale; la norma di fornitura deve essere indicata e verificata separatamente.'
    ),
    jsonb_build_object(
      'question','Qual è la differenza tra EN 10216-2 e EN 10217-2?',
      'answer','La differenza principale nel perimetro delle due parti è il processo: EN 10216-2 tratta tubi senza saldatura, EN 10217-2 tubi saldati elettricamente, entrambi con proprietà per temperatura elevata.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','UNI EN 10216-2:2024 — Tubi senza saldatura per impieghi in pressione, Parte 2',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10216-2-2024',
      'status','In vigore alla revisione K3'
    )
  ),
  related_standard_slugs=array['en-10217-2']::text[],
  editorial_version=3,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10216-2';

-- EN 10217-1.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10217-1: tubi saldati per pressione a temperatura ambiente',
  seo_description='Guida alla EN 10217-1: tubi saldati per pressione, qualità TR1 e TR2, proprietà a temperatura ambiente, materiali e utilizzo della norma.',
  intro='EN 10217-1 è la parte della serie EN 10217 dedicata ai tubi saldati di acciaio non legato per impieghi in pressione con proprietà specificate a temperatura ambiente. È un riferimento diverso dalle parti della stessa serie dedicate alle proprietà a temperatura elevata o ad altri campi di servizio.',
  what_it_covers='L’edizione 2019 definisce le condizioni tecniche di fornitura per tubi saldati elettricamente e saldati ad arco sommerso, di sezione circolare, realizzati in acciaio non legato di qualità e con proprietà specificate a temperatura ambiente. La norma distingue le qualità TR1 e TR2.',
  how_to_read='In un’offerta o in un capitolato conviene leggere insieme norma, qualità TR1/TR2, grado, processo di saldatura, dimensioni e documentazione. Una designazione come P235TR1 o P235TR2 descrive il materiale/qualità ma non sostituisce l’indicazione della norma di fornitura.',
  typical_applications='La norma è utilizzata per tubi saldati destinati a sistemi e apparecchiature in pressione quando il riferimento prestazionale è la temperatura ambiente. La scelta tra parti diverse della serie EN 10217 dipende dalle condizioni di servizio e dal progetto.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','TR1 e TR2: perché la qualità conta',
      'body','La Parte 1 distingue due qualità, TR1 e TR2. Questa indicazione deve essere conservata nella specifica commerciale perché è parte dell’identità tecnica del materiale e influenza il quadro di requisiti e prove previsto dalla norma.'
    ),
    jsonb_build_object(
      'heading','Processi coperti',
      'body','EN 10217-1 comprende tubi saldati elettricamente e tubi saldati ad arco sommerso. Il processo effettivo va quindi indicato nell’ordine quando è rilevante per il progetto o per il capitolato.'
    ),
    jsonb_build_object(
      'heading','Quando guardare EN 10217-2',
      'body','Se il requisito riguarda proprietà specificate a temperatura elevata, il riferimento della stessa serie da esaminare è EN 10217-2. Passare da una parte all’altra non è una semplice modifica del nome: cambia il campo tecnico di riferimento.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Cosa tratta EN 10217-1?',
      'answer','Tubi saldati di acciaio non legato per impieghi in pressione con proprietà specificate a temperatura ambiente.'
    ),
    jsonb_build_object(
      'question','Qual è la differenza tra TR1 e TR2?',
      'answer','Sono due qualità previste dalla norma. La sigla completa del grado deve essere mantenuta nell’ordine e nella documentazione, senza ridurre TR1 e TR2 a varianti intercambiabili.'
    ),
    jsonb_build_object(
      'question','EN 10217-1 copre anche le alte temperature?',
      'answer','La Parte 1 è centrata sulle proprietà a temperatura ambiente. Per proprietà specificate a temperatura elevata la serie prevede, tra gli altri riferimenti, EN 10217-2.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','UNI EN 10217-1:2019 — Tubi saldati per impieghi in pressione, Parte 1',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10217-1-2019',
      'status','In vigore alla revisione K3'
    )
  ),
  related_standard_slugs=array['en-10217-2']::text[],
  editorial_version=3,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10217-1';

-- EN 10217-2.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10217-2: tubi saldati per pressione a temperatura elevata',
  seo_description='Guida alla EN 10217-2: tubi saldati elettricamente per pressione con proprietà a temperatura elevata, materiali e confronto con EN 10216-2.',
  intro='EN 10217-2 riguarda tubi saldati elettricamente per impieghi in pressione con proprietà specificate a temperatura elevata. È il riferimento della serie EN 10217 da leggere quando il servizio richiede prestazioni del materiale in temperatura e il processo di fabbricazione è saldato elettricamente.',
  what_it_covers='L’edizione 2019 specifica condizioni tecniche di fornitura, in due categorie di prova, per tubi saldati elettricamente di sezione circolare. Il campo comprende acciai non legati di qualità e acciai legati speciali con proprietà specificate a temperatura elevata.',
  how_to_read='Norma, grado e processo devono restare tre informazioni distinte. Un grado GH può comparire in più contesti tecnici; per questo una riga commerciale dovrebbe riportare esplicitamente EN 10217-2, la designazione del materiale, le dimensioni e gli eventuali requisiti di prova o certificazione.',
  typical_applications='La norma è rilevante per circuiti e componenti in pressione nei quali sono richieste proprietà a temperatura elevata e si utilizza un tubo saldato elettricamente. Le applicazioni effettive e i limiti di progetto dipendono dall’apparecchiatura e dalla normativa di sistema.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Perché la temperatura è nel nome della parte',
      'body','La serie EN 10217 suddivide i requisiti in funzione del tipo di tubo e delle proprietà richieste. La Parte 2 è specificamente dedicata alle proprietà a temperatura elevata, quindi non va confusa con EN 10217-1, che tratta proprietà a temperatura ambiente.'
    ),
    jsonb_build_object(
      'heading','Tubo saldato elettricamente',
      'body','Il processo di saldatura è parte del perimetro della norma. Nei dati commerciali conviene conservarlo esplicitamente, perché aiuta a distinguere prodotti che possono avere diametri, spessori o gradi simili ma una specifica tecnica diversa.'
    ),
    jsonb_build_object(
      'heading','EN 10217-2 oppure EN 10216-2?',
      'body','Entrambe le parti trattano tubi per pressione con proprietà a temperatura elevata, ma EN 10216-2 riguarda il processo senza saldatura mentre EN 10217-2 riguarda il processo saldato elettricamente. La scelta è progettuale e contrattuale.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Cosa tratta EN 10217-2?',
      'answer','Tubi saldati elettricamente di acciaio non legato o legato per impieghi in pressione con proprietà specificate a temperatura elevata.'
    ),
    jsonb_build_object(
      'question','EN 10217-2 è equivalente a EN 10216-2?',
      'answer','No. Hanno un campo applicativo vicino per temperatura e pressione, ma processi produttivi diversi e requisiti propri.'
    ),
    jsonb_build_object(
      'question','P235GH identifica automaticamente EN 10217-2?',
      'answer','No. P235GH è un grado; la norma di fornitura deve essere verificata separatamente.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','UNI EN 10217-2:2019 — Tubi saldati per impieghi in pressione, Parte 2',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10217-2-2019',
      'status','In vigore alla revisione K3'
    )
  ),
  related_standard_slugs=array['en-10216-2','en-10217-1']::text[],
  editorial_version=3,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10217-2';

-- EN 10224.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10224: tubi in acciaio per acqua e liquidi acquosi',
  seo_description='Guida alla EN 10224: tubi e raccordi in acciaio non legato per acqua e liquidi acquosi, prodotti coperti, campo dimensionale e uso della norma.',
  intro='EN 10224 è il riferimento europeo per tubi e raccordi in acciaio non legato destinati al trasporto di acqua e altri liquidi acquosi, compresa l’acqua per consumo umano. La norma copre sia tubi senza saldatura sia tubi saldati e include anche requisiti per estremità e raccordi.',
  what_it_covers='Il testo europeo EN 10224:2002 con aggiornamento A1:2005 specifica requisiti per tubi senza saldatura e saldati in acciaio non legato, preparazione delle estremità per saldatura di testa e raccordi fabbricati da tubo, lamiera o nastro. Il catalogo UNI della versione nazionale indica un campo di diametri esterni da 26,9 mm a 2 743 mm.',
  how_to_read='Quando EN 10224 compare in una richiesta di offerta è utile distinguere norma, grado, diametro, spessore, lunghezza, estremità, eventuale rivestimento e documentazione richiesta. La norma definisce il quadro tecnico del prodotto, ma una specifica commerciale completa deve esplicitare anche le condizioni particolari dell’ordine.',
  typical_applications='La norma viene utilizzata per condotte e componenti destinati al trasporto di acqua e altri liquidi acquosi, inclusa l’acqua potabile. Le condizioni di posa, protezione dalla corrosione, giunzione e progetto della linea devono essere definite in coerenza con il sistema e con il capitolato applicabile.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Tubi e raccordi nello stesso quadro tecnico',
      'body','EN 10224 non si limita alla canna del tubo: il suo campo comprende anche preparazioni delle estremità e raccordi ottenuti da tubo, lamiera o nastro. Per questo può comparire in capitolati che descrivono una linea di trasporto dell’acqua in modo più ampio del solo tubo.'
    ),
    jsonb_build_object(
      'heading','Saldato o senza saldatura',
      'body','La norma comprende entrambi i processi. In una richiesta commerciale è quindi importante specificare se il processo è vincolato dal progetto oppure se sono ammesse più soluzioni conformi alle condizioni dell’ordine.'
    ),
    jsonb_build_object(
      'heading','Dimensioni e disponibilità commerciale',
      'body','Il campo normativo è ampio, ma non coincide con ciò che ogni produttore mantiene a catalogo. Steel Knowledge distingue il perimetro della norma dalla disponibilità reale dei produttori e dalle gamme commerciali osservate.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Cosa tratta EN 10224?',
      'answer','Tubi e raccordi in acciaio non legato per il trasporto di acqua e altri liquidi acquosi, inclusa l’acqua per consumo umano.'
    ),
    jsonb_build_object(
      'question','EN 10224 riguarda solo tubi saldati?',
      'answer','No. Il campo della norma comprende sia tubi saldati sia tubi senza saldatura.'
    ),
    jsonb_build_object(
      'question','Qual è il campo dimensionale indicato dalla norma?',
      'answer','La pagina ufficiale UNI riporta diametri esterni da 26,9 mm a 2 743 mm. La disponibilità commerciale effettiva va verificata separatamente.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','UNI EN 10224:2006 — Tubi e raccordi per acqua e liquidi acquosi',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10224-2006',
      'status','In vigore alla revisione K3'
    ),
    jsonb_build_object(
      'label','EN 10224:2002/A1:2005 — aggiornamento europeo',
      'publisher','UNI / CEN metadata',
      'url','https://store.uni.com/en-10224-2002-a1-2005',
      'status','Aggiornamento recepito dalla UNI EN 10224:2006'
    )
  ),
  related_standard_slugs=array[]::text[],
  editorial_version=3,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10224';

-- Harden the public read contract with K3 trust/freshness fields and reviewed
-- internal links. Related standard pages are returned only when both sides are
-- published.
drop function if exists public.k2_public_knowledge_standards(text,integer,integer);
create function public.k2_public_knowledge_standards(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  standard_id uuid,
  slug text,
  code text,
  title text,
  standard_system text,
  application_category text,
  short_explanation text,
  seo_title text,
  seo_description text,
  product_families text[],
  related_grade_count integer,
  published_at timestamptz,
  last_reviewed_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.slug,
    s.code,
    s.title,
    s.standard_system,
    s.application_category,
    s.short_explanation,
    p.seo_title,
    p.seo_description,
    coalesce((
      select array_agg(distinct pf.product_family order by pf.product_family)
      from public.steel_standard_product_families pf
      where pf.standard_id=s.id
    ), array[]::text[]) as product_families,
    (
      select count(distinct a.material_grade_id)::integer
      from public.steel_standard_grade_applicability a
      where a.standard_id=s.id
    ) as related_grade_count,
    p.published_at,
    p.last_reviewed_at
  from public.steel_knowledge_standard_pages p
  join public.steel_standards s on s.id=p.standard_id
  where p.page_status='published'
    and s.status='active'
    and (
      nullif(btrim(coalesce(p_query,'')), '') is null
      or s.code ilike '%' || btrim(p_query) || '%'
      or s.title ilike '%' || btrim(p_query) || '%'
      or coalesce(s.short_explanation,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(p.seo_description,'') ilike '%' || btrim(p_query) || '%'
    )
  order by s.standard_system nulls last, s.code_key, s.id
  limit greatest(1,least(coalesce(p_limit,100),250))
  offset greatest(0,coalesce(p_offset,0));
$$;

drop function if exists public.k2_public_knowledge_standard(text);
create function public.k2_public_knowledge_standard(
  p_slug text
)
returns table (
  standard_id uuid,
  slug text,
  code text,
  title text,
  standard_system text,
  issuing_body text,
  edition text,
  part_number text,
  application_category text,
  manufacturing_processes text[],
  dimensional_basis text,
  short_explanation text,
  scope_summary text,
  seo_title text,
  seo_description text,
  intro text,
  what_it_covers text,
  how_to_read text,
  typical_applications text,
  editorial_sections jsonb,
  faq jsonb,
  product_families text[],
  related_grades jsonb,
  source_references jsonb,
  related_standard_pages jsonb,
  published_at timestamptz,
  last_reviewed_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.slug,
    s.code,
    s.title,
    s.standard_system,
    s.issuing_body,
    s.edition,
    s.part_number,
    s.application_category,
    s.manufacturing_processes,
    s.dimensional_basis,
    s.short_explanation,
    s.scope_summary,
    p.seo_title,
    p.seo_description,
    p.intro,
    p.what_it_covers,
    p.how_to_read,
    p.typical_applications,
    p.editorial_sections,
    p.faq,
    coalesce((
      select array_agg(distinct pf.product_family order by pf.product_family)
      from public.steel_standard_product_families pf
      where pf.standard_id=s.id
    ), array[]::text[]) as product_families,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'material_grade_id', r.material_grade_id,
          'designation', r.designation,
          'material_number', r.material_number,
          'standard_system', r.standard_system,
          'applicability_type', r.applicability_type,
          'is_normative', r.applicability_type='normative',
          'manufacturing_processes', r.manufacturing_processes,
          'slug', r.public_slug
        )
        order by r.designation, r.material_number nulls last
      )
      from (
        select
          g.id as material_grade_id,
          g.designation,
          g.material_number,
          g.standard_system,
          case min(
            case a.applicability_type
              when 'normative' then 1
              when 'official_reference' then 2
              when 'manufacturer_range' then 3
              when 'supplier_range' then 4
              when 'verified_internal' then 5
              else 9
            end
          )
            when 1 then 'normative'
            when 2 then 'official_reference'
            when 3 then 'manufacturer_range'
            when 4 then 'supplier_range'
            when 5 then 'verified_internal'
            else 'reference'
          end as applicability_type,
          coalesce(
            array_agg(distinct a.manufacturing_process)
              filter (where a.manufacturing_process is not null),
            array[]::text[]
          ) as manufacturing_processes,
          gp.slug as public_slug
        from public.steel_standard_grade_applicability a
        join public.steel_material_grades g
          on g.id=a.material_grade_id
        left join public.steel_knowledge_grade_pages gp
          on gp.material_grade_id=g.id
         and gp.page_status='published'
        where a.standard_id=s.id
        group by
          g.id,g.designation,g.material_number,g.standard_system,gp.slug
      ) r
    ), '[]'::jsonb) as related_grades,
    p.source_references,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', rp.slug,
          'code', rs.code,
          'title', rp.seo_title,
          'application_category', rs.application_category
        )
        order by rs.code
      )
      from unnest(p.related_standard_slugs) as rel(slug)
      join public.steel_knowledge_standard_pages rp
        on rp.slug=rel.slug
       and rp.page_status='published'
      join public.steel_standards rs
        on rs.id=rp.standard_id
       and rs.status='active'
    ), '[]'::jsonb) as related_standard_pages,
    p.published_at,
    p.last_reviewed_at
  from public.steel_knowledge_standard_pages p
  join public.steel_standards s on s.id=p.standard_id
  where p.page_status='published'
    and s.status='active'
    and p.slug=lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.k2_public_knowledge_standards(text,integer,integer)
  from public;
revoke all on function public.k2_public_knowledge_standard(text)
  from public;

grant execute on function public.k2_public_knowledge_standards(text,integer,integer)
  to anon, authenticated, service_role;
grant execute on function public.k2_public_knowledge_standard(text)
  to anon, authenticated, service_role;

comment on function public.k2_public_knowledge_standards(text,integer,integer) is
  'K3 public standards catalog list. Returns only editorially published pages with review freshness.';
comment on function public.k2_public_knowledge_standard(text) is
  'K3 public standard detail. Returns reviewed editorial copy, official public reference links, explicit applicability semantics and published internal links only.';

do $$
declare
  v_published integer;
begin
  select count(*) into v_published
  from public.steel_knowledge_standard_pages
  where page_status='published'
    and slug in (
      'en-10210',
      'en-10219',
      'en-10216-2',
      'en-10217-1',
      'en-10217-2',
      'en-10224'
    );

  if v_published<>6 then
    raise exception 'K3 expected six published standard pages, got %',v_published;
  end if;

  if exists (
    select 1
    from public.steel_knowledge_standard_pages
    where page_status='published'
      and (
        last_reviewed_at is null
        or jsonb_array_length(source_references)=0
        or nullif(btrim(coalesce(seo_title,'')),'') is null
        or nullif(btrim(coalesce(intro,'')),'') is null
      )
  ) then
    raise exception 'K3 published standard editorial completeness regression';
  end if;
end
$$;
