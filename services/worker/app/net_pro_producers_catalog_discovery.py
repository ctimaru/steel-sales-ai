"""NET-PRODUCERS CATALOG-DISCOVERY1: safe first-party PDF *link* discovery.

This worker discovers official source documents for ALL published producer-role
leads (IT/RO), but DOES NOT imply that all leads manufacture steel tubes.
Only a bounded set of first-party HTTPS pages is read. No PDF is downloaded,
stored or parsed here. Private registry + lease/audit are DB-enforced.
"""
from __future__ import annotations

import asyncio
from html.parser import HTMLParser
import http.client
import ipaddress
import os
import re
import socket
import ssl
from typing import Any
from urllib.parse import urljoin,urlsplit,urlunsplit
from urllib.robotparser import RobotFileParser

from .net_pro_producers_catalog_b3c2b_issuer import _resolve_public_ip

RPC = "netproducers_catalog_discovery"
CONTRACT = "netproducers-catalog-discovery-v1"
USER_AGENT = "SmartSteelSalesCatalogueDiscovery/1.0"
MAX_HTML = 256_000
MAX_PAGES = 3
MAX_LINKS = 8

BAD = re.compile(r"privacy|cookie|legal|terms|conditions|policy|warranty|certifi|quality.?assurance|ISO.?9001",re.I)
GOOD = re.compile(r"tub[ioe]|tubes?|pip(?:e|ing)|hollow|profil|stainless|acciai|inox|steel|metal|carbon|catalog|brochure|scheda|specifi|download",re.I)
PAGE = re.compile(r"catalog|brochure|download|prodot|product|tub|tube|pipe|specifi|technical|document|gamma|range",re.I)
INDUSTRIAL = re.compile(r"tub[ioe]|tubes?|pip(?:e|ing)|hollow|steel|acciai|inox|profil|stainless|siderurg",re.I)
UUID = re.compile(r"^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$",re.I)


class DiscoveryProblem(ValueError):
    def __init__(self,code: str):
        self.code=code
        super().__init__(code)


def _official_url(value: str, domain: str) -> bool:
    if not isinstance(value,str) or len(value)>1200:
        return False
    try:
        u=urlsplit(value)
        return (u.scheme=="https" and (u.hostname or "").lower().rstrip(".")
                in (domain,"www."+domain) and u.port in (None,443)
                and u.username is None and u.password is None
                and not u.fragment)
    except (ValueError,TypeError):
        return False


def _read_firstparty_bytes(url: str, domain: str, *, limit:int = MAX_HTML) -> tuple[int,bytes,str]:
    """PIN a public DNS address for TCP, validate certificate for official hostname.

    No implicit redirect, proxies, external scheme, compression or 2nd DNS lookup.
    """
    if not _official_url(url,domain):
        raise DiscoveryProblem("unsafe_source")
    u=urlsplit(url)
    host=u.hostname or ""
    try:
        ip=_resolve_public_ip(host)
        if not ipaddress.ip_address(ip).is_global:
            raise DiscoveryProblem("unsafe_dns")
    except Exception as exc:
        raise DiscoveryProblem("dns_failed") from exc
    conn=http.client.HTTPSConnection(host,443,timeout=10,context=ssl.create_default_context())
    try:
        sock=socket.create_connection((ip,443),timeout=10)
        try:
            conn.sock=conn._context.wrap_socket(sock,server_hostname=host)
        except Exception:
            sock.close()
            raise
        path=urlunsplit(("","",u.path or "/",u.query,""))
        conn.request("GET",path,headers={
            "Host":host,"User-Agent":USER_AGENT,"Accept":"text/html,text/plain",
            "Accept-Encoding":"identity","Connection":"close",
        })
        resp=conn.getresponse()
        if resp.status in (301,302,307,308):
            return resp.status,b"",resp.getheader("Location","")
        if resp.status in (404,410):
            return resp.status,b"",""
        if resp.status!=200:
            raise DiscoveryProblem("http_unavailable")
        typ=resp.getheader("Content-Type","").lower()
        if "text/html" not in typ and "text/plain" not in typ:
            raise DiscoveryProblem("not_html")
        if resp.getheader("Content-Encoding","identity").lower()!="identity":
            raise DiscoveryProblem("compressed")
        cl=resp.getheader("Content-Length")
        if cl and (not cl.isdigit() or int(cl)>limit):
            raise DiscoveryProblem("html_too_large")
        chunks=bytearray()
        while len(chunks)<=limit:
            part=resp.read(min(65536,limit+1-len(chunks)))
            if not part:break
            chunks.extend(part)
        if len(chunks)>limit:
            raise DiscoveryProblem("html_too_large")
        return 200,bytes(chunks),""
    except (OSError,TimeoutError,ssl.SSLError,http.client.HTTPException) as exc:
        raise DiscoveryProblem("http_unavailable") from exc
    finally:
        conn.close()


def _fetch(url:str,domain:str,*,robots:bool=False)->tuple[bytes,str]:
    """Only one first-party https:// canonical www/apex redirect."""
    status,body,location=_read_firstparty_bytes(url,domain,limit=100_000 if robots else MAX_HTML)
    if status in (301,302,307,308):
        target=urljoin(url,location)
        if not _official_url(target,domain):
            raise DiscoveryProblem("redirect_non_firstparty")
        status,body,next_location=_read_firstparty_bytes(target,domain,
            limit=100_000 if robots else MAX_HTML)
        if next_location or status in (301,302,307,308):
            raise DiscoveryProblem("redirect_chain")
        url=target
    if status in (404,410) and robots:return b"",url
    if status!=200:raise DiscoveryProblem("http_unavailable")
    return body,url


def _robots_allows(url:str,domain:str,cache:dict)->bool:
    host=urlsplit(url).hostname
    if not host or not _official_url(url,domain):
        return False
    if host not in cache:
        try:
            body,_=_fetch(f"https://{host}/robots.txt",domain,robots=True)
            parser=RobotFileParser()
            if body:parser.parse(body.decode("utf-8","replace").splitlines())
            cache[host]=parser if body else True
        except DiscoveryProblem:
            cache[host]=False
    rules=cache[host]
    return rules is True or (rules is not False and rules.can_fetch(USER_AGENT,url))


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links=[]
        self._href=None
        self._text=[]
        self.visible=[]
        self._skip=0
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag in ("script","style","noscript"):self._skip+=1
        if tag=="a" and self._skip==0:
            self._href=d.get("href")
            self._text=[]
    def handle_data(self,data):
        if self._skip:return
        if self._href is not None:
            # Link labels (even offsite or attacker-controlled) are NOT
            # proof that the company's own page discusses tube products.
            self._text.append(data[:120])
        elif len(self.visible)<600:
            self.visible.append(data[:200])
    def handle_endtag(self,tag):
        if tag in ("script","style","noscript") and self._skip:
            self._skip-=1
        if tag=="a" and self._href is not None:
            self.links.append((self._href," ".join(" ".join(self._text).split())[:120]))
            self._href=None


def _parse_links(html:bytes,page_url:str,domain:str)->tuple[list[dict],list[str],bool]:
    parser=Anchors()
    parser.feed(html.decode("utf-8","replace"))
    industrial=bool(INDUSTRIAL.search(" ".join(parser.visible)[:35000]))
    documents=[]
    pages=[]
    for href,label in parser.links[:1000]:
        if not isinstance(href,str) or len(href)>1000 or href.startswith(("#","mailto:","javascript:","tel:")):
            continue
        u=urljoin(page_url,href)
        if not _official_url(u,domain):continue
        sp=urlsplit(u)
        clean=urlunsplit((sp.scheme,sp.netloc,sp.path,sp.query,""))
        hint=sp.path+" "+label
        if BAD.search(hint):continue
        if re.search(r"\.pdf$",sp.path,re.I):
            # No generic cross-industry download: source context must be metal
            # or tubular AND the link itself must be a likely catalogue/product.
            if industrial and GOOD.search(hint):
                documents.append({"url":clean,
                    "title":(" ".join(label.split()) if len(" ".join(label.split()))>=5
                        else "Official industrial PDF catalogue")[:220],
                    "discovery_page_url":page_url})
        elif PAGE.search(hint) and len(pages)<MAX_PAGES*3:
            pages.append(clean)
    return documents,pages,industrial


def _lease(x: Any)->dict:
    if not isinstance(x,dict):raise DiscoveryProblem("unexpected")
    company=x.get("company_id")
    token=x.get("lease_token")
    domain=x.get("canonical_domain")
    home=x.get("homepage")
    if (not all(isinstance(z,str) and UUID.fullmatch(z) for z in (company,token))
        or not isinstance(domain,str) or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{3,200}\.[a-z]{2,}",domain)
        or home!=f"https://{domain}/"):
        raise DiscoveryProblem("unexpected")
    return x


def _rpc(db:Any,operation:str,payload:dict)->dict:
    response=db.rpc(RPC,{"p_operation":operation,"p_payload":payload}).execute().data
    if not isinstance(response,dict) or response.get("contract")!=CONTRACT:
        raise DiscoveryProblem("rpc_rejected")
    return response


def _discover_one(lease:dict)->tuple[list[dict],str,str|None]:
    domain=lease["canonical_domain"]
    cache={}
    home=lease["homepage"]
    if not _robots_allows(home,domain,cache):
        return [],"blocked","robots_unavailable_or_denied"
    try:
        html,actual=_fetch(home,domain)
    except DiscoveryProblem as exc:
        return [],"retry",exc.code
    links,secondary,industrial=_parse_links(html,actual,domain)
    visited={actual}
    # Bounded two extra first-party product/catalogue pages only.
    for page in secondary:
        if len(visited)>=MAX_PAGES or page in visited:continue
        if not _robots_allows(page,domain,cache):continue
        try:
            inner,resolved=_fetch(page,domain)
            more,_,_=_parse_links(inner,resolved,domain)
            links.extend(more)
            visited.add(resolved)
        except DiscoveryProblem:
            continue
    if not industrial and not links:
        return [],"none_found",None
    unique={}
    for item in links:
        unique.setdefault(item["url"],item)
        if len(unique)>=MAX_LINKS:break
    return list(unique.values()),"discovered" if unique else "none_found",None


async def run_catalogue_discovery(db:Any,*,limit:int=2)->dict:
    if type(limit) is not int or not 1<=limit<=3:
        raise ValueError("Only 1–3 producer sites per scheduled cycle")
    seeded=_rpc(db,"seed",{"limit":250})
    if seeded.get("operation")!="seed" or type(seeded.get("added")) is not int:
        raise DiscoveryProblem("rpc_rejected")
    lease_response=_rpc(db,"claim",{"limit":limit})
    items=lease_response.get("items")
    if (lease_response.get("operation")!="claim" or not isinstance(items,list)
        or lease_response.get("count")!=len(items) or len(items)>limit):
        raise DiscoveryProblem("rpc_rejected")
    added=checked=failed=0
    for index,raw in enumerate(items):
        l=_lease(raw)
        if index:await asyncio.sleep(1.5)
        try:
            links,status,err=await asyncio.to_thread(_discover_one,l)
            completed=_rpc(db,"complete",{
                "company_id":l["company_id"],"lease_token":l["lease_token"],
                "status":status,
                **({"links":links} if status=="discovered" else {}),
                **({"error_code":err} if err else {}),
            })
            if completed.get("operation")!="complete":
                raise DiscoveryProblem("rpc_rejected")
            added+=completed.get("added",0)
            checked+=1
        except DiscoveryProblem as exc:
            _rpc(db,"complete",{
                "company_id":l["company_id"],"lease_token":l["lease_token"],
                "status":"retry","error_code":exc.code,
            })
            failed+=1
    return {"contract":"netproducers-catalog-discovery-worker-v1",
        "sites_leased":len(items),"sites_checked":checked,
        "sites_retry":failed,"catalog_links_added":added,
        "new_leads_seeded":seeded["added"],
        "pdf_downloads":0,"claims_of_manufacturing":0}


if __name__=="__main__":
    raise SystemExit("Run only through the existing scheduled producer worker")
