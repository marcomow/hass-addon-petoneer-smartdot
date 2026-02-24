"""Constants for the Petoneer Smart Dot integration."""

DOMAIN = "petoneer_smartdot"

# BLE device advertisement name
DEVICE_NAME = "PetCat"

# BLE GATT service and characteristic UUIDs
SERVICE_UUID = "fff0"
CHARACTERISTIC_UUID = "fff3"

# Raw hex payloads for each preset command
COMMANDS: dict[str, str] = {
    "stop": "0f0407000008",
    "preset_small": "0f0405000107",
    "preset_medium": "0f0405000208",
    "preset_large": "0f0405000309",
}

PRESETS = list(COMMANDS.keys())
