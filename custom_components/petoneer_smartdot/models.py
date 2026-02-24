"""Data models for the Petoneer Smart Dot integration."""
from __future__ import annotations

from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry

from .bluetooth import PetoneerBLEClient


@dataclass
class PetoneerData:
    """Runtime data stored on the config entry."""

    title: str
    client: PetoneerBLEClient


type PetoneerConfigEntry = ConfigEntry[PetoneerData]

