"""Backward-compatible import surface for the retired v3.1 parser adapter.

The worker historically imports ParserV31Adapter from this module. P0.6 keeps that
import path stable while routing execution to the v4 contract, so existing worker
code and integrations do not need an atomic import-path change.
"""

from .parser_v4 import ParserInput, ParserResult, ParserV4Adapter

ParserV31Adapter = ParserV4Adapter

__all__ = ["ParserInput", "ParserResult", "ParserV31Adapter"]
