"""SP2: guarded RSS/Atom discovery -> metadata-only staging.

No background polling, no public HTTP endpoint and no default enabled source.
Approved rights are checked by the DB both before network access and on commit.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import ipaddress
import os
import re
import socket
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree

import httpx

from .repository import WorkerRepository

USER_AGENT = "SmartSteelSales-SteelPulse/0.1 (+source-rights-reviewed)"
MAX_FEED_BYTES = 512_000
MAX_ROBOTS_BYTES = 128_000
MAX_ITEMS = 25
MAX_URL_LENGTH = 1024
TIMEOUT_SECONDS = 8.0
CODE_FAILURE = {
    "robots_denied", "robots_unavailable", "feed_unavailable",
    "feed_not_xml", "feed_too_large", "invalid_feed",
    "network_error", "invalid_url", "policy_error",
}


class SteelPulseIngestionError(Exception):
    def __init__(self, code: str):
        if code not in CODE_FAILURE:
            code = "policy_error"
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class FeedPermission:
    run_id: str
    feed_url: str
    allowed_hosts: tuple[str, ...]
    approval_evidence_url: str
    policy_url: str


def canonical_url(url: str, hosts: tuple[str, ...]) -> str:
    """Accept only a source-allowlisted HTTPS hostname. Do not store query PII."""
    if not isinstance(url, str) or len(url) > 2500 or any(x.isspace() for x in url):
        raise SteelPulseIngestionError("invalid_url")
    try:
        parts = urlsplit(url)
        hostname = (parts.hostname or "").lower()
        if (
            parts.scheme != "https"
            or not hostname
            or hostname not in hosts
            or parts.port is not None
            or parts.username is not None
            or parts.password is not None
            or "\\" in url
        ):
            raise SteelPulseIngestionError("invalid_url")
        if ipaddress.ip_address(hostname).is_global is False:
            raise SteelPulseIngestionError("invalid_url")
    except ValueError:
        # Not an IP literal: only vetted DNS hostnames are eligible.
        if not hostname or not re.fullmatch(r"[a-z0-9.-]{3,253}", hostname):
            raise SteelPulseIngestionError("invalid_url")
    except (TypeError, AttributeError):
        raise SteelPulseIngestionError("invalid_url") from None
    path = parts.path or "/"
    safe = urlunsplit(("https", hostname, path, "", ""))
    if len(safe) > MAX_URL_LENGTH or "#" in path or "?" in path:
        raise SteelPulseIngestionError("invalid_url")
    return safe


async def assert_public_dns(hostname: str) -> None:
    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo, hostname, 443, type=socket.SOCK_STREAM
        )
    except (socket.gaierror, OSError) as exc:
        raise SteelPulseIngestionError("network_error") from exc
    if not addresses or any(
        not ipaddress.ip_address(address[4][0]).is_global
        for address in addresses
    ):
        raise SteelPulseIngestionError("invalid_url")


async def bounded_get(client: httpx.AsyncClient, url: str, cap: int) -> bytes:
    """Never follow redirects; enforce content cap while streaming."""
    try:
        async with client.stream("GET", url, follow_redirects=False) as response:
            if response.status_code != 200:
                raise SteelPulseIngestionError("feed_unavailable")
            chunks = bytearray()
            async for part in response.aiter_bytes():
                chunks.extend(part)
                if len(chunks) > cap:
                    raise SteelPulseIngestionError("feed_too_large")
            return bytes(chunks)
    except httpx.HTTPError as exc:
        raise SteelPulseIngestionError("network_error") from exc


def _date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (ValueError, TypeError, IndexError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).isoformat()


def parse_feed(xml: bytes, hosts: tuple[str, ...]) -> list[dict[str, str]]:
    if len(xml) > MAX_FEED_BYTES or b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
        raise SteelPulseIngestionError("invalid_feed")
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError as exc:
        raise SteelPulseIngestionError("invalid_feed") from exc
    root_type = root.tag.rsplit("}", 1)[-1]
    is_atom = root_type == "feed"
    if not is_atom and root_type not in {"rss", "RDF"}:
        raise SteelPulseIngestionError("invalid_feed")
    nodes = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1] ==
             ("entry" if is_atom else "item")]
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for node in nodes[: MAX_ITEMS * 5]:
        def node_text(*names: str) -> str | None:
            for child in node:
                if child.tag.rsplit("}", 1)[-1] in names and child.text:
                    return child.text.strip()[:1500]
            return None

        link = None
        if is_atom:
            for child in node:
                if child.tag.rsplit("}", 1)[-1] == "link" and child.attrib.get("rel", "alternate") == "alternate":
                    link = child.attrib.get("href")
                    if link:
                        break
        else:
            link = node_text("link")
        if not link:
            continue
        try:
            url = canonical_url(link, hosts)
        except SteelPulseIngestionError:
            continue
        if url in seen:
            continue
        seen.add(url)
        item: dict[str, str] = {"canonical_url": url}
        guid = node_text("guid", "id")
        if guid:
            item["source_guid_hash"] = hashlib.sha256(guid.encode()).hexdigest()
        published = _date(node_text("pubDate", "published", "updated", "date"))
        if published:
            item["published_at"] = published
        items.append(item)
        if len(items) >= MAX_ITEMS:
            break
    return items


async def discover_approved_feed(permission: FeedPermission, *, client: httpx.AsyncClient) -> list[dict[str, str]]:
    feed = canonical_url(permission.feed_url, permission.allowed_hosts)
    host = urlsplit(feed).hostname
    assert host
    await assert_public_dns(host)
    robots_url = f"https://{host}/robots.txt"
    try:
        robots = await bounded_get(client, robots_url, MAX_ROBOTS_BYTES)
    except SteelPulseIngestionError as exc:
        if exc.code in {"feed_unavailable", "feed_too_large"}:
            raise SteelPulseIngestionError("robots_unavailable") from exc
        raise
    robot_lines = robots.decode("utf-8", errors="replace").splitlines()
    parser = RobotFileParser()
    parser.parse(robot_lines)
    if not parser.can_fetch(USER_AGENT, feed):
        raise SteelPulseIngestionError("robots_denied")
    content = await bounded_get(client, feed, MAX_FEED_BYTES)
    if not content.lstrip().startswith(b"<?xml") and not content.lstrip().startswith((b"<rss", b"<feed", b"<rdf")):
        raise SteelPulseIngestionError("feed_not_xml")
    return parse_feed(content, permission.allowed_hosts)


class SteelPulseRepository:
    """Only service role can begin/complete server-side runs, validated by SQL."""

    def __init__(self, repo: WorkerRepository | None = None):
        self.repo = repo or WorkerRepository()

    async def begin(self, source_id: str) -> FeedPermission | None:
        response = await self.repo._request(
            "POST", "/rest/v1/rpc/sp2_begin_feed_run",
            json={"p_source_id": source_id},
        )
        if not isinstance(response, dict) or response.get("allowed") is not True:
            return None
        if not all(response.get(k) for k in (
            "run_id", "feed_url", "allowed_hosts", "approval_evidence_url", "policy_url"
        )):
            raise SteelPulseIngestionError("policy_error")
        return FeedPermission(
            run_id=str(response["run_id"]),
            feed_url=str(response["feed_url"]),
            allowed_hosts=tuple(response["allowed_hosts"]),
            approval_evidence_url=str(response["approval_evidence_url"]),
            policy_url=str(response["policy_url"]),
        )

    async def finish(
        self, run_id: str, *, items: list[dict[str, str]] | None = None,
        failure_code: str | None = None,
    ) -> dict:
        response = await self.repo._request(
            "POST", "/rest/v1/rpc/sp2_finish_feed_run",
            json={"p_run_id": run_id, "p_items": items or [], "p_failure_code": failure_code},
        )
        if not isinstance(response, dict) or response.get("ok") is not True:
            raise SteelPulseIngestionError("policy_error")
        return response


async def run_steel_pulse_source(
    source_id: str, *,
    repository: SteelPulseRepository | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> dict:
    if os.getenv("STEEL_PULSE_INGESTION_ENABLED", "false").lower() != "true":
        return {"state": "disabled"}
    if not re.fullmatch(r"[a-z0-9_-]{2,50}", source_id):
        return {"state": "source_not_authorized"}
    repo = repository or SteelPulseRepository()
    permission = await repo.begin(source_id)
    if permission is None:
        return {"state": "source_not_authorized"}

    async def _work(client: httpx.AsyncClient) -> dict:
        try:
            items = await discover_approved_feed(permission, client=client)
            return await repo.finish(permission.run_id, items=items)
        except SteelPulseIngestionError as exc:
            await repo.finish(permission.run_id, failure_code=exc.code)
            return {"state": "failed", "failure_code": exc.code}
        except Exception:
            await repo.finish(permission.run_id, failure_code="network_error")
            return {"state": "failed", "failure_code": "network_error"}

    if http_client is not None:
        return await _work(http_client)
    async with httpx.AsyncClient(
        follow_redirects=False, trust_env=False,
        timeout=TIMEOUT_SECONDS, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml"},
    ) as client:
        return await _work(client)


def main() -> None:
    parser = argparse.ArgumentParser(description="SP2 guarded source ingestion (manual; disabled by default)")
    parser.add_argument("--source", required=True)
    args = parser.parse_args()
    print(asyncio.run(run_steel_pulse_source(args.source)))


if __name__ == "__main__":
    main()
