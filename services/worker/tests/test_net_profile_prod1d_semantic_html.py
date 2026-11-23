"""PROD1.D — semantic first-party paragraph proof, not flattened navigation."""
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.company_discovery import (
    _OfficialContentEvidenceParser, _PublicHTMLParser, _fetch_page,
)
from app.net_profile_prod1b import source_backed_facts


def content_page(html: str):
    """Exercise both parsers on exactly the same first-party HTML."""
    original = _PublicHTMLParser()
    original.feed(html)
    semantic = _OfficialContentEvidenceParser()
    semantic.feed(html)
    semantic.close()
    from dataclasses import replace
    return replace(original.result("https://officineruboni.it/lavorazioni/"),
                   evidence_blocks=tuple(semantic.blocks))


class SemanticEvidenceTest(unittest.TestCase):
    def test_flattened_product_navigation_cannot_be_proof(self):
        html = """<html><head><meta name="description" content="Produciamo
          tubi e condotte per strutture industriali"></head>
          <body>
            <header><p>Produciamo tubi per strutture industriali</p></header>
            <nav><p>Produciamo profilati in acciaio per costruzioni</p></nav>
            <div class="mega-menu"><p>Produciamo viti e bulloneria
              per carpenterie industriali</p></div>
            <main><h1>Produciamo tubi per il settore industriale</h1>
              <p>Eseguiamo taglio laser per componenti industriali su disegno.</p>
            </main>
            <aside><p>Fabbrichiamo stampi per i clienti industriali</p></aside>
            <footer><p>Produciamo lamiere per strutture industriali</p></footer>
          </body></html>"""
        p = content_page(html)
        self.assertIn("produciamo tubi", p.text.lower())  # Old crawler still sees menus.
        self.assertEqual(len(p.evidence_blocks), 1)
        self.assertIn("Eseguiamo taglio laser", p.evidence_blocks[0])
        facts = source_backed_facts(p)
        self.assertEqual([r["field_key"] for r in facts],
                         ["description", "services"])
        self.assertEqual(facts[-1]["field_value"], ["Taglio laser"])

    def test_headings_and_meta_descriptions_are_not_manufacturing_proof(self):
        p = content_page("""<title>Produciamo tubi e profilati</title>
            <meta name="description" content="Produciamo tubi per uso industriale">
            <h1>Produciamo tubi per il mercato internazionale</h1>
            <div class="navigation"><p>Produciamo tubi per carpenterie</p></div>
            <p>Contatti aziendali e catalogo tecnico della nostra officina.</p>""")
        self.assertEqual(source_backed_facts(p), [])

    def test_body_paragraph_supports_product_claim_and_source_quote(self):
        p = content_page("""<main><article>
           <p>La nostra azienda <strong>produce tubi</strong> e
            condotte per applicazioni strutturali e industriali.</p>
           </article></main>""")
        evidence = source_backed_facts(p)
        self.assertEqual(evidence[0]["field_key"], "products")
        self.assertEqual(evidence[0]["field_value"], ["Tubi e condotte"])
        self.assertIn("azienda produce tubi", evidence[0]["evidence_excerpt"])
        self.assertEqual(len(evidence), 2)

    def test_bare_menu_anchors_never_supply_the_product_object(self):
        p = content_page("""<main><p>Produciamo
           <a href="/tubi/">tubi per impieghi industriali e strutturali</a>
           per il nostro settore.</p></main>""")
        self.assertEqual(source_backed_facts(p), [])

    def test_untagged_site_chrome_and_wysiwyg_editor(self):
        p = content_page("""<div class="wp-block-navigation"><div
            class="wpb_wrapper">Produciamo tubi e condotte industriali.</div></div>
            <div class="elementor-widget-text-editor">
              La nostra azienda produce profilati in acciaio
              per applicazioni meccaniche strutturali.
            </div>
            <div class="cookie-consent"><p>Produciamo barre in acciaio.</p></div>
        """)
        facts = source_backed_facts(p)
        self.assertEqual(facts[0]["field_value"], ["Profilati in acciaio"])
        self.assertEqual(len(p.evidence_blocks), 1)

    def test_empty_semantic_blocks_fail_closed_even_when_flattened_text_has_proof(self):
        p = content_page("""<nav><a href="/produzione/">
            La nostra azienda produce tubi e condotte industriali
            </a></nav><div class="footer"><p>Produciamo tubi per
            applicazioni industriali</p></div>""")
        self.assertTrue(p.text)
        self.assertEqual(p.evidence_blocks, ())
        self.assertEqual(source_backed_facts(p), [])

    def test_list_markup_may_support_a_real_paragraph_but_not_links(self):
        p = content_page("""<main><section>
          <div class="content"><p>Siamo specializzati nella
          saldatura e nella calandratura per componenti industriali.</p></div>
          <ul><li><a href="/produzione-tubi/">Produciamo tubi</a></li></ul>
          </section></main>""")
        facts = source_backed_facts(p)
        self.assertEqual([x["field_key"] for x in facts], ["description", "services"])
        self.assertEqual(facts[-1]["field_value"], ["Saldatura", "Calandratura"])

    def test_elementor_nested_div_leaf_proves_official_tube_production(self):
        p = content_page("""<main><div class="elementor-widget-text-editor">
          <div class="elementor-widget-container">
            <div class="body-copy"><span>La nostra azienda</span>
              <strong>produce tubi e condotte</strong> in acciaio
              per applicazioni strutturali e meccaniche industriali.</div>
          </div>
          </div></main>""")
        self.assertEqual(len(p.evidence_blocks), 1)
        facts = source_backed_facts(p)
        self.assertEqual(facts[0]["field_value"], ["Tubi e condotte"])
        self.assertIn("azienda produce tubi", facts[0]["evidence_excerpt"])

    def test_wordpress_group_leaf_without_paragraph(self):
        p = content_page("""<main><div class="wp-block-group">
           <div class="wp-block-group__inner-container">
             <div class="custom-section">
               Effettuiamo lavorazioni meccaniche e tornitura conto terzi
               su componenti industriali per carpenteria e costruzioni.
             </div>
           </div>
         </div></main>""")
        facts = source_backed_facts(p)
        self.assertEqual(len(p.evidence_blocks), 1)
        self.assertEqual([x["field_key"] for x in facts], ["description", "services"])
        self.assertEqual(facts[-1]["field_value"], ["Tornitura", "Lavorazioni meccaniche"])

    def test_article_untagged_div_leaf_is_bounded_narrative(self):
        p = content_page("""<main><article><div>
            Siamo specializzati nella saldatura e nella piegatura
            di componenti metallici destinati a strutture e progetti
            meccanici per clienti industriali in Italia.
          </div></article></main>""")
        facts = source_backed_facts(p)
        self.assertEqual(facts[-1]["field_value"], ["Saldatura", "Piegatura"])

    def test_arbitrary_main_div_without_editor_is_not_automatic_proof(self):
        p = content_page("""<main><div>
          La nostra azienda produce tubi e condotte per applicazioni
          strutturali e industriali con processi certificati.
          </div></main>""")
        self.assertEqual(source_backed_facts(p), [])

    def test_nested_menu_and_editor_are_never_joined(self):
        p = content_page("""<main><div class="elementor-widget-text-editor">
           Produciamo
           <div class="menu"><span>tubi per strutture industriali</span></div>
           <div>attrezzature per la produzione di macchine industriali</div>
          </div></main>""")
        self.assertEqual(source_backed_facts(p), [])

    def test_links_buttons_headings_never_convert_wrapper_into_proof(self):
        examples = (
            """<div class="elementor-widget-text-editor">
              Produciamo <a href="/tubi/">tubi e condotte industriali</a>
              con servizi specializzati nei settori strutturali.</div>""",
            """<div class="elementor-widget-container">
              <h2>Produciamo tubi e condotte per applicazioni
              industriali e strutturali.</h2></div>""",
            """<div class="elementor-widget-text-editor">
              La nostra azienda produce tubi e condotte industriali
              <button>Richiedi un preventivo</button></div>""",
            """<div class="elementor-widget-text-editor">
              La nostra azienda produce tubi e condotte industriali
              <p>Il portale è attivo per tutte le aziende registrate.</p>
              </div>""",
        )
        for html in examples:
            with self.subTest(html=html):
                self.assertEqual(source_backed_facts(content_page(html)), [])

    def test_editorial_markup_nested_in_hidden_navigation_rejected(self):
        examples = (
            """<div class="nav-primary"><div class="wp-block-group">
                 <span>Produciamo tubi e condotte industriali
                 destinati a progetti strutturali</span></div></div>""",
            """<div role="navigation"><article><div>
                La nostra azienda produce tubi e condotte
                per il settore industriale italiano.</div></article></div>""",
            """<div class="popup-modal"><div class="elementor-widget-container">
                La nostra azienda produce profilati in acciaio
                per applicazioni strutturali industriali.</div></div>""",
            """<div aria-hidden="true" class="wp-block-group">
                La nostra azienda produce tubi e condotte
                per il mercato delle strutture industriali.</div>""",
        )
        for html in examples:
            with self.subTest(html=html):
                self.assertEqual(source_backed_facts(content_page(html)), [])

    def test_wordpress_parent_is_not_joined_across_multiple_child_blocks(self):
        p = content_page("""<main><div class="wp-block-group">
             <div class="wp-block-group__inner-container">
               <div>La nostra azienda produce attrezzature
                    per macchinari e componenti industriali.</div>
               <div>tubi e condotte per il settore strutturale.</div>
             </div>
           </div></main>""")
        self.assertEqual(source_backed_facts(p), [])

    def test_semantic_itemprop_description_without_paragraph(self):
        p = content_page("""<main><section itemprop="description">
          La nostra azienda produce lamiere per componenti
          destinati a strutture metalliche e costruzioni
          nel settore siderurgico e meccanico nazionale.
        </section></main>""")
        self.assertEqual(source_backed_facts(p)[0]["field_value"], ["Lamiere"])

    def test_deduplicates_and_bounds_body_prose(self):
        html = "<main>" + "".join(
            f"<p>Eseguiamo taglio laser su componenti industriali {i}.</p>"
            for i in range(220)
        ) + "</main>"
        p = content_page(html)
        self.assertLessEqual(len(p.evidence_blocks), 150)
        self.assertEqual(source_backed_facts(p)[-1]["field_value"], ["Taglio laser"])


class LiveFetchIntegrationTest(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_injects_semantic_body_proof_and_retains_navigation_links(self):
        url = "https://officineruboni.it/lavorazioni/"
        html = """<nav><a href="/prodotti/">Prodotti</a>
                  <p>Produciamo tubi per il mercato industriale</p></nav>
                  <main><p>Effettuiamo saldatura per componenti industriali.</p></main>"""
        response = httpx.Response(
            200, headers={"content-type": "text/html; charset=utf-8"},
            content=html.encode("utf-8"), request=httpx.Request("GET", url),
        )
        async with httpx.AsyncClient() as client:
            with (
                patch("app.company_discovery._robots_allows",
                      new=AsyncMock(return_value=True)),
                patch("app.company_discovery._request_public_url",
                      new=AsyncMock(return_value=(response, url))),
            ):
                page = await _fetch_page(client, url, url)
        self.assertIsNotNone(page)
        self.assertIn("/prodotti/", page.links)
        self.assertEqual(page.evidence_blocks,
                         ("Effettuiamo saldatura per componenti industriali.",))
        self.assertEqual(source_backed_facts(page)[-1]["field_value"], ["Saldatura"])
