"""Config flow for Petoneer Smart Dot integration."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import (
    CONF_COMMAND_TOPIC,
    CONF_STATE_TOPIC,
    DEFAULT_COMMAND_TOPIC,
    DEFAULT_STATE_TOPIC,
    DOMAIN,
)


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Petoneer Smart Dot."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            return self.async_create_entry(
                title="Petoneer Smart Dot",
                data=user_input,
            )

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_COMMAND_TOPIC, default=DEFAULT_COMMAND_TOPIC
                ): str,
                vol.Required(
                    CONF_STATE_TOPIC, default=DEFAULT_STATE_TOPIC
                ): str,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )
