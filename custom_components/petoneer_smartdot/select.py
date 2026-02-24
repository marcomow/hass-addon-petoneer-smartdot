"""Select entity for Petoneer Smart Dot."""
from __future__ import annotations

import logging
from collections.abc import Callable

from homeassistant.components import mqtt
from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_COMMAND_TOPIC, CONF_STATE_TOPIC, DOMAIN, PRESETS

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Petoneer Smart Dot select entity from a config entry."""
    async_add_entities([SmartDotSelect(hass, config_entry)])


class SmartDotSelect(SelectEntity):
    """Representation of a Petoneer Smart Dot preset selector."""

    _attr_name = "Petoneer Smart Dot"
    _attr_options = PRESETS
    _attr_current_option = "stop"
    _attr_icon = "mdi:paw"

    def __init__(self, hass: HomeAssistant, config_entry: ConfigEntry) -> None:
        """Initialise the entity."""
        self.hass = hass
        self._config_entry = config_entry
        self._command_topic: str = config_entry.data[CONF_COMMAND_TOPIC]
        self._state_topic: str = config_entry.data[CONF_STATE_TOPIC]
        self._unsubscribe: Callable[[], None] | None = None
        # Unique ID is scoped to the config entry so multiple devices can coexist.
        self._attr_unique_id = f"{config_entry.entry_id}_preset"

    async def async_added_to_hass(self) -> None:
        """Subscribe to MQTT state topic when entity is added."""

        @callback
        def state_received(msg: mqtt.ReceiveMessage) -> None:
            value = msg.payload
            if value in PRESETS:
                self._attr_current_option = value
                self.async_write_ha_state()
            else:
                _LOGGER.warning("Received unknown state value: %s", value)

        self._unsubscribe = await mqtt.async_subscribe(
            self.hass, self._state_topic, state_received
        )

    async def async_will_remove_from_hass(self) -> None:
        """Unsubscribe from MQTT when entity is removed."""
        if self._unsubscribe is not None:
            self._unsubscribe()

    async def async_select_option(self, option: str) -> None:
        """Publish the selected preset command to MQTT.

        State is intentionally NOT updated optimistically here.  The BLE bridge
        publishes a confirmed state on the state topic only after a successful
        write, so the entity state will be updated via the MQTT subscription
        once the command has actually been executed.
        """
        _LOGGER.debug("Publishing command '%s' to %s", option, self._command_topic)
        await mqtt.async_publish(self.hass, self._command_topic, option)
