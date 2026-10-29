#!/usr/bin/env python3
"""E3.B sealed-bundle integrity verification and explicit isolated restore.

No production destination is accepted. Restore requires a new dedicated project
and a locally isolated PostgreSQL database; neither is inferred from staging.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request

from e3b_production_backup import (
    NoRedirect, PRODUCTION_REF, SCHEMA, CHUNK, download_object,
    require_env, run_checked, sha256_file, storage_path
)

VALIDATION_REF = "lwrrrphakpbjhbzljqhn"
RESTRICTED_REFS = {PRODUCTION_REF, VALIDATION_REF}


def extract_verified(encrypted: Path, identity: Path, scratch: Path) -> tuple[dict, Path]:
    archive = scratch / "decrypted.tar"
    run_checked(["age", "--decrypt", "--identity", str(identity),
                 "--output", str(archive), str(encrypted)])
    dest = scratch / "verified"
    dest.mkdir(mode=0o700)
    with tarfile.open(archive, mode="r:") as tar:
        members = {item.name: item for item in tar.getmembers()}
        if set(members) < {"manifest.json", "db.dump"} or any(
            not m.isfile() or m.issym() or m.islnk() for m in members.values()
        ):
            raise RuntimeError("Invalid sealed archive member types")
        manifest_file = tar.extractfile("manifest.json")
        if manifest_file is None:
            raise RuntimeError("Missing sealed manifest")
        manifest = json.load(manifest_file)
        if manifest.get("schema") != SCHEMA or manifest.get("source_ref") != PRODUCTION_REF:
            raise RuntimeError("Archive is not from approved production source")
        objects = manifest.get("objects")
        buckets = manifest.get("buckets")
        if not isinstance(objects, list) or not isinstance(buckets, list):
            raise RuntimeError("Malformed bucket/object manifest")
        if len({b["id"] for b in buckets}) != len(buckets):
            raise RuntimeError("Duplicate buckets")
        if len({(obj["bucket_id"], obj["key"]) for obj in objects}) != len(objects):
            raise RuntimeError("Duplicate object names")
        if not set(obj["bucket_id"] for obj in objects).issubset({b["id"] for b in buckets}):
            raise RuntimeError("Unknown object bucket")
        expected = {"manifest.json", "db.dump"} | {
            "objects/" + obj["file"] for obj in objects
        }
        if set(members) != expected or any(
            not re.fullmatch(r"\d{6}\.blob", obj["file"]) for obj in objects
        ):
            raise RuntimeError("Unexpected archive members or object paths")
        for name in sorted(expected - {"manifest.json"}):
            member = tar.extractfile(name)
            if member is None:
                raise RuntimeError("Unreadable archive member")
            output = dest / name
            output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with output.open("xb") as handle:
                while block := member.read(CHUNK):
                    handle.write(block)
        if ((dest / "db.dump").stat().st_size != manifest["db_bytes"] or
                sha256_file(dest / "db.dump") != manifest["db_sha256"]):
            raise RuntimeError("Database archive integrity mismatch")
        for obj in objects:
            path = dest / "objects" / obj["file"]
            if path.stat().st_size != obj["bytes"] or sha256_file(path) != obj["sha256"]:
                raise RuntimeError("Storage byte integrity mismatch")
    archive.unlink()
    return manifest, dest


def json_api(url: str, key: str, method: str, payload: object | None = None) -> object:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, method=method,
        headers={"Authorization": "Bearer " + key, "apikey": key,
                 "Content-Type": "application/json"},
    )
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=40) as response:
            return json.loads(response.read())
    except (urllib.error.HTTPError, urllib.error.URLError):
        raise RuntimeError("Isolated Storage API request failed (details withheld)") from None


def restore_storage(manifest: dict, directory: Path) -> int:
    ref = require_env("E3B_ISOLATED_TARGET_REF")
    key = require_env("E3B_ISOLATED_TARGET_SERVICE_ROLE_KEY")
    if ref in RESTRICTED_REFS or not re.fullmatch(r"[a-z0-9]{20}", ref):
        raise RuntimeError("Refuse production/validation or malformed isolated target")
    if os.getenv("E3B_ISOLATED_RESTORE_ACK") != "restore-to-empty-" + ref:
        raise RuntimeError("Restore requires a dedicated empty target and human authorization")
    base = "https://" + ref + ".supabase.co"
    existing = json_api(base + "/storage/v1/bucket", key, "GET")
    if not isinstance(existing, list) or existing:
        raise RuntimeError("Refuse to write into target containing Storage buckets")
    for bucket in manifest["buckets"]:
        payload = {"id": bucket["id"], "name": bucket["id"], "public": bucket["public"]}
        if bucket.get("file_size_limit") is not None:
            payload["file_size_limit"] = bucket["file_size_limit"]
        if bucket.get("allowed_mime_types") is not None:
            payload["allowed_mime_types"] = bucket["allowed_mime_types"]
        json_api(base + "/storage/v1/bucket", key, "POST", payload)
    count = 0
    for obj in manifest["objects"]:
        data = (directory / "objects" / obj["file"]).read_bytes()
        url = base + storage_path(obj["bucket_id"], obj["key"]).replace(
            "/storage/v1/object/authenticated/", "/storage/v1/object/", 1
        )
        req = urllib.request.Request(
            url, method="POST", data=data,
            headers={"Authorization": "Bearer " + key, "apikey": key,
                     "Content-Type": obj["mimetype"], "x-upsert": "false"},
        )
        try:
            with urllib.request.build_opener(NoRedirect).open(req, timeout=90) as response:
                if response.status not in (200, 201):
                    raise RuntimeError("Isolated Storage upload status invalid")
        except (urllib.error.HTTPError, urllib.error.URLError):
            raise RuntimeError("Isolated Storage upload failed (no key exposed)") from None
        size, digest = download_object(base, key, obj["bucket_id"], obj["key"],
                                       directory / ("verify-%06d" % count))
        if size != obj["bytes"] or digest != obj["sha256"]:
            raise RuntimeError("Isolated Storage restored bytes differ from source")
        count += 1
    return count


def restore_db(directory: Path, manifest: dict) -> None:
    if os.getenv("E3B_LOCAL_DB_RESTORE_ACK") != "dedicated-disposable-local-database":
        raise RuntimeError("Isolated local database restoration not approved")
    if os.getenv("E3B_RESTORE_PGHOST") != "127.0.0.1":
        raise RuntimeError("Only localhost isolated PostgreSQL restoration is supported")
    database = require_env("E3B_RESTORE_PGDATABASE")
    if not re.fullmatch(r"e3b_restore_[a-z0-9_]+", database):
        raise RuntimeError("Use a uniquely named empty e3b_restore_ database")
    pg_env = os.environ.copy()
    pg_env["PGHOST"] = "127.0.0.1"
    pg_env["PGDATABASE"] = database
    pg_env["PGUSER"] = require_env("E3B_RESTORE_PGUSER")
    pg_env["PGPASSWORD"] = require_env("E3B_RESTORE_PGPASSWORD")
    pg_env["PGPORT"] = require_env("E3B_RESTORE_PGPORT")
    # Refuse to restore into nonempty database; no --clean and no CREATE DATABASE.
    non_system = run_checked(["psql", "-X", "-A", "-t", "-c",
        "select count(*) from pg_namespace where nspname not like 'pg_%' "
        "and nspname not in ('public','information_schema');"], environment=pg_env)
    if non_system != "0":
        raise RuntimeError("Destination contains schemas; refusing non-disposable restore")
    run_checked(["pg_restore", "--no-owner", "--no-acl", "--exit-on-error",
                 "--dbname", database, str(directory / "db.dump")], environment=pg_env)
    rows = run_checked(["psql", "-X", "-A", "-t", "-c",
                        "select count(*) from storage.objects;"], environment=pg_env)
    if int(rows) != len(manifest["objects"]):
        raise RuntimeError("Restored metadata object count does not match manifest")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--encrypted-archive", required=True, type=Path)
    parser.add_argument("--age-identity", required=True, type=Path)
    parser.add_argument("--restore-storage", action="store_true")
    parser.add_argument("--restore-db", action="store_true")
    args = parser.parse_args()
    if os.getenv("CI") or os.getenv("GITHUB_ACTIONS"):
        raise RuntimeError("Customer archives may never be decrypted in CI")
    if os.getenv("E3B_ENCRYPTED_DISK_ACK") != "encrypted-scratch-confirmed":
        raise RuntimeError("An encrypted operator-controlled working filesystem is required")
    root = Path(require_env("E3B_SECURE_WORKDIR")).resolve()
    if not root.is_dir() or not args.age_identity.is_file():
        raise RuntimeError("Private restore staging area and age identity required")
    if not args.encrypted_archive.is_file():
        raise RuntimeError("Encrypted backup archive not present")
    with tempfile.TemporaryDirectory(prefix="e3b-verify-", dir=root) as temp:
        manifest, directory = extract_verified(args.encrypted_archive, args.age_identity, Path(temp))
        if args.restore_db:
            restore_db(directory, manifest)
        restored = restore_storage(manifest, directory) if args.restore_storage else 0
        print(json.dumps({"source": PRODUCTION_REF, "integrity_verified": True,
                          "storage_objects_verified_offline": len(manifest["objects"]),
                          "restored_storage_objects": restored,
                          "database_restored": bool(args.restore_db),
                          "storage_restored": bool(args.restore_storage),
                          "pilot_authorized": False}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("E3.B NO-GO: " + str(error), file=sys.stderr)
        raise SystemExit(1)
