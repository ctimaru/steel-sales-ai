/** BP-VISION1. Founder-only strategic source. Proposed milestones and fees are not traction. */
export const businessPlanVisionCopy = {
  "it": {
    "hero": {
      "eyebrow": "MASTERPLAN 2027 · 17 OTTOBRE 2026 · PROPOSTA STRATEGICA",
      "title": "Dalla richiesta al risultato.",
      "subtitle": "Smart Steel Sales evolve in uno Steel Intelligence & Procurement Operating System: capisce cosa serve, lo rende visuale e può accompagnare il cliente nella ricerca e nell'acquisto.",
      "thesis": "Descrivi ciò che ti serve. Smart Steel Sales lo organizza, trova le opportunità e ti aiuta a concludere.",
      "disclaimer": "Visione e piano di esecuzione: non rappresentano funzioni già tutte operative né risultati commerciali conseguiti."
    },
    "status": [
      [
        "Già implementato",
        "Calcolatori EN/USA, distinta inline, workflow RFQ Hub, Network con filtri geografici e connessioni professionali."
      ],
      [
        "Fondazione AI presente",
        "RFQAI3 utilizza Vercel AI Gateway e un contratto JSON per estrarre articoli; la riuscita della chiamata reale post-fix va ancora verificata."
      ],
      [
        "Da costruire",
        "Chat multi-turno collegata alla distinta, interrogazioni Network grounded, voce push-to-talk e gestione casi Super Steel Buyer."
      ]
    ],
    "pillars": [
      {
        "number": "01",
        "title": "AI · Smart Steel Intelligence",
        "subtitle": "Un assistente, tre contesti",
        "body": "Testo e voce diventano intenti e bozze di lavoro. Il modello interpreta; i motori siderurgici e il database restano le fonti di verità. Ogni azione con effetti commerciali richiede permessi e conferma.",
        "deliverables": [
          "Linguaggio naturale → righe di distinta",
          "Domande sul Network → query reali e filtri",
          "RFQ e acquisti → prossimo passo contestuale"
        ]
      },
      {
        "number": "02",
        "title": "Visual · Thought to Workflow",
        "subtitle": "Non una chat che racconta, una UI che agisce",
        "body": "La stessa conversazione aggiorna in tempo reale il workbench: distinta tecnica, mappa aziende, confronto offerte o timeline di acquisto. Mobile-first con continuità fra chat e oggetto visuale.",
        "deliverables": [
          "Vista simultanea chat + risultato",
          "Righe modificabili, totali e stati mancanti",
          "Mappe, liste e timeline senza navigazione dispersiva"
        ]
      },
      {
        "number": "03",
        "title": "Super Steel Buyer",
        "subtitle": "Software più competenza commerciale",
        "body": "Il cliente può affidare una richiesta a un team interno: qualificazione, ricerca fornitori, comparazione, proposta e coordinamento. Avvio come sourcing assistito; presa in carico fino alla consegna solo dopo processi e responsabilità contrattuali definite.",
        "deliverables": [
          "Dossier cliente + caso tracciabile",
          "Workbench operatori e offerte",
          "Pilot gestito con economia separata dal SaaS"
        ]
      }
    ],
    "example1": {
      "title": "Da una frase a una distinta utile",
      "prompt": "«Cerco 40 tubi a 3 metri EN 10219 S235»",
      "recognized": [
        "40 barre",
        "3 m ciascuna",
        "120 m lineari",
        "EN 10219",
        "S235 da precisare"
      ],
      "missing": [
        "Forma",
        "Dimensioni",
        "Spessore"
      ],
      "answer": "Ho preparato la bozza. Mi servono sezione, misure e spessore per calcolare il peso e finalizzare la richiesta.",
      "rule": "Mai inventare dimensioni, kg/m, conformità, disponibilità o prezzo. Il calcolo è sempre svolto dal motore tecnico esistente."
    },
    "example2": {
      "title": "Una domanda sul Network produce dati e una mappa",
      "prompt": "«Quanti commercianti ci sono in Piemonte?»",
      "answer": "Query read-only sulle aziende distinte pubblicate nel Network, con categoria, regione e stato dato. Il risultato mostra conteggio, filtri e mappa; non equivale alla numerosità complessiva del mercato.",
      "rule": "Non inventare conteggi. Non duplicare sedi come aziende. Nessun ritorno a Follow/Salva: solo connessioni professionali motivate."
    },
    "architecture": [
      [
        "Ingresso",
        "Testo, dettatura e successivamente file; consenso, autenticazione e limiti per tenant."
      ],
      [
        "Interpretazione",
        "Modello intercambiabile tramite Vercel AI Gateway; schema tipizzato intent/action, evidenze e missing fields."
      ],
      [
        "Tool execution",
        "Solo funzioni allowlisted: motore pesi, Distinta, Network read-only, RFQ Hub, Buyer Cases."
      ],
      [
        "Governance",
        "Verifiche server-side RBAC/RLS, niente invio/award/ordine automatici, audit e protezione dati."
      ],
      [
        "Risultato",
        "Oggetto visuale modificabile + risposta contestuale + prossima azione eseguibile."
      ]
    ],
    "model": {
      "title": "Motore AI economicamente sostenibile",
      "baseline": "Preservare il Gateway esistente, verificare Qwen3 14B già previsto come baseline e confrontarlo con uno o due piccoli modelli a output strutturato. La qualità sui casi steel prevale sul costo per token.",
      "variants": [
        "Modello compatto per estrazione e classificazione",
        "Fallback per dialoghi complessi e casi ambigui",
        "Speech-to-text a consumo per voce push-to-talk"
      ],
      "constraints": [
        "100+ richieste steel di benchmark",
        "Budget e quote distribuite per azienda",
        "Costi per distinta completata, non solo per prompt",
        "Privacy del testo commerciale, regioni e DPA da verificare"
      ],
      "note": "Nessun training di un modello proprietario o infrastruttura GPU nella fase iniziale."
    },
    "buyer": {
      "title": "Super Steel Buyer · modello operativo",
      "stages": [
        "Richiesta",
        "Qualifica",
        "Ricerca fornitori",
        "Confronto",
        "Proposta al cliente",
        "Accettazione",
        "Coordinamento",
        "Chiusura"
      ],
      "boundaries": [
        "Fase 1: sourcing e consulenza con responsabilità definite.",
        "Fase 2: coordinamento ordine e consegna solo a condizioni contrattuali accettate.",
        "Nessun auto-award, acquisto o obbligo di consegna senza approvazione e processo."
      ],
      "monetization": [
        [
          "Success fee",
          "Ipotesi 1,5–3% del valore acquistato, minimo da validare."
        ],
        [
          "Fee di ricerca",
          "Ipotesi €99–€299 per pratica qualificata, anche a credito della fee finale."
        ],
        [
          "Buyer membership",
          "Canone/crediti per acquisti ricorrenti, dopo evidenza di domanda."
        ]
      ],
      "unitExample": "Esempio esplorativo: ordine €15.000 × 2% = €300. Quattro ore di lavoro a €35/h = €140; restano €160 prima dei costi indiretti, acquisizione, pratiche perse e imposte. Non è un forecast.",
      "pilot": "Pilot iniziale: 5–10 pratiche reali con worklog, win rate, supplier response, tempo di proposta e margine di contribuzione per richiesta."
    },
    "business": [
      [
        "Free",
        "Calcolatrice, distinta, accesso Network di base e modalità AI limitate: acquisizione, attivazione, densità aziende."
      ],
      [
        "Pro / Team",
        "Quote AI maggiori, discovery avanzata, memoria, RFQ/collaborazione e analytics: SaaS ricorrente."
      ],
      [
        "Super Steel Buyer",
        "Ricavo da servizio di sourcing, success fee o piano dedicato; P&L e SLA separati dal SaaS."
      ]
    ],
    "roadmap": [
      [
        "SSAI0",
        "Production AI baseline & benchmark",
        "Chiamata reale funzionante, telemetria e limiti di spesa."
      ],
      [
        "SSAI1",
        "Intents, tool contracts & security",
        "Assistente unico, JSON tipizzato, autorizzazioni controllate."
      ],
      [
        "SSAI2",
        "Visual Calculator Copilot",
        "Frase → bozza → campi mancanti → distinta vera."
      ],
      [
        "SSAI3",
        "Network Grounded Assistant",
        "Query verificate, conteggi azienda, mappa e filtri."
      ],
      [
        "SSAI4",
        "Voice push-to-talk",
        "Trascrizione correggibile e stesso flusso text-to-action."
      ],
      [
        "SSB1",
        "Buyer case intake",
        "Modulo presa in carico, dossier e stati operatori."
      ],
      [
        "SSB2",
        "Procurement workbench",
        "Shortlist, proposte, approvazioni, riuso RFQ Hub."
      ],
      [
        "SSB3",
        "Concierge pilot",
        "5–10 casi, costi ore, conversione e marginalità misurati."
      ],
      [
        "SSGO1",
        "BP v3 & launch gate",
        "Pricing, privacy, qualità, go/no-go e roadmap 2027."
      ]
    ],
    "kpis": [
      [
        "Affidabilità tecnica",
        "≥90% di estrazioni corrette sul benchmark, 0 invenzioni critiche tollerate."
      ],
      [
        "Grounding Network",
        "100% conteggi da query e stato copertura dichiarato."
      ],
      [
        "Governance",
        "0 invii supplier o azioni commerciali irreversibili senza conferma."
      ],
      [
        "Conversione",
        "Richiesta → bozza → distinta completata → RFQ o Buyer intake."
      ],
      [
        "Economia AI",
        "Costo per sessione riuscita, per distinta e per azienda attiva."
      ],
      [
        "Economia Buyer",
        "Costo per caso aperto/vinto, win rate, tempi e margine di contribuzione."
      ]
    ],
    "risks": [
      [
        "Qualità",
        "AI non sostituisce il calcolo o la verifica normativa; test con geometrie e unità ambigue."
      ],
      [
        "Privacy",
        "Separazione Commercial Memory privata/Network, DPA, dati vocali e retention."
      ],
      [
        "Automazione",
        "Servizi di sola lettura o bozze per default; azioni esterne con conferma."
      ],
      [
        "Costi",
        "Budget Gateway e quote tenant, telemetria, fallback manuale."
      ],
      [
        "Responsabilità Buyer",
        "Mandato, fatturazione, qualità, Incoterm, trasporti e reclami da definire."
      ],
      [
        "Strategia",
        "Prezzario e TAM/SAM/SOM rimangono ipotesi finché non validati."
      ]
    ],
    "references": [
      [
        "Masterplan audit",
        "https://app.notion.com/p/3e6f059cecb581539311d7b014bfa537"
      ],
      [
        "RFQ AI - architettura",
        "https://github.com/ctimaru/steel-sales-ai/blob/main/docs/architecture/rfqai3-free-text-intelligence.md"
      ],
      [
        "Gateway - incidente e acceptance",
        "https://github.com/ctimaru/steel-sales-ai/blob/main/docs/architecture/rfqai3-1-gateway-diagnostics.md"
      ],
      [
        "RFQ Hub",
        "https://app.notion.com/p/3f1f059cecb58182b887e37f7a795f2f"
      ],
      [
        "Business Model v2",
        "https://app.notion.com/p/3eaf059cecb58132945cda4d7df728ea"
      ]
    ]
  },
  "en": {
    "hero": {
      "eyebrow": "2027 MASTERPLAN · 17 OCTOBER 2026 · STRATEGIC PROPOSAL",
      "title": "From request to outcome.",
      "subtitle": "Smart Steel Sales becomes a Steel Intelligence & Procurement Operating System: it understands what a customer needs, creates a visual workflow and can help find and purchase the product.",
      "thesis": "Describe what you need. Smart Steel Sales organizes it, finds relevant opportunities and helps you get the job done.",
      "disclaimer": "Product vision and execution plan; features and commercial outcomes described here are not all live or validated."
    },
    "status": [
      [
        "Already implemented",
        "EN/US calculators, inline bill, RFQ Hub procurement workflows, geographic Network discovery and purposeful B2B connections."
      ],
      [
        "AI foundations in place",
        "RFQAI3 uses Vercel AI Gateway with typed JSON extraction; successful real-model post-fix production acceptance remains unverified."
      ],
      [
        "Still to build",
        "Contextual multi-turn assistant, grounded Network queries, push-to-talk voice, managed Buyer case workflow."
      ]
    ],
    "pillars": [
      {
        "number": "01",
        "title": "AI · Smart Steel Intelligence",
        "subtitle": "One assistant, three contexts",
        "body": "Text and voice become verified intents and draft operations. The model interprets; deterministic steel engines and authorized database queries remain authoritative. Commercial actions require approval.",
        "deliverables": [
          "Natural language to bill lines",
          "Network questions to real queries and filters",
          "RFQ and procurement with clear next steps"
        ]
      },
      {
        "number": "02",
        "title": "Visual · Thought to Workflow",
        "subtitle": "An interface that acts, not just a chatbot",
        "body": "Conversation updates an editable workbench: technical bill, company map, quote comparison or procurement timeline. Responsive web experience preserves context and reduces friction.",
        "deliverables": [
          "Conversation and output side by side",
          "Editable lines, totals and incomplete fields",
          "Maps, lists and timelines with clear actions"
        ]
      },
      {
        "number": "03",
        "title": "Super Steel Buyer",
        "subtitle": "Software combined with domain expertise",
        "body": "Customers may hand off a request to our team for qualification, sourcing, quote comparison and coordination. Start as managed sourcing; expand to delivery responsibilities only with defined legal and operational boundaries.",
        "deliverables": [
          "Tracked customer case and technical dossier",
          "Operations workbench and offers",
          "Managed pilot, unit economics separate from SaaS"
        ]
      }
    ],
    "example1": {
      "title": "A sentence becomes a usable bill",
      "prompt": "“I need 40 tubes, 3 m each, EN 10219 S235.”",
      "recognized": [
        "40 bars",
        "3 m per bar",
        "120 linear metres",
        "EN 10219",
        "S235 grade to clarify"
      ],
      "missing": [
        "Shape",
        "Dimensions",
        "Wall thickness"
      ],
      "answer": "I have prepared a draft. Please specify section, dimensions and thickness before I calculate weight and finalize the RFQ.",
      "rule": "Never invent dimensions, theoretical weight, compliance, availability or prices. The existing deterministic technical engine calculates all weights."
    },
    "example2": {
      "title": "A Network question becomes data and a map",
      "prompt": "“How many steel traders are in Piedmont?”",
      "answer": "Run an authorized read-only query on distinct companies in the Network, filtered by classification, region and record status. Show data coverage and a map; never present database coverage as an entire market census.",
      "rule": "No guessed counts and no double counting facilities. Professional, purpose-specific B2B connections, not social following."
    },
    "architecture": [
      [
        "Input",
        "Text, push-to-talk and future file intake, with consent, authentication and tenant quotas."
      ],
      [
        "Interpretation",
        "Interchangeable compact models through Vercel AI Gateway; typed intents, evidence and missing fields."
      ],
      [
        "Tools",
        "Allowlisted operations only: weight engine, bill, read-only Network, RFQ Hub and Buyer case workbench."
      ],
      [
        "Governance",
        "Server-side RBAC/RLS checks, no automatic dispatch, awards or orders, private-data boundary and audit."
      ],
      [
        "Output",
        "Editable visual result, concise contextual reply and actionable next step."
      ]
    ],
    "model": {
      "title": "Affordable, provider-neutral AI",
      "baseline": "Keep the installed AI Gateway, verify the existing Qwen3 14B baseline and benchmark one or two alternative compact structured-output models. Steel-task accuracy should determine selection before price per token.",
      "variants": [
        "Small model for extraction and intent classification",
        "Fallback for ambiguous and complex dialogs",
        "Metered speech-to-text for push-to-talk input"
      ],
      "constraints": [
        "100+ steel request benchmark set",
        "Gateway budgets plus distributed tenant quotas",
        "Measure cost per completed workflow, not per call",
        "Review contractual privacy terms, data regions and DPA"
      ],
      "note": "Do not train a proprietary foundation model or provision dedicated GPUs initially."
    },
    "buyer": {
      "title": "Super Steel Buyer · operating model",
      "stages": [
        "Request",
        "Qualification",
        "Supplier search",
        "Comparison",
        "Customer proposal",
        "Approval",
        "Coordination",
        "Closure"
      ],
      "boundaries": [
        "Phase 1: managed sourcing and consulting with scoped responsibility.",
        "Phase 2: order and delivery coordination only under defined commercial and legal terms.",
        "No automatic supplier award, purchase or delivery commitment."
      ],
      "monetization": [
        [
          "Success fee",
          "Test hypothesis: 1.5–3% of purchase value, minimum subject to validation."
        ],
        [
          "Sourcing fee",
          "Test hypothesis: €99–€299 per qualified case, possibly offset against closing fee."
        ],
        [
          "Buyer membership",
          "Subscription or sourcing credits only after recurring demand is evidenced."
        ]
      ],
      "unitExample": "Illustrative, not forecast: €15,000 purchase × 2% = €300. Four hours at €35/hour = €140, leaving €160 before overheads, lost cases, acquisition costs and taxes.",
      "pilot": "Pilot: 5–10 real cases with worklogs, win rates, supplier response rates, quote lead times and contribution margin."
    },
    "business": [
      [
        "Free",
        "Calculators, local bill, basic Network and quota-limited AI: organic acquisition and activation."
      ],
      [
        "Pro / Team",
        "Higher AI quotas, advanced discovery, memory, RFQ collaboration and analytics: recurring SaaS."
      ],
      [
        "Super Steel Buyer",
        "Managed sourcing fee, success fee or dedicated membership: separate P&L and service SLAs."
      ]
    ],
    "roadmap": [
      [
        "SSAI0",
        "Production AI baseline & benchmark",
        "Verified live invocation, spend metrics and safety budgets."
      ],
      [
        "SSAI1",
        "Intents, tool contracts & security",
        "Unified assistant, typed outputs, server authorization."
      ],
      [
        "SSAI2",
        "Visual Calculator Copilot",
        "Request → draft → missing fields → real bill."
      ],
      [
        "SSAI3",
        "Network Grounded Assistant",
        "Verified queries, company counts, filters and map."
      ],
      [
        "SSAI4",
        "Voice push-to-talk",
        "Editable transcript feeding the same workflow."
      ],
      [
        "SSB1",
        "Buyer case intake",
        "Intake module, dossier and operator case states."
      ],
      [
        "SSB2",
        "Procurement workbench",
        "Shortlists, offers, approvals and RFQ Hub reuse."
      ],
      [
        "SSB3",
        "Concierge pilot",
        "5–10 real cases, operator costs and contribution margin."
      ],
      [
        "SSGO1",
        "BP v3 & launch gate",
        "Pricing, privacy, reliability and launch decision."
      ]
    ],
    "kpis": [
      [
        "Technical accuracy",
        "≥90% correct benchmark extraction and zero tolerated critical fabrications."
      ],
      [
        "Grounded Network",
        "All counts backed by queries and data-coverage statement."
      ],
      [
        "Governance",
        "No supplier dispatch or irreversible action without approval."
      ],
      [
        "Conversion",
        "Prompt → draft → confirmed bill → RFQ or Buyer case."
      ],
      [
        "AI economics",
        "Cost per successful session, bill and active organization."
      ],
      [
        "Buyer economics",
        "Cost per case/close, win rate, turnaround and contribution margin."
      ]
    ],
    "risks": [
      [
        "Accuracy",
        "AI never substitutes the deterministic calculation engine or regulatory evidence."
      ],
      [
        "Privacy",
        "Private tenant memory, public Network, voice retention and DPA remain separated."
      ],
      [
        "Autonomy",
        "Default to read-only or draft; require approval for external actions."
      ],
      [
        "Spend",
        "Gateway budgets, tenant quotas, telemetry and manual fallback."
      ],
      [
        "Buyer liability",
        "Contracts, invoicing, quality, delivery, insurance and claims require legal review."
      ],
      [
        "Commercial evidence",
        "Pricing and market sizing remain assumptions until pilots validate them."
      ]
    ],
    "references": [
      [
        "Strategic plan",
        "https://app.notion.com/p/3e6f059cecb581539311d7b014bfa537"
      ],
      [
        "AI RFQ architecture",
        "https://github.com/ctimaru/steel-sales-ai/blob/main/docs/architecture/rfqai3-free-text-intelligence.md"
      ],
      [
        "Gateway acceptance gap",
        "https://github.com/ctimaru/steel-sales-ai/blob/main/docs/architecture/rfqai3-1-gateway-diagnostics.md"
      ],
      [
        "RFQ Hub",
        "https://app.notion.com/p/3f1f059cecb58182b887e37f7a795f2f"
      ],
      [
        "Business Model v2",
        "https://app.notion.com/p/3eaf059cecb58132945cda4d7df728ea"
      ]
    ]
  }
} as const;
