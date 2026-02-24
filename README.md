# Petoneer Smart Dot – Home Assistant Integration

A [HACS](https://hacs.xyz) custom integration that lets Home Assistant control
the [Petoneer Smart Dot](https://www.petoneer.com/playdot) laser cat toy
directly over Bluetooth – no MQTT broker, no bridge process, no extra
dependencies.

## Requirements

* Home Assistant 2024.1 or newer (Bluetooth integration built-in).
* A Bluetooth adapter accessible to the Home Assistant host.
* [HACS](https://hacs.xyz) installed.

---

## Installation

1. In HACS → **Integrations** → click the three-dot menu → **Custom repositories**.
2. Add `https://github.com/marcomow/hass-addon-petoneer-smartdot` with category **Integration**.
3. Search for **Petoneer Smart Dot** and install it.
4. Restart Home Assistant.

---

## Setup

Power on the Smart Dot so it advertises over Bluetooth.

**Auto-discovery (recommended):** Home Assistant will detect the device
automatically and show a notification to set it up. Click it and confirm.

**Manual setup:** Go to **Settings → Devices & Services → Add Integration**,
search for **Petoneer Smart Dot**, and select your device from the list.

---

## Entity

A single `select` entity is created under the **Petoneer Smart Dot** device:

| Entity | Options |
|---|---|
| `select.petoneer_smart_dot_preset` | `stop` · `preset_small` · `preset_medium` · `preset_large` |

Selecting an option sends a stop command first (to safely park the motor),
then the chosen preset.

---

## Lovelace

```yaml
type: entities
entities:
  - entity: select.petoneer_smart_dot_preset
```

---

## Credits

Bluetooth protocol reverse-engineered by [@urish](https://github.com/urish).
