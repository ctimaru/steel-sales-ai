"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { loadMoreHomeFeed } from "@/app/(workspace)/dashboard/feed-actions";
import {
  CompanyPostCard,
  CompanyPostComposer,
  CompanyPostsOfType,
  CompanyPostTypeFilter,
  CompanyPostVerifyFirst,
} from "@/components/company-post";
import type { CompanyPostItem, CompanyPostType } from "@/lib/company-posts-model";
import { companyInitials, homeFeedFamilyText, type HomeFeedCompanyRow, type HomeFeedItem } from "@/lib/home-feed-model";
import { appRoutes } from "@/lib/routes";
import { NetworkSaveToggle } from "@/components/network-save-toggle";

/**
 * HOME-FEED1: LinkedIn-style infinite feed. Posts re-present content the viewer
 * can already see (Network, Scuola, Marketplace, Steel Pulse); every page is
 * fetched by a server action that re-derives permissions from the session.
 * No polling: the next page loads only when the end of the list is near.
 */
const MAX_EMPTY_PAGES = 3;

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
}

function PostHeader({ badge, title, subtitle, tone }: { badge: string; title: string; subtitle?: string | null; tone: "network" | "school" | "market" | "news" }) {
  const colors = {
    network: "bg-[#e4f0e9] text-[#175640]",
    school: "bg-[#eef1fa] text-[#2f4a86]",
    market: "bg-[#fff3df] text-[#815017]",
    news: "bg-[#f1ecf7] text-[#5a3d83]",
  }[tone];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold " + colors}>
        {badge}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#173f35]">{title}</p>
        {subtitle ? <p className="truncate text-[11px] text-[#5b6b62]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

const actionClass =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#3f5248] transition hover:bg-[#f1f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]";

function CompanyRow({ row, canInteract }: { row: HomeFeedCompanyRow; canInteract: boolean }) {
  const detail = [row.role, row.place].filter(Boolean).join(" · ");
  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5" data-testid="home-feed-company-row">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4f0e9] text-[11px] font-bold text-[#175640]">
        {companyInitials(row.name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={"/network/" + row.id} aria-label={"Profilo di " + row.name}
          className="flex min-w-0 items-center gap-1 text-sm font-semibold text-[#173f35] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
          <span className="truncate">{row.name}</span>
          {row.verified ? <span className="shrink-0 text-xs text-[#176045]" title="Identità verificata">✓<span className="sr-only"> Identità verificata</span></span> : null}
        </Link>
        {detail ? <p className="truncate text-[11px] text-[#5b6b62]">{detail}</p> : null}
        {row.reason ? <p className="truncate text-[11px] font-medium text-[#28634f]">{row.reason}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
        {canInteract && row.connect === "available" ? (
          <Link href={"/network/" + row.id + "/connect"} className={actionClass} aria-label={"Connetti con " + row.name}>
            <span aria-hidden="true">＋</span> Connetti
          </Link>
        ) : row.connect === "connected" ? (
          <span className="px-2 text-xs font-semibold text-[#175640]">✓ Connessa</span>
        ) : row.connect === "pending" ? (
          <span className="px-2 text-xs font-semibold text-[#175640]">Richiesta inviata</span>
        ) : null}
        {/* NET-SAVE-INLINE1: same inline Salva as the Network (toast, Annulla, counter sync). */}
        {canInteract ? (
          <NetworkSaveToggle companyId={row.id} name={row.name} saved={row.saved} surface="home_feed" appearance="ghost" />
        ) : null}
      </div>
    </li>
  );
}

/**
 * HOME-FEED2: one card per feed page groups the Network companies and says why
 * they are shown. «Per le tue distinte» when they work the families of the
 * organization's bills; a teaser with the total when Network PRO is missing.
 */
function CompaniesGroupPost({ item, canInteract }: { item: Extract<HomeFeedItem, { kind: "companies" }>; canInteract: boolean }) {
  const families = homeFeedFamilyText(item.families);
  const fromBills = item.source === "distinte";
  const title = fromBills ? "Per le tue distinte" : "Aziende del Network";
  const subtitle = fromBills && families
    ? "Lavorano " + families.toLowerCase() + ", come le tue distinte"
    : "Aziende della filiera che potresti conoscere";
  if (item.lockedTotal !== null) {
    return (
      <div className="px-4 py-4" data-testid="home-feed-companies-locked">
        <PostHeader badge="NW" title={title} subtitle="Network PRO" tone="network" />
        <p className="mt-3 text-sm leading-6 text-[#2f4a3e]">
          <strong className="font-semibold tabular-nums">{item.lockedTotal.toLocaleString("it-IT")}</strong>{" "}
          {item.lockedTotal === 1 ? "azienda del Network lavora" : "aziende del Network lavorano"}{" "}
          {families ? families.toLowerCase() : "i prodotti"}, come le tue distinte.
        </p>
        <Link href={appRoutes.network.pro} className={actionClass + " mt-2 -ml-3 text-[#175640]"}>
          Scoprile con Network PRO <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="px-4 pt-4">
        <PostHeader badge="NW" title={title} subtitle={subtitle} tone="network" />
        <ul className="mt-2 divide-y divide-[#edf2ef]">
          {item.companies.map((row) => (
            <CompanyRow key={row.id} row={row} canInteract={canInteract} />
          ))}
        </ul>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-[#edf2ef] px-2 py-1">
        <Link href={appRoutes.network.directory} className={actionClass}>
          Vedi altre aziende nel Network <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  );
}

function ArticlePost({ item }: { item: Extract<HomeFeedItem, { kind: "article" }> }) {
  return (
    <>
      <div className="px-4 pt-4">
        <PostHeader badge="SC" title="Scuola Smart Steel" subtitle={item.category + " · " + item.readMinutes + " min di lettura"} tone="school" />
        <h3 className="mt-3 text-base font-semibold leading-snug text-[#173f35]">{item.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#3f5248]">{item.lead}</p>
      </div>
      {item.image ? (
        <div className="relative mt-3 aspect-[2/1] w-full bg-[#f3f6fb]">
          <Image src={item.image} alt={item.imageAlt} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-contain p-4" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1 border-t border-[#edf2ef] px-2 py-1">
        <Link href={"/knowledge/articoli/" + item.slug} className={actionClass}>Leggi la guida</Link>
      </div>
    </>
  );
}

function ReferencePost({ item }: { item: Extract<HomeFeedItem, { kind: "standard" | "grade" }> }) {
  const isStandard = item.kind === "standard";
  const heading = isStandard ? item.code : item.designation;
  const detail = isStandard ? item.title : [item.family, item.standardSystem].filter(Boolean).join(" · ");
  const body = isStandard ? item.explanation : item.description;
  const href = isStandard ? "/school/norme/" + item.slug : "/school/gradi/" + item.slug;
  return (
    <>
      <div className="px-4 pt-4">
        <PostHeader badge={isStandard ? "EN" : "Gr"} title="Scuola Smart Steel" subtitle={isStandard ? "Scheda norma" : "Scheda grado"} tone="school" />
        <h3 className="mt-3 text-base font-semibold text-[#173f35]">{heading}</h3>
        {detail ? <p className="text-xs font-medium text-[#4d6156]">{detail}</p> : null}
        {body ? <p className="mt-1.5 text-sm leading-6 text-[#3f5248]">{body}</p> : null}
        {isStandard && item.families.length ? (
          <p className="mt-2 text-[11px] text-[#5b6b62]">Prodotti: {item.families.join(", ")}</p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#edf2ef] px-2 py-1">
        <Link href={href} className={actionClass}>Apri la scheda</Link>
      </div>
    </>
  );
}

function OpportunityPost({ item }: { item: Extract<HomeFeedItem, { kind: "opportunity" }> }) {
  const closes = formatDate(item.closesAt);
  return (
    <>
      <div className="px-4 pt-4">
        <PostHeader badge="RFQ" title={item.buyer ?? "Buyer riservato"} subtitle={"Opportunità Marketplace" + (item.country ? " · consegna " + item.country : "")} tone="market" />
        <ul className="mt-3 space-y-1">
          {item.lines.map((line) => (
            <li key={line} className="text-sm text-[#2f4a3e]">• {line}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[#5b6b62]">
          {item.lineCount} {item.lineCount === 1 ? "riga" : "righe"}
          {closes ? " · chiude il " + closes : ""}
          {item.closingSoon ? " · in scadenza" : ""}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#edf2ef] px-2 py-1">
        <Link href={"/marketplace/opportunities/" + item.id} className={actionClass}>Vedi l’opportunità</Link>
      </div>
    </>
  );
}

function NewsPost({ item }: { item: Extract<HomeFeedItem, { kind: "news" }> }) {
  const date = formatDate(item.publishedAt);
  return (
    <>
      <div className="px-4 pt-4">
        <PostHeader badge="SP" title="Steel Pulse" subtitle={[item.sourceName, date].filter(Boolean).join(" · ")} tone="news" />
        <h3 className="mt-3 text-base font-semibold leading-snug text-[#173f35]">{item.headline}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#3f5248]">{item.summary}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#edf2ef] px-2 py-1">
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
          Leggi la fonte <span aria-hidden="true">↗</span>
        </a>
      </div>
    </>
  );
}

function Post({
  item,
  canInteract,
  isAdmin,
  onRemoved,
}: {
  item: HomeFeedItem;
  canInteract: boolean;
  isAdmin: boolean;
  onRemoved: (key: string) => void;
}) {
  switch (item.kind) {
    case "post":
      return <CompanyPostCard item={item} isAdmin={isAdmin} onRemoved={onRemoved} />;
    case "companies":
      return <CompaniesGroupPost item={item} canInteract={canInteract} />;
    case "article":
      return <ArticlePost item={item} />;
    case "standard":
    case "grade":
      return <ReferencePost item={item} />;
    case "opportunity":
      return <OpportunityPost item={item} />;
    case "news":
      return <NewsPost item={item} />;
  }
}

export function HomeFeed({
  initialItems,
  initialCursor,
  canInteract,
  isAdmin = false,
  composer = "hidden",
  organizationName = "",
}: {
  initialItems: HomeFeedItem[];
  initialCursor: string | null;
  canInteract: boolean;
  /** CPOST1: company admins may delete colleagues' posts (re-checked in SQL). */
  isAdmin?: boolean;
  /** CPOST1: composer, a hint for unverified companies, or nothing. */
  composer?: "compose" | "verify_first" | "hidden";
  organizationName?: string;
}) {
  const [items, setItems] = useState(initialItems);
  // CPOST2: null = the whole feed; a type = only company posts of that type.
  const [postFilter, setPostFilter] = useState<CompanyPostType | null>(null);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const keys = useRef(new Set(initialItems.map((item) => item.key)));
  // HOME-FEED2: a company already shown in a group (e.g. «Per le tue distinte») is not repeated later.
  const shownCompanies = useRef(new Set(initialItems.flatMap((item) => (item.kind === "companies" ? item.companies.map((row) => row.id) : []))));
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      let next: string | null = cursor;
      const added: HomeFeedItem[] = [];
      // Skip over pages that come back empty (e.g. own company filtered out).
      for (let attempt = 0; next && added.length === 0 && attempt < MAX_EMPTY_PAGES; attempt++) {
        const page = await loadMoreHomeFeed(next);
        if (page.unavailable.includes("feed")) {
          setFailed(true);
          break;
        }
        for (const raw of page.items) {
          if (keys.current.has(raw.key)) continue;
          keys.current.add(raw.key);
          let item = raw;
          if (item.kind === "companies" && item.lockedTotal === null) {
            const fresh = item.companies.filter((row) => !shownCompanies.current.has(row.id));
            if (fresh.length === 0) continue;
            fresh.forEach((row) => shownCompanies.current.add(row.id));
            item = { ...item, companies: fresh };
          }
          added.push(item);
        }
        next = page.nextCursor;
      }
      if (added.length) setItems((current) => [...current, ...added]);
      setCursor(next);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || failed || postFilter || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed, loadMore, postFilter]);

  const removePost = useCallback((key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const addPost = useCallback((item: CompanyPostItem | null) => {
    if (!item || keys.current.has(item.key)) return;
    keys.current.add(item.key);
    setItems((current) => [item, ...current]);
  }, []);

  return (
    <section aria-labelledby="home-feed-heading" data-testid="home-feed" className="min-w-0 space-y-3">
      <h2 id="home-feed-heading" className="sr-only">Steel Pulse · il tuo feed</h2>
      {composer === "compose" ? (
        <CompanyPostComposer organizationName={organizationName} onPublished={addPost} />
      ) : composer === "verify_first" ? (
        <CompanyPostVerifyFirst />
      ) : null}
      {composer !== "hidden" || items.some((item) => item.kind === "post") ? (
        <CompanyPostTypeFilter value={postFilter} onChange={setPostFilter} />
      ) : null}
      {postFilter ? <CompanyPostsOfType type={postFilter} isAdmin={isAdmin} /> : null}
      {!postFilter && items.length === 0 && !cursor ? (
        <p role="status" className="rounded-2xl border border-[#dce5df] bg-white p-5 text-sm leading-6 text-[#52615b]">
          Il feed non ha ancora contenuti da mostrarti. Le aziende del Network, le guide della Scuola e le opportunità compariranno qui.
        </p>
      ) : null}
      <div role="feed" aria-busy={loading} hidden={postFilter !== null} className="space-y-3">
        {items.map((item, index) => (
          <article
            key={item.key}
            aria-posinset={index + 1}
            aria-setsize={cursor ? -1 : items.length}
            data-testid="home-feed-post"
            data-kind={item.kind}
            className="overflow-hidden rounded-2xl border border-[#dce5df] bg-white"
          >
            <Post item={item} canInteract={canInteract} isAdmin={isAdmin} onRemoved={removePost} />
          </article>
        ))}
      </div>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {postFilter ? null : cursor ? (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            data-testid="home-feed-more"
            className="inline-flex min-h-10 items-center rounded-full border border-[#b9d2c5] bg-white px-4 text-xs font-semibold text-[#175640] hover:bg-[#f2f8f4] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {loading ? "Caricamento…" : failed ? "Riprova a caricare" : "Mostra altri post"}
          </button>
        </div>
      ) : items.length ? (
        <p role="status" className="py-3 text-center text-xs text-[#5b6b62]">Hai visto tutti i post per ora.</p>
      ) : null}
      {failed && !postFilter ? (
        <p role="alert" className="text-center text-xs text-[#9d4e28]">Non è stato possibile caricare altri post.</p>
      ) : null}
    </section>
  );
}
