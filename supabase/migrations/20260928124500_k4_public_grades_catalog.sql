-- K4 — Public Grades Catalog.
--
-- Publishes the first reviewed public steel-grade cluster and gives the grade
-- layer the same editorial trust contract introduced for standards in K3.
-- Grade pages explain designation, use context and observed standard links
-- without asserting automatic equivalence, substitution or normative scope.

alter table public.steel_knowledge_grade_pages
  add column if not exists source_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_references)='array'),
  add column if not exists last_reviewed_at date,
  add column if not exists related_grade_slugs text[] not null default '{}'::text[];

alter table public.steel_knowledge_grade_pages
  drop constraint if exists steel_knowledge_grade_pages_published_sources_check;

alter table public.steel_knowledge_grade_pages
  add constraint steel_knowledge_grade_pages_published_sources_check
  check (
    page_status <> 'published'
    or (
      last_reviewed_at is not null
      and jsonb_array_length(source_references) > 0
    )
  );

comment on column public.steel_knowledge_grade_pages.source_references is
  'K4 reviewed public references supporting the editorial grade page. Manufacturer/supplier scope remains explicitly non-normative.';
comment on column public.steel_knowledge_grade_pages.last_reviewed_at is
  'K4 editorial review date for public factual freshness.';
comment on column public.steel_knowledge_grade_pages.related_grade_slugs is
  'K4 editorial internal-link targets. Related does not mean equivalent or substitutable.';

-- P235GH / 1.0345.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P235GH: materiale 1.0345, significato e norme collegate',
  seo_description='Guida al P235GH / 1.0345: significato della designazione, impieghi in pressione a temperatura elevata e collegamenti osservati con EN 10216-2 ed EN 10217-2.',
  intro='P235GH, numero materiale 1.0345, è un grado europeo per prodotti destinati a impieghi in pressione con proprietà specificate a temperatura elevata. Nelle gamme tecniche osservate compare sia nel mondo dei tubi senza saldatura EN 10216-2 sia in quello dei tubi saldati EN 10217-2; la norma di fornitura deve però essere sempre indicata separatamente.',
  designation_explanation='La lettera P identifica la famiglia degli acciai per impieghi in pressione. Il numero 235 richiama il livello di resistenza usato nella designazione del grado, mentre GH distingue un materiale previsto per servizio con proprietà specificate a temperatura elevata. I valori meccanici effettivi non vanno dedotti dalla sola sigla: dipendono dalla norma di prodotto, dallo spessore, dalla condizione di fornitura e dagli altri requisiti applicabili.',
  typical_applications='P235GH viene incontrato in tubazioni e componenti per pressione, generazione di calore e processi industriali nei quali il materiale deve essere specificato insieme alla norma di prodotto e alle condizioni di esercizio. La pagina descrive il contesto del grado, non dimensiona il componente né sostituisce la verifica progettuale.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','P235GH non identifica da solo il tubo',
      'body','La designazione definisce il materiale, non l’intero prodotto. Un ordine tecnico dovrebbe mantenere separati almeno grado, norma di fornitura, processo produttivo, dimensioni e documentazione richiesta. Per questo P235GH può essere associato a più contesti di tubo senza che tali prodotti diventino automaticamente intercambiabili.'
    ),
    jsonb_build_object(
      'heading','P235GH e P265GH: stessa famiglia, grado diverso',
      'body','P235GH e P265GH appartengono alla stessa famiglia di acciai per pressione a temperatura elevata, ma sono designazioni distinte. Il numero nella sigla segnala un diverso livello di resistenza di riferimento; una sostituzione richiede sempre verifica tecnica e documentale.'
    ),
    jsonb_build_object(
      'heading','Come leggere il numero materiale 1.0345',
      'body','Il numero 1.0345 è un identificatore materiale utile per disambiguare il grado nei documenti tecnici e commerciali. Non sostituisce però la norma di prodotto né dimostra, da solo, che due prodotti siano equivalenti.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che materiale è P235GH?',
      'answer','È un grado europeo per impieghi in pressione con proprietà specificate a temperatura elevata; il numero materiale associato in questo catalogo è 1.0345.'
    ),
    jsonb_build_object(
      'question','P235GH è sempre EN 10216-2?',
      'answer','No. Il grado e la norma sono informazioni distinte. Nelle fonti tecniche osservate P235GH compare anche in gamme relative a EN 10217-2.'
    ),
    jsonb_build_object(
      'question','P235GH e P265GH sono equivalenti?',
      'answer','No. Sono gradi distinti della stessa famiglia. Qualunque sostituzione richiede verifica della norma, dei requisiti meccanici e delle condizioni di progetto.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Tenaris — pressure tube product range',
      'publisher','Tenaris',
      'url','https://www.tenaris.com/en/products-and-services/power-generation',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','Brütsch/Rüegger Metals — P235GH / 1.0345 live catalog',
      'publisher','Brütsch/Rüegger Metals AG',
      'url','https://www.brr.ch/en/catalog/seamless-heavy-wall-tubes-and-hollow-bars-OXMMo6qyndJ',
      'status','Gamma fornitore; riferimento commerciale indipendente'
    ),
    jsonb_build_object(
      'label','UNI EN 10216-2:2024 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10216-2-2024',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p265gh','16mo3']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P235GH'
  and g.material_number='1.0345';

-- P265GH / 1.0425.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P265GH: materiale 1.0425, significato e norme collegate',
  seo_description='Guida al P265GH / 1.0425: cosa significa la sigla, uso nei tubi per pressione a temperatura elevata e collegamenti con EN 10216-2 ed EN 10217-2.',
  intro='P265GH, numero materiale 1.0425, è un grado europeo per impieghi in pressione con proprietà specificate a temperatura elevata. È frequente nel mercato dei tubi per energia e processo, ma deve sempre essere specificato insieme alla norma di prodotto e al processo produttivo richiesto.',
  designation_explanation='P colloca il materiale nella famiglia degli acciai per impieghi in pressione. Il numero 265 esprime il livello di resistenza usato nella designazione, mentre GH identifica il contesto delle proprietà a temperatura elevata. La sigla non è una scorciatoia per ricavare tutte le caratteristiche meccaniche: i valori applicabili vanno letti nella corretta norma di prodotto e in funzione delle dimensioni e della condizione di fornitura.',
  typical_applications='P265GH è utilizzato in specifiche per tubazioni, componenti e circuiti in pressione destinati a impianti energetici, termici e di processo. La selezione effettiva richiede la combinazione corretta di norma, dimensioni, processo, temperatura e pressione di progetto.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','P265GH può comparire in prodotti differenti',
      'body','Le fonti del catalogo mostrano P265GH in gamme seamless riferite a EN 10216-2 e in gamme saldate riferite a EN 10217-2. Questo non rende i due prodotti equivalenti: il processo produttivo e la norma restano parte essenziale della specifica.'
    ),
    jsonb_build_object(
      'heading','P235GH oppure P265GH?',
      'body','Le due designazioni appartengono alla stessa famiglia applicativa ma hanno un diverso livello di resistenza di riferimento. La scelta non va fatta soltanto sul numero più alto: deve seguire i requisiti progettuali e la norma applicabile.'
    ),
    jsonb_build_object(
      'heading','Il numero materiale 1.0425',
      'body','1.0425 è l’identificatore materiale associato a P265GH nel sistema europeo. È utile per normalizzare cataloghi, offerte e certificati, ma non sostituisce la specifica della norma di prodotto.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che materiale è P265GH?',
      'answer','È un grado europeo per impieghi in pressione con proprietà specificate a temperatura elevata; il numero materiale associato è 1.0425.'
    ),
    jsonb_build_object(
      'question','P265GH può essere fornito saldato e senza saldatura?',
      'answer','Il grado compare in gamme commerciali relative sia a tubi seamless sia a tubi saldati. Per stabilire il prodotto conforme occorre verificare la specifica norma di fornitura.'
    ),
    jsonb_build_object(
      'question','P265GH è equivalente a P235GH?',
      'answer','No. Sono materiali distinti. La loro appartenenza alla stessa famiglia non autorizza una sostituzione automatica.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Tenaris — EN 10216-2 pressure tube grades',
      'publisher','Tenaris',
      'url','https://www.tenaris.com/en/products-and-services/power-generation',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','ArcelorMittal Tubular Products Europe — industrial product ranges',
      'publisher','ArcelorMittal',
      'url','https://constructalia.arcelormittal.com/files/2018_AMTP_Industrial%20business%20unit--f60f43f530ca5cadb7b4e3b2abda0059.pdf',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10216-2:2024 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10216-2-2024',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p235gh','16mo3']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P265GH'
  and g.material_number='1.0425';

-- 16Mo3 / 1.5415.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='16Mo3: materiale 1.5415 per pressione e temperatura elevata',
  seo_description='Guida al 16Mo3 / 1.5415: acciaio legato al molibdeno, significato della designazione, impiego a temperatura elevata e collegamento con EN 10216-2.',
  intro='16Mo3, numero materiale 1.5415, è un acciaio legato al molibdeno utilizzato in prodotti per pressione quando sono richieste proprietà a temperatura elevata. A differenza delle designazioni P235GH e P265GH, la sua sigla appartiene a una logica di denominazione basata sulla composizione del materiale.',
  designation_explanation='16Mo3 è una designazione di tipo composizionale: segnala un acciaio legato in cui il molibdeno è un elemento caratterizzante. La sigla non va interpretata come un valore diretto di pressione o temperatura ammissibile. Le prestazioni effettive dipendono dalla norma di prodotto, dalla condizione di fornitura, dallo spessore e dai requisiti progettuali.',
  typical_applications='16Mo3 è tipicamente considerato per tubazioni e componenti in pressione esposti a temperatura elevata, come parti di impianti energetici, caldaie, scambiatori e circuiti di processo. La pagina descrive il posizionamento del grado, non i limiti di progetto del componente.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Perché 16Mo3 è diverso da un grado P…GH',
      'body','P235GH e P265GH sono designazioni orientate alla famiglia applicativa e al livello di resistenza; 16Mo3 usa invece una designazione legata alla composizione chimica. Confrontarli richiede quindi la norma di prodotto e i requisiti di servizio, non soltanto la sigla.'
    ),
    jsonb_build_object(
      'heading','Il ruolo del molibdeno',
      'body','Il molibdeno è l’elemento di lega che caratterizza questa famiglia di materiale ed è coerente con l’impiego in condizioni di temperatura elevata. Steel Knowledge evita però di trasformare la designazione in una tabella di proprietà: i valori vincolanti restano quelli della norma e del certificato del materiale.'
    ),
    jsonb_build_object(
      'heading','16Mo3 nei tubi EN 10216-2',
      'body','Nel catalogo tecnico osservato 16Mo3 compare in gamme di tubi seamless riferite a EN 10216-2. L’associazione è utile per la discovery commerciale, ma viene mantenuta come evidenza di gamma e non come dichiarazione normativa completa.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che materiale è 16Mo3?',
      'answer','È un acciaio legato al molibdeno, numero materiale 1.5415, utilizzato in applicazioni per pressione e temperatura elevata.'
    ),
    jsonb_build_object(
      'question','16Mo3 è uguale a P265GH?',
      'answer','No. Sono gradi distinti, con logiche di designazione e composizione diverse. La scelta dipende dalla norma e dai requisiti di progetto.'
    ),
    jsonb_build_object(
      'question','16Mo3 è collegato a EN 10216-2?',
      'answer','Nel catalogo Steel Knowledge esistono evidenze di gamma per 16Mo3 in tubi seamless EN 10216-2; la conformità del singolo prodotto va verificata sulla documentazione applicabile.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Tenaris — EN 10216-2 pressure tube grades',
      'publisher','Tenaris',
      'url','https://www.tenaris.com/en/products-and-services/power-generation',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10216-2:2024 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10216-2-2024',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p235gh','p265gh']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='16Mo3'
  and g.material_number='1.5415';

-- P235TR1 / 1.0254.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P235TR1: materiale 1.0254 per tubi in pressione',
  seo_description='Guida al P235TR1 / 1.0254: significato della designazione TR1, impieghi a temperatura ambiente e collegamenti osservati con EN 10216-1 ed EN 10217-1.',
  intro='P235TR1, numero materiale 1.0254, è un grado di acciaio non legato per tubi destinati a impieghi in pressione con proprietà specificate a temperatura ambiente. Il suffisso TR1 identifica una qualità prevista nel contesto delle norme di prodotto e deve essere conservato integralmente nella specifica.',
  designation_explanation='P identifica la famiglia per impieghi in pressione; 235 è il livello di resistenza richiamato dalla designazione; TR1 identifica una specifica qualità del grado. TR1 non va eliminato né interpretato come un dettaglio commerciale opzionale: fa parte dell’identità tecnica del materiale nel relativo contesto normativo.',
  typical_applications='P235TR1 compare in gamme di tubi per pressione a temperatura ambiente, sia seamless sia saldati secondo il contesto di prodotto osservato. La scelta tra processi e norme differenti richiede una specifica tecnica completa.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','TR1 è parte della designazione',
      'body','Scrivere soltanto P235 perde informazione. Il suffisso TR1 distingue la qualità prevista nella norma di prodotto e deve quindi comparire in offerte, ordini e certificati quando è richiesto.'
    ),
    jsonb_build_object(
      'heading','Seamless e saldato non sono la stessa fornitura',
      'body','Le evidenze del catalogo collegano P235TR1 sia a gamme EN 10216-1 seamless sia a gamme EN 10217-1 saldate. La presenza dello stesso grado non rende equivalenti i due processi produttivi.'
    ),
    jsonb_build_object(
      'heading','P235TR1 e P235TR2',
      'body','TR1 e TR2 sono qualità distinte. Non vanno trattate come abbreviazioni intercambiabili e qualunque cambio deve essere verificato rispetto alla norma e ai requisiti dell’ordine.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che cos’è P235TR1?',
      'answer','È un grado non legato per tubi in pressione a temperatura ambiente, identificato dal numero materiale 1.0254.'
    ),
    jsonb_build_object(
      'question','P235TR1 e P235TR2 sono la stessa cosa?',
      'answer','No. Sono qualità distinte e il suffisso TR1/TR2 deve essere mantenuto nella specifica.'
    ),
    jsonb_build_object(
      'question','P235TR1 può comparire sia su tubi saldati sia senza saldatura?',
      'answer','Le fonti commerciali osservate mostrano il grado in entrambi i contesti; la conformità dipende dalla specifica norma di prodotto.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Metal Service Zwevegem — EN 10216 pressure tube overview',
      'publisher','Metal Service Zwevegem',
      'url','https://www.msz.be/upload/file/10216fr.pdf',
      'status','Gamma fornitore; non normativa completa'
    ),
    jsonb_build_object(
      'label','Metal Service Zwevegem — EN 10217 welded pressure tube overview',
      'publisher','Metal Service Zwevegem',
      'url','https://www.msz.be/upload/file/10217fr.pdf',
      'status','Gamma fornitore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10217-1:2019 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10217-1-2019',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p235tr2','p265tr1']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P235TR1'
  and g.material_number='1.0254';

-- P235TR2 / 1.0255.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P235TR2: materiale 1.0255 e qualità TR2',
  seo_description='Guida al P235TR2 / 1.0255: significato della qualità TR2, utilizzo nei tubi per pressione a temperatura ambiente e collegamento con EN 10217-1.',
  intro='P235TR2, numero materiale 1.0255, è una designazione per tubi in pressione a temperatura ambiente nella quale il suffisso TR2 identifica una qualità specifica. Le evidenze del catalogo la collegano a gamme produttore EN 10217-1 saldate.',
  designation_explanation='La parte P235 segue la logica dei gradi per impieghi in pressione, mentre TR2 identifica una qualità distinta da TR1. Steel Knowledge non riduce TR1 e TR2 a una gerarchia commerciale: la differenza va letta nella norma di prodotto e mantenuta nella documentazione tecnica.',
  typical_applications='P235TR2 viene incontrato in specifiche di tubi saldati per pressione a temperatura ambiente. Il grado deve essere associato alla norma, al processo, alle dimensioni e alla documentazione richiesta dal progetto.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Perché non basta scrivere P235',
      'body','TR2 fa parte della designazione completa. Ometterlo può rendere ambigua la specifica e impedire di capire quale qualità sia stata richiesta o certificata.'
    ),
    jsonb_build_object(
      'heading','P235TR2 nel contesto EN 10217-1',
      'body','Una fonte primaria di produttore collega P235TR2 / 1.0255 a tubi saldati EN 10217-1. Questo supporta la discovery della combinazione ma non sostituisce il controllo della norma e del certificato del singolo lotto.'
    ),
    jsonb_build_object(
      'heading','Confronto con P235TR1',
      'body','I due gradi condividono la base P235 ma hanno qualità differenti. Per questo il motore Knowledge li collega come materiali correlati, non come equivalenti.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Qual è il numero materiale di P235TR2?',
      'answer','Nel catalogo Steel Knowledge P235TR2 è associato al numero materiale 1.0255.'
    ),
    jsonb_build_object(
      'question','TR2 significa che posso sostituire TR1?',
      'answer','No. TR1 e TR2 sono qualità distinte e la sostituzione deve essere verificata rispetto alla norma e al progetto.'
    ),
    jsonb_build_object(
      'question','A quale norma è collegato P235TR2?',
      'answer','Le evidenze attuali del catalogo lo collegano a gamme produttore EN 10217-1 per tubi saldati.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Mannesmann — EN 10217-1 material references',
      'publisher','Mannesmann',
      'url','https://www.mannesmann.com/en/knowledge/standards-materials/hfi-welded-steel-pipes/en-10217-1.html',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10217-1:2019 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10217-1-2019',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p235tr1','p265tr2']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P235TR2'
  and g.material_number='1.0255';

-- P265TR1 / 1.0258.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P265TR1: materiale 1.0258 per tubi in pressione',
  seo_description='Guida al P265TR1 / 1.0258: significato della designazione, qualità TR1, uso a temperatura ambiente e collegamenti osservati con EN 10216-1 ed EN 10217-1.',
  intro='P265TR1, numero materiale 1.0258, è un grado non legato per tubi destinati a impieghi in pressione con proprietà specificate a temperatura ambiente. La sigla combina la famiglia P, il livello 265 e la qualità TR1.',
  designation_explanation='P identifica l’impiego in pressione, 265 richiama il livello di resistenza della designazione e TR1 identifica la qualità prevista dalla norma di prodotto. I requisiti meccanici effettivi e le prove applicabili devono essere letti nel documento normativo corretto e nella documentazione di fornitura.',
  typical_applications='P265TR1 compare in gamme per tubi in pressione a temperatura ambiente e può essere incontrato sia in contesti seamless sia saldati. La selezione effettiva dipende dalla norma e dal processo richiesto.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','P265TR1 e P235TR1',
      'body','Le due designazioni condividono la qualità TR1 ma differiscono nel livello di resistenza richiamato dalla sigla. Steel Knowledge le presenta come materiali correlati, non come sostituti automatici.'
    ),
    jsonb_build_object(
      'heading','La norma resta indispensabile',
      'body','P265TR1 non identifica da solo se il tubo è saldato o senza saldatura. Le evidenze di catalogo collegano il grado a più contesti di prodotto; l’ordine deve quindi specificare anche la norma e il processo.'
    ),
    jsonb_build_object(
      'heading','Numero materiale 1.0258',
      'body','Il numero materiale aiuta a normalizzare dati provenienti da offerte e certificati. Non elimina però la necessità di verificare il suffisso TR1 e la norma di riferimento.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che materiale è P265TR1?',
      'answer','È un grado non legato per tubi in pressione a temperatura ambiente, numero materiale 1.0258.'
    ),
    jsonb_build_object(
      'question','P265TR1 è uguale a P265TR2?',
      'answer','No. TR1 e TR2 identificano qualità distinte della designazione.'
    ),
    jsonb_build_object(
      'question','Il grado definisce se il tubo è saldato?',
      'answer','No. Il processo produttivo deve essere verificato nella norma e nella specifica del prodotto.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Metal Service Zwevegem — EN 10216 pressure tube overview',
      'publisher','Metal Service Zwevegem',
      'url','https://www.msz.be/upload/file/10216fr.pdf',
      'status','Gamma fornitore; non normativa completa'
    ),
    jsonb_build_object(
      'label','Metal Service Zwevegem — EN 10217 welded pressure tube overview',
      'publisher','Metal Service Zwevegem',
      'url','https://www.msz.be/upload/file/10217fr.pdf',
      'status','Gamma fornitore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10217-1:2019 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10217-1-2019',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p265tr2','p235tr1']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P265TR1'
  and g.material_number='1.0258';

-- P265TR2 / 1.0259.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P265TR2: materiale 1.0259 e qualità TR2',
  seo_description='Guida al P265TR2 / 1.0259: significato della qualità TR2, uso nei tubi saldati per pressione a temperatura ambiente e collegamento con EN 10217-1.',
  intro='P265TR2, numero materiale 1.0259, è un grado per tubi in pressione a temperatura ambiente nel quale TR2 identifica una qualità specifica. Le evidenze del catalogo lo collegano a gamme produttore EN 10217-1 saldate.',
  designation_explanation='P indica la famiglia per pressione, 265 il livello di resistenza della designazione e TR2 la qualità del materiale nel contesto della norma di prodotto. La qualità TR2 non deve essere confusa con TR1 né omessa nelle specifiche tecniche.',
  typical_applications='P265TR2 è utilizzato in specifiche di tubi saldati per pressione a temperatura ambiente quando il progetto richiede la relativa qualità. Processo, norma, dimensioni e certificazione restano parte della definizione del prodotto.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','P265TR2 e P265TR1',
      'body','Le due designazioni condividono la base P265 ma differiscono nella qualità TR. Il catalogo le collega per facilitare il confronto, senza suggerire equivalenza o sostituibilità.'
    ),
    jsonb_build_object(
      'heading','Collegamento osservato con EN 10217-1',
      'body','Una fonte primaria di produttore associa P265TR2 / 1.0259 a tubi saldati EN 10217-1. La relazione è esposta come gamma produttore e non come pretesa di completezza normativa.'
    ),
    jsonb_build_object(
      'heading','Perché il numero materiale aiuta',
      'body','1.0259 permette di distinguere P265TR2 da designazioni vicine nei sistemi informativi, negli ordini e nei certificati. Resta comunque necessario leggere l’intero contesto tecnico.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Qual è il numero materiale di P265TR2?',
      'answer','Il numero materiale associato nel catalogo è 1.0259.'
    ),
    jsonb_build_object(
      'question','P265TR2 è equivalente a P265TR1?',
      'answer','No. Sono qualità differenti e non devono essere sostituite automaticamente.'
    ),
    jsonb_build_object(
      'question','Dove compare P265TR2?',
      'answer','Le evidenze attuali lo collegano a gamme produttore di tubi saldati EN 10217-1.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','Mannesmann — EN 10217-1 material references',
      'publisher','Mannesmann',
      'url','https://www.mannesmann.com/en/knowledge/standards-materials/hfi-welded-steel-pipes/en-10217-1.html',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10217-1:2019 — contesto norma di prodotto',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10217-1-2019',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['p265tr1','p235tr2']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P265TR2'
  and g.material_number='1.0259';

-- S355J2H / 1.0576.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='S355J2H: materiale 1.0576 per profilati cavi strutturali',
  seo_description='Guida al S355J2H / 1.0576: significato di S355 J2 H, uso nei profilati cavi e collegamenti osservati con EN 10210 ed EN 10219.',
  intro='S355J2H, numero materiale 1.0576, è un grado strutturale molto diffuso nel mondo dei profilati cavi. Le gamme produttore osservate lo collegano sia a prodotti finiti a caldo EN 10210 sia a prodotti formati a freddo EN 10219, mostrando perché il grado da solo non identifica il processo di fabbricazione.',
  designation_explanation='S identifica un acciaio strutturale; 355 richiama il livello di snervamento usato nella designazione; J2 identifica una classe di resilienza; H indica l’impiego come profilato cavo. I requisiti esatti dipendono dalla norma, dallo spessore e dalla condizione del prodotto.',
  typical_applications='S355J2H è utilizzato in profilati cavi per carpenteria e strutture metalliche, telai, colonne, travature ed elementi portanti. La progettazione deve considerare norma di prodotto, processo, geometria e requisiti di esecuzione.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Stesso grado, due famiglie di prodotto',
      'body','Nelle gamme del produttore S355J2H compare sia con EN 10210 sia con EN 10219. Questo è un esempio utile: la designazione del materiale può essere comune, mentre il processo e la norma di prodotto restano differenti.'
    ),
    jsonb_build_object(
      'heading','Che cosa aggiunge il suffisso H',
      'body','H segnala il contesto dei profilati cavi. Conservare il suffisso è importante per evitare di confondere la designazione con gradi strutturali simili destinati ad altre forme di prodotto.'
    ),
    jsonb_build_object(
      'heading','S355J2H, S355NH e S355NLH',
      'body','Questi gradi condividono il livello S355 e l’impiego nei profilati cavi, ma appartengono a classi e condizioni differenti. Steel Knowledge li collega per confronto senza considerarli equivalenti.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Cosa significa S355J2H?',
      'answer','È una designazione strutturale: S identifica l’uso strutturale, 355 il livello di resistenza della designazione, J2 una classe di resilienza e H il contesto dei profilati cavi.'
    ),
    jsonb_build_object(
      'question','S355J2H è EN 10210 o EN 10219?',
      'answer','Il grado compare in gamme produttore relative a entrambe le famiglie. La norma e il processo devono essere specificati separatamente.'
    ),
    jsonb_build_object(
      'question','Qual è il numero materiale di S355J2H?',
      'answer','Nel catalogo Steel Knowledge è associato al numero materiale 1.0576.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','ArcelorMittal — Steel Hollow Sections product range',
      'publisher','ArcelorMittal',
      'url','https://projects.arcelormittal.com/energy/products-services/product-range/hollow-sections',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10210-1:2006 — contesto profilati finiti a caldo',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10210-1-2006',
      'status','Riferimento ufficiale della norma'
    ),
    jsonb_build_object(
      'label','UNI EN 10219-1:2006 — contesto profilati formati a freddo',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10219-1-2006',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['s355nh','s355nlh']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='S355J2H'
  and g.material_number='1.0576';

-- S355NH / 1.0539.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='S355NH: materiale 1.0539 per profilati cavi strutturali',
  seo_description='Guida al S355NH / 1.0539: acciaio strutturale a grano fine, significato della designazione e collegamento osservato con profilati cavi EN 10210.',
  intro='S355NH, numero materiale 1.0539, è un grado strutturale a grano fine per profilati cavi, associato a condizioni normalizzate o normalizzate mediante laminazione. Nel catalogo osservato compare in gamme di profilati finiti a caldo EN 10210.',
  designation_explanation='S identifica l’impiego strutturale e 355 il livello di resistenza della designazione. N appartiene alla famiglia dei gradi a grano fine forniti in condizione normalizzata o normalizzata mediante laminazione; H identifica il contesto dei profilati cavi. I requisiti completi devono essere letti nella norma di prodotto.',
  typical_applications='S355NH è impiegato in profilati cavi strutturali quando il progetto richiede una combinazione di resistenza, tenacità e condizione di fornitura coerente con la famiglia a grano fine. La selezione finale dipende dalla norma e dal progetto strutturale.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','S355NH non è una variante grafica di S355J2H',
      'body','La presenza della stessa base S355 non rende i gradi equivalenti. NH appartiene a una diversa famiglia di condizione e proprietà; il confronto deve quindi avvenire attraverso la norma e i requisiti del progetto.'
    ),
    jsonb_build_object(
      'heading','Perché la lettera H resta importante',
      'body','H mantiene esplicito il riferimento ai profilati cavi. È un’informazione utile per distinguere il materiale da designazioni simili impiegate in altre forme di prodotto.'
    ),
    jsonb_build_object(
      'heading','S355NH e S355NLH',
      'body','I due gradi appartengono alla stessa famiglia a grano fine per profilati cavi ma hanno classi di tenacità differenti. Steel Knowledge li collega come materiali vicini, non come sostituti.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che materiale è S355NH?',
      'answer','È un grado strutturale a grano fine per profilati cavi, numero materiale 1.0539.'
    ),
    jsonb_build_object(
      'question','S355NH è uguale a S355J2H?',
      'answer','No. Condividono il livello S355 e l’uso strutturale, ma appartengono a famiglie e condizioni differenti.'
    ),
    jsonb_build_object(
      'question','A quale norma è collegato S355NH nel catalogo?',
      'answer','Le evidenze osservate lo collegano a gamme produttore di profilati cavi finiti a caldo EN 10210.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','ArcelorMittal — Steel Hollow Sections product range',
      'publisher','ArcelorMittal',
      'url','https://projects.arcelormittal.com/energy/products-services/product-range/hollow-sections',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10210-1:2006 — contesto profilati finiti a caldo',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10210-1-2006',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['s355nlh','s355j2h']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='S355NH'
  and g.material_number='1.0539';

-- S355NLH / 1.0549.
update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='S355NLH: materiale 1.0549 e tenacità a bassa temperatura',
  seo_description='Guida al S355NLH / 1.0549: grado strutturale a grano fine per profilati cavi, significato del suffisso NLH e collegamento osservato con EN 10210.',
  intro='S355NLH, numero materiale 1.0549, è un grado strutturale a grano fine per profilati cavi, appartenente alla famiglia normalizzata o normalizzata mediante laminazione e con una classe di tenacità destinata a condizioni di temperatura più severe rispetto a S355NH.',
  designation_explanation='S identifica l’impiego strutturale, 355 il livello di resistenza della designazione, N la famiglia normalizzata/normalizzata mediante laminazione, L distingue la classe di tenacità a temperatura più bassa e H il contesto dei profilati cavi. I valori esatti e le condizioni di prova devono essere verificati nella norma applicabile.',
  typical_applications='S355NLH è considerato per profilati cavi strutturali quando, oltre alla resistenza, il progetto richiede una specifica attenzione alla tenacità a bassa temperatura. La selezione dipende dalle condizioni ambientali e dai requisiti strutturali.',
  editorial_sections=jsonb_build_array(
    jsonb_build_object(
      'heading','Che cosa cambia rispetto a S355NH',
      'body','S355NH e S355NLH condividono la famiglia a grano fine e il livello S355, ma NLH identifica una classe di tenacità differente. La differenza non va ridotta a un semplice suffisso commerciale.'
    ),
    jsonb_build_object(
      'heading','Il contesto EN 10210',
      'body','Le evidenze del catalogo associano S355NLH a gamme di profilati cavi finiti a caldo EN 10210. Il dato è presentato come gamma produttore e non come ricostruzione completa del campo normativo.'
    ),
    jsonb_build_object(
      'heading','Quando il clima diventa parte della specifica',
      'body','Per strutture destinate a temperature ambientali più severe, la classe di tenacità può diventare un requisito centrale. La scelta deve provenire dal progetto e dalla norma, non da una sostituzione automatica tra sigle simili.'
    )
  ),
  faq=jsonb_build_array(
    jsonb_build_object(
      'question','Che materiale è S355NLH?',
      'answer','È un grado strutturale a grano fine per profilati cavi, numero materiale 1.0549, con una classe di tenacità per condizioni di temperatura più severe.'
    ),
    jsonb_build_object(
      'question','S355NLH e S355NH sono equivalenti?',
      'answer','No. Sono gradi correlati ma con classi di tenacità differenti.'
    ),
    jsonb_build_object(
      'question','A quale famiglia di norme è collegato S355NLH?',
      'answer','Le evidenze attuali del catalogo lo collegano a gamme produttore EN 10210 per profilati cavi finiti a caldo.'
    )
  ),
  source_references=jsonb_build_array(
    jsonb_build_object(
      'label','ArcelorMittal — Steel Hollow Sections product range',
      'publisher','ArcelorMittal',
      'url','https://projects.arcelormittal.com/energy/products-services/product-range/hollow-sections',
      'status','Gamma produttore; non normativa completa'
    ),
    jsonb_build_object(
      'label','UNI EN 10210-1:2006 — contesto profilati finiti a caldo',
      'publisher','UNI',
      'url','https://store.uni.com/en/uni-en-10210-1-2006',
      'status','Riferimento ufficiale della norma'
    )
  ),
  related_grade_slugs=array['s355nh','s355j2h']::text[],
  editorial_version=4,
  published_at=coalesce(p.published_at,now()),
  last_reviewed_at='2026-09-28'::date,
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='S355NLH'
  and g.material_number='1.0549';

-- Expand the anonymous-safe grade list contract with freshness and search by
-- related standard code. Backing tables remain private.
drop function if exists public.k2_public_knowledge_grades(text,integer,integer);
create function public.k2_public_knowledge_grades(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  material_grade_id uuid,
  slug text,
  designation text,
  material_number text,
  standard_system text,
  material_family text,
  short_description text,
  seo_title text,
  seo_description text,
  related_standard_count integer,
  published_at timestamptz,
  last_reviewed_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    p.slug,
    g.designation,
    g.material_number,
    g.standard_system,
    g.material_family,
    g.short_description,
    p.seo_title,
    p.seo_description,
    (
      select count(distinct a.standard_id)::integer
      from public.steel_standard_grade_applicability a
      where a.material_grade_id=g.id
    ) as related_standard_count,
    p.published_at,
    p.last_reviewed_at
  from public.steel_knowledge_grade_pages p
  join public.steel_material_grades g on g.id=p.material_grade_id
  where p.page_status='published'
    and (
      nullif(btrim(coalesce(p_query,'')), '') is null
      or g.designation ilike '%' || btrim(p_query) || '%'
      or coalesce(g.material_number,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(g.short_description,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(p.seo_description,'') ilike '%' || btrim(p_query) || '%'
      or exists (
        select 1
        from public.steel_standard_grade_applicability a
        join public.steel_standards s on s.id=a.standard_id
        where a.material_grade_id=g.id
          and s.code ilike '%' || btrim(p_query) || '%'
      )
    )
  order by g.standard_system nulls last, g.designation_key, g.material_number_key, g.id
  limit greatest(1,least(coalesce(p_limit,100),250))
  offset greatest(0,coalesce(p_offset,0));
$$;

drop function if exists public.k2_public_knowledge_grade(text);
create function public.k2_public_knowledge_grade(
  p_slug text
)
returns table (
  material_grade_id uuid,
  slug text,
  designation text,
  material_number text,
  standard_system text,
  material_family text,
  density_kg_m3 numeric,
  short_description text,
  seo_title text,
  seo_description text,
  intro text,
  designation_explanation text,
  typical_applications text,
  editorial_sections jsonb,
  faq jsonb,
  related_standards jsonb,
  source_references jsonb,
  related_grade_pages jsonb,
  published_at timestamptz,
  last_reviewed_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    p.slug,
    g.designation,
    g.material_number,
    g.standard_system,
    g.material_family,
    g.density_kg_m3,
    g.short_description,
    p.seo_title,
    p.seo_description,
    p.intro,
    p.designation_explanation,
    p.typical_applications,
    p.editorial_sections,
    p.faq,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'standard_id', r.standard_id,
          'code', r.code,
          'title', r.title,
          'standard_system', r.standard_system,
          'applicability_type', r.applicability_type,
          'is_normative', r.applicability_type='normative',
          'manufacturing_processes', r.manufacturing_processes,
          'slug', r.public_slug
        )
        order by r.code
      )
      from (
        select
          s.id as standard_id,
          s.code,
          coalesce(sp.seo_title,s.title) as title,
          s.standard_system,
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
          sp.slug as public_slug
        from public.steel_standard_grade_applicability a
        join public.steel_standards s
          on s.id=a.standard_id
         and s.status='active'
        left join public.steel_knowledge_standard_pages sp
          on sp.standard_id=s.id
         and sp.page_status='published'
        where a.material_grade_id=g.id
        group by s.id,s.code,s.title,s.standard_system,sp.slug,sp.seo_title
      ) r
    ), '[]'::jsonb) as related_standards,
    p.source_references,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', gp.slug,
          'designation', rg.designation,
          'material_number', rg.material_number,
          'material_family', rg.material_family,
          'seo_title', gp.seo_title
        )
        order by rg.designation
      )
      from unnest(p.related_grade_slugs) as rel(slug)
      join public.steel_knowledge_grade_pages gp
        on gp.slug=rel.slug
       and gp.page_status='published'
      join public.steel_material_grades rg
        on rg.id=gp.material_grade_id
    ), '[]'::jsonb) as related_grade_pages,
    p.published_at,
    p.last_reviewed_at
  from public.steel_knowledge_grade_pages p
  join public.steel_material_grades g on g.id=p.material_grade_id
  where p.page_status='published'
    and p.slug=lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.k2_public_knowledge_grades(text,integer,integer)
  from public;
revoke all on function public.k2_public_knowledge_grade(text)
  from public;

grant execute on function public.k2_public_knowledge_grades(text,integer,integer)
  to anon, authenticated, service_role;
grant execute on function public.k2_public_knowledge_grade(text)
  to anon, authenticated, service_role;

comment on function public.k2_public_knowledge_grades(text,integer,integer) is
  'K4 public grade catalog list. Returns only editorially published grade pages, freshness and safe related-standard counts.';
comment on function public.k2_public_knowledge_grade(text) is
  'K4 public grade detail. Returns reviewed editorial copy, explicit evidence semantics, official/primary references and published related-grade links only.';

do $$
declare
  v_published integer;
begin
  select count(*) into v_published
  from public.steel_knowledge_grade_pages
  where page_status='published'
    and slug in (
      'p235gh','p265gh','16mo3',
      'p235tr1','p235tr2','p265tr1','p265tr2',
      's355j2h','s355nh','s355nlh'
    );

  if v_published<>10 then
    raise exception 'K4 expected ten published grade pages, got %',v_published;
  end if;

  if exists (
    select 1
    from public.steel_knowledge_grade_pages
    where page_status='published'
      and (
        last_reviewed_at is null
        or jsonb_array_length(source_references)=0
        or nullif(btrim(coalesce(seo_title,'')),'') is null
        or nullif(btrim(coalesce(intro,'')),'') is null
        or nullif(btrim(coalesce(designation_explanation,'')),'') is null
      )
  ) then
    raise exception 'K4 published grade editorial completeness regression';
  end if;
end
$$;
