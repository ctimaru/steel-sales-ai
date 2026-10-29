#!/usr/bin/env python3
"""E3.B supervised real backup to a private versioned S3 bucket.

Never called from CI; never exports any customer bytes without explicit operator
attestation, isolated encrypted scratch volume, and preconfigured offsite S3.
This tool does not certify disaster recovery: isolated RESTORE is mandatory.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request

PRODUCTION_REF = "ecrafjdummcdfycznitx"
SCHEMA = "e3b-backup-v1"
CHUNK = 1024 * 256
INVENTORY_SQL = """
select jsonb_build_object(
  'auth_users_count',(select count(*) from auth.users),
  'buckets',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',b.id,'public',b.public,
      'file_size_limit',b.file_size_limit,
      'allowed_mime_types',b.allowed_mime_types) order by b.id)
    from storage.buckets b), '[]'::jsonb),
  'objects',coalesce((
    select jsonb_agg(jsonb_build_object(
      'bucket_id',o.bucket_id,'name',o.name,
      'size',o.metadata->>'size','mimetype',o.metadata->>'mimetype')
      order by o.bucket_id,o.name)
    from storage.objects o), '[]'::jsonb)
)::text;
"""


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError("Missing operator prerequisite: " + name)
    return value


def run_checked(argv: list[str], *, environment: dict | None = None) -> str:
    result = subprocess.run(
        argv, env=environment, capture_output=True, text=True, check=False
    )
    if result.returncode:
        # Never echo process output: it may include private paths or auth values.
        raise RuntimeError("Command failed, inspect protected operator console: " + argv[0])
    return result.stdout.strip()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def storage_path(bucket: str, key: str) -> str:
    if not bucket or not key or bucket in (".", "..") or "\x00" in key:
        raise RuntimeError("Invalid Storage inventory item")
    return ("/storage/v1/object/authenticated/"
            + urllib.parse.quote(bucket, safe="")
            + "/" + urllib.parse.quote(key, safe="/"))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def download_object(base_url: str, token: str, bucket: str, key: str, destination: Path) -> tuple[int, str]:
    request = urllib.request.Request(
        base_url + storage_path(bucket, key),
        headers={"Authorization": "Bearer " + token, "apikey": token},
    )
    opener = urllib.request.build_opener(NoRedirect)
    digest = hashlib.sha256()
    size = 0
    try:
        with opener.open(request, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError("Storage download did not return 200")
            with destination.open("xb") as out:
                while block := response.read(CHUNK):
                    out.write(block)
                    digest.update(block)
                    size += len(block)
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        raise RuntimeError("Storage source download failed; no object name logged") from None
    return size, digest.hexdigest()


def safe_config() -> tuple[str, Path, str, str]:
    if os.getenv("CI") or os.getenv("GITHUB_ACTIONS"):
        raise RuntimeError("Refuse production-data export in CI or GitHub Actions")
    if os.getenv("E3B_OPERATOR_ACK") != "approved-encrypted-offsite-backup":
        raise RuntimeError("Missing human approval for real backup export")
    if os.getenv("E3B_ENCRYPTED_DISK_ACK") != "encrypted-scratch-confirmed":
        raise RuntimeError("Private data must be staged on an operator-verified encrypted filesystem")
    ref = require_env("E3B_SOURCE_REF")
    if ref != PRODUCTION_REF:
        raise RuntimeError("Source project does not match the reviewed production project")
    host, user = require_env("PGHOST"), require_env("PGUSER")
    if not (host == "db." + ref + ".supabase.co" or (
        host.endswith(".pooler.supabase.com") and user == "postgres." + ref
    )):
        raise RuntimeError("Database connection does not match approved source identity")
    require_env("PGPASSWORD")
    require_env("PGDATABASE")
    require_env("PGPORT")
    token = require_env("E3B_SOURCE_SERVICE_ROLE_KEY")
    if token.startswith("sb_secret_") or token.count(".") != 2:
        raise RuntimeError("This REST adapter requires a legacy signed service_role JWT")
    recipient = require_env("E3B_AGE_RECIPIENT")
    if not re.fullmatch(r"age1[0-9a-z]{55,}", recipient):
        raise RuntimeError("Expected an age X25519 public recipient")
    root = Path(require_env("E3B_SECURE_WORKDIR")).resolve()
    if not root.is_dir() or root.is_symlink() or not root.is_absolute():
        raise RuntimeError("Private scratch root must be an existing encrypted directory")
    bucket = require_env("E3B_S3_BUCKET")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{2,62}", bucket):
        raise RuntimeError("S3 bucket name is invalid")
    return ref, root, token, recipient


def s3_preflight(bucket: str) -> None:
    version = json.loads(run_checked(["aws", "s3api", "get-bucket-versioning", "--bucket", bucket]))
    access = json.loads(run_checked(["aws", "s3api", "get-public-access-block", "--bucket", bucket]))
    run_checked(["aws", "s3api", "get-bucket-encryption", "--bucket", bucket])
    pab = access.get("PublicAccessBlockConfiguration", {})
    if version.get("Status") != "Enabled" or not all(pab.get(x) is True for x in (
        "BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"
    )):
        raise RuntimeError("Offsite S3 bucket must be private and versioned")


def db_query(sql: str) -> str:
    return run_checked(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql])


def ensure_no_go() -> None:
    result = db_query("""
        select (select enabled from private.pilot_activation_release_gate where singleton)::text
          || ',' || (select count(*) from public.marketplace_pilot_participants where status='active')::text
          || ',' || (select count(*) from public.pilot_activation_preferences where decision='granted')::text;
    """)
    if result.strip() != "false,0,0":
        raise RuntimeError("Refusing export: pre-pilot NO-GO invariants not satisfied")


def encrypt_bundle(directory: Path, output: Path, recipient: str) -> None:
    with subprocess.Popen(
        ["age", "-r", recipient, "-o", str(output)],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    ) as proc:
        assert proc.stdin is not None
        try:
            with tarfile.open(fileobj=proc.stdin, mode="w|") as tar:
                for file in sorted((directory / "database").iterdir()):
                    tar.add(file, arcname="database/" + file.name, recursive=False)
                tar.add(directory / "manifest.json", arcname="manifest.json", recursive=False)
                for file in sorted((directory / "objects").iterdir()):
                    tar.add(file, arcname="objects/" + file.name, recursive=False)
        finally:
            if not proc.stdin.closed:
                proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("Age encrypted bundle could not be created")


def main() -> int:
    ref, root, token, recipient = safe_config()
    bucket = require_env("E3B_S3_BUCKET")
    s3_preflight(bucket)
    for cmd in ("psql", "supabase", "age", "aws", "docker"):
        if shutil.which(cmd) is None:
            raise RuntimeError("Missing prerequisite binary: " + cmd)
    linked = Path("supabase/.temp/project-ref")
    if not linked.is_file() or linked.read_text(encoding="utf-8").strip() != ref:
        raise RuntimeError("Supabase CLI must be linked to the approved source project")
    require_env("SUPABASE_ACCESS_TOKEN")
    flags = run_checked(["supabase", "db", "dump", "--help"])
    for required in ("--linked", "--role-only", "--data-only", "--use-copy", "--schema"):
        if required not in flags:
            raise RuntimeError("Unsupported Supabase CLI dump contract: " + required)
    ensure_no_go()
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    base_url = "https://" + ref + ".supabase.co"
    with tempfile.TemporaryDirectory(prefix="e3b-operator-", dir=root) as temp:
        directory = Path(temp)
        source = directory / "plaintext"
        (source / "objects").mkdir(parents=True, mode=0o700)
        (source / "database").mkdir(mode=0o700)
        os.chmod(source, 0o700)
        inventory = json.loads(db_query(INVENTORY_SQL))
        buckets, objects = inventory["buckets"], inventory["objects"]
        if len({b["id"] for b in buckets}) != len(buckets):
            raise RuntimeError("Duplicate Storage bucket IDs")
        known_buckets = {b["id"] for b in buckets}
        if any(o["bucket_id"] not in known_buckets for o in objects):
            raise RuntimeError("Storage object with unknown bucket")
        if len({(o["bucket_id"], o["name"]) for o in objects}) != len(objects):
            raise RuntimeError("Ambiguous Storage object keys")

        # Supabase official filtered exports, NOT raw pg_dump of managed internals.
        # Explicit Auth/Storage data and migration provenance are supplemental.
        dumps = {
            "roles.sql": ["--role-only"],
            "schema.sql": [],
            "data.sql": ["--data-only", "--use-copy", "--exclude", "storage.buckets_vectors",
                         "--exclude", "storage.vector_indexes"],
            "auth_data.sql": ["--data-only", "--use-copy", "--schema", "auth"],
            "storage_metadata.sql": ["--data-only", "--use-copy", "--schema", "storage"],
            "history_schema.sql": ["--schema", "supabase_migrations"],
            "history_data.sql": ["--data-only", "--use-copy", "--schema", "supabase_migrations"],
        }
        db_files = {}
        for filename, extra in dumps.items():
            destination = source / "database" / filename
            run_checked(["supabase", "db", "dump", "--linked", "--file", str(destination), *extra])
            if not destination.is_file() or destination.stat().st_size == 0:
                raise RuntimeError("A required filtered database export was empty: " + filename)
            db_files[filename] = {"bytes": destination.stat().st_size,
                                  "sha256": sha256_file(destination)}
        saved = []
        for idx, obj in enumerate(objects):
            filename = ("%06d.blob" % idx)
            size, sha = download_object(base_url, token, obj["bucket_id"], obj["name"],
                                        source / "objects" / filename)
            if obj["size"] is None or not str(obj["size"]).isdigit() or size != int(obj["size"]):
                raise RuntimeError("Storage source inventory / byte-size drift; abandon snapshot")
            saved.append({"bucket_id": obj["bucket_id"], "key": obj["name"], "file": filename,
                          "bytes": size, "sha256": sha,
                          "mimetype": obj.get("mimetype") or "application/octet-stream"})
        # Fail rather than seal an export when buckets, keys or sizes changed
        # during the DB/Storage read window; this is not an atomic snapshot.
        if json.loads(db_query(INVENTORY_SQL)) != inventory:
            raise RuntimeError("Source Storage inventory changed during export")
        ensure_no_go()
        (source / "manifest.json").write_text(json.dumps({
            "schema": SCHEMA, "source_ref": ref, "started_at_utc": timestamp,
            "completed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "database_files": db_files, "auth_users_count": inventory["auth_users_count"],
            "buckets": buckets, "objects": saved,
            "consistency_note": "Non-atomic DB/Storage snapshot; operator must validate recovery point."
        }, separators=(",", ":")), encoding="utf-8")
        cipher = directory / "encrypted-snapshot.age"
        encrypt_bundle(source, cipher, recipient)
        if not cipher.is_file() or cipher.stat().st_size < 100:
            raise RuntimeError("Encrypted backup archive missing")
        cipher_hash = sha256_file(cipher)
        key = ("smart-steel-sales/e3b/" + dt.datetime.now(dt.timezone.utc).strftime("%Y/%m/%d/")
               + cipher_hash[:20] + ".tar.age")
        run_checked(["aws", "s3", "cp", str(cipher), "s3://" + bucket + "/" + key,
                     "--only-show-errors", "--sse", "AES256"])
        head = json.loads(run_checked(["aws", "s3api", "head-object",
                                       "--bucket", bucket, "--key", key]))
        if head.get("ContentLength") != cipher.stat().st_size or not head.get("VersionId"):
            raise RuntimeError("Offsite encrypted object not verifiable; do not approve")
        # Do not certify upload on size alone. Verify the bytes actually returned
        # by the encrypted offsite destination; never decrypt at S3.
        fetched = directory / "offsite-roundtrip.age"
        run_checked(["aws", "s3", "cp", "s3://" + bucket + "/" + key,
                     str(fetched), "--only-show-errors"])
        if sha256_file(fetched) != cipher_hash:
            raise RuntimeError("Encrypted offsite round-trip checksum mismatch")
        evidence = {"phase": "EXPORTED_NOT_RESTORED", "source_ref": ref,
                    "database_exports": len(db_files), "ciphertext_sha256": cipher_hash,
                    "storage_buckets": len(buckets), "storage_objects": len(saved),
                    "storage_object_bytes": sum(x["bytes"] for x in saved),
                    "offsite_versioned": True,
                    "restore_verified": False, "pilot_authorized": False}
        print(json.dumps(evidence, sort_keys=True))
        # Operator retrieves the encrypted key via their authorized S3 inventory.
        # No plaintext, Storage paths, tokens or archive uploaded to GitHub.
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("E3.B NO-GO: " + str(error), file=sys.stderr)
        raise SystemExit(1)
