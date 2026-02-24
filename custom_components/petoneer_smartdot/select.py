"""Select entity for Petoneer Smart Dot."""
from __future__ import annotations

import logging

from homeassistant.components.select import SelectEntity
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, PRESETS
from .models import PetoneerConfigEntry

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: PetoneerConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Petoneer Smart Dot select entity from a config entry."""
    async_add_entities([SmartDotSelect(config_entry)])


class SmartDotSelect(SelectEntity):
    """Representation of a Petoneer Smart Dot preset selector."""

    _attr_has_entity_name = True
    _attr_name = "Preset"
    _attr_options = PRESETS
    _attr_current_option = "stop"
    _attr_icon = "mdi:paw"

    def __init__(self, config_entry: PetoneerConfigEntry) -> None:
        """Initialise the entity."""
        self._client = config_entry.runtime_data.client
        address: str = config_entry.data[CONF_ADDRESS]
        self._attr_unique_id = f"{config_entry.entry_id}_preset"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, address)},
            name=config_entry.title,
            model="Smart Dot",
            manufacturer="Petoneer",
        )

    async def async_select_option(self, option: str) -> None:
        """Send the selected preset to the device.

        Always sends 'stop' first (mirrors the original Deno bridge behaviour),
        then sends the actual preset if it differs from 'stop'.
        State is updated optimistically on success.
        """
        # Always stop first so the laser motor is safely parked.
        if not await self._client.send_command("stop"):
            _LOGGER.error("Failed to send stop command before preset '%s'", option)
            return

        if option != "stop":
            if not await self._client.send_command(option):
                _LOGGER.error("Failed to send preset command '%s'", option)
                return

        self._attr_current_option = option
        self.async_write_ha_state()
