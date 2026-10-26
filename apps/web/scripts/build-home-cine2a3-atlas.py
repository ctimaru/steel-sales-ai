#!/usr/bin/env python3
"""HOME-CINE2A.3: one reproducible, licensed Pexels photo strip for five tools.
Not a user data import. Images are stock illustrations, never named steel partners.
This one-off production task commits only the optimized local WebP sprite.
"""
from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ASSETS = [
    ("calculator", 15508177),
    ("distinta", 8470810),
    ("rfq", 29224600),
    ("network", 14314638),
    ("school", 32845698),
]
PHOTO_WIDTH = 210
PHOTO_HEIGHT = 84
MAX_BYTES = 50_000
DEST = Path(__file__).resolve().parents[1] / "public/home-cine2a3-five-photo-atlas.webp"

def download_image(name: str, pexels_id: int) -> Image.Image:
    url = (
        f"https://images.pexels.com/photos/{pexels_id}/"
        f"pexels-photo-{pexels_id}.jpeg?auto=compress&cs=tinysrgb&w=960"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "SmartSteelSales-AssetBuild/1.0"})
    with urllib.request.urlopen(req, timeout=40) as response:
        origin = response.url
        if not origin.startswith("https://images.pexels.com/"):
            raise RuntimeError(f"{name}: unexpected image origin")
        mime = response.headers.get("Content-Type", "")
        if not mime.startswith("image/"):
            raise RuntimeError(f"{name}: response is not an image")
        data = response.read(3_000_001)
    if len(data) > 3_000_000:
        raise RuntimeError(f"{name}: oversized upstream response")
    image = Image.open(io.BytesIO(data))
    image.load()
    if image.width < 500 or image.height < 250:
        raise RuntimeError(f"{name}: source resolution too small")
    return image.convert("RGB")

def make() -> None:
    atlas = Image.new("RGB", (PHOTO_WIDTH, PHOTO_HEIGHT * len(ASSETS)))
    for i, (name, ident) in enumerate(ASSETS):
        image = download_image(name, ident)
        image = ImageOps.fit(image, (PHOTO_WIDTH, PHOTO_HEIGHT), method=Image.Resampling.LANCZOS,
                             centering=(0.5, 0.48))
        # Mildly unify independent photographic sources in the steel/emerald palette.
        image = ImageEnhance.Color(image).enhance(0.77)
        image = ImageEnhance.Contrast(image).enhance(1.08)
        tint = Image.new("RGB", image.size, (3, 24, 18))
        image = Image.blend(image, tint, 0.17)
        atlas.paste(image, (0, i * PHOTO_HEIGHT))
    DEST.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(DEST, format="WEBP", quality=70, method=6)
    total = DEST.stat().st_size
    if total > MAX_BYTES:
        raise RuntimeError(f"Atlas exceeds 50KB budget: {total}B")
    check = Image.open(DEST)
    if check.size != (210, 420) or check.format != "WEBP":
        raise RuntimeError("Invalid photo atlas output")
    print(f"HOME-CINE2A.3 asset: {total} bytes; SHA256 {hashlib.sha256(DEST.read_bytes()).hexdigest()}")

if __name__ == "__main__":
    make()
