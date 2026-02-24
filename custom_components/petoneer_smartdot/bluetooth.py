"""BLE client for the Petoneer Smart Dot (PetCat) device."""
from __future__ import annotations

import asyncio
import logging

from bleak import BleakClient, BleakError
from bleak.backends.device import BLEDevice

from .const import CHARACTERISTIC_UUID, COMMANDS

_LOGGER = logging.getLogger(__name__)


class PetoneerBLEClient:
    """Manages BLE communication with a single PetCat device.

    Uses a connect-on-demand model: the adapter is acquired only while a
    command is being sent and released immediately afterwards, so other
    Bluetooth integrations are never blocked.

    The cached ``BLEDevice`` is kept fresh via a Bluetooth callback registered
    in ``async_setup_entry``; call :meth:`set_ble_device` from that callback
    so the client always holds a current advertisement reference.

    Concurrent calls are serialised through an asyncio lock so that only
    one BLE session is active at a time.
    """

    def __init__(self, address: str) -> None:
        """Initialise the client with the device MAC / UUID address."""
        self._address = address
        self._ble_device: BLEDevice | None = None
        self._lock = asyncio.Lock()

    def set_ble_device(self, ble_device: BLEDevice) -> None:
        """Update the cached BLE device reference (call on every advertisement)."""
        self._ble_device = ble_device

    async def send_command(self, command: str) -> bool:
        """Connect to the device, write *command*, then disconnect.

        Returns ``True`` on success, ``False`` on any error.
        """
        if command not in COMMANDS:
            _LOGGER.error("Unknown command: %s", command)
            return False

        async with self._lock:
            if self._ble_device is None:
                _LOGGER.error(
                    "Device %s: no BLE device reference available", self._address
                )
                return False

            try:
                async with BleakClient(self._ble_device) as client:
                    data = bytes.fromhex(COMMANDS[command])
                    await client.write_gatt_char(
                        CHARACTERISTIC_UUID, data, response=False
                    )
                    _LOGGER.debug("Command '%s' sent to %s", command, self._address)
                    return True
            except BleakError as err:
                _LOGGER.error(
                    "BLE error sending command '%s' to %s: %s",
                    command,
                    self._address,
                    err,
                )
                return False

