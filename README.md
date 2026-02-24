# Petoneer Smart Dot – Home Assistant Integration

A [HACS](https://hacs.xyz) custom integration that lets Home Assistant control
the [Petoneer Smart Dot](https://www.petoneer.com/playdot) laser-toy cat toy
over Bluetooth.

## Architecture

```
Home Assistant (Python)          Deno bridge (runs on any host with BT)
┌─────────────────────────┐      ┌──────────────────────────────────────┐
│  select.petoneer_smartdot│      │  deno/main.ts                        │
│  (stop / preset_small /  │      │  • Subscribes to MQTT command topic  │
│   preset_medium /        │◄────►│  • Scans for "PetCat" BLE device     │
│   preset_large)          │ MQTT │  • Writes BLE characteristic (fff3)  │
│                          │      │  • Publishes state back to MQTT      │
└─────────────────────────┘      └──────────────────────────────────────┘
```

**Two pieces to install:**

| Piece | What it does |
|---|---|
| **HACS integration** (`custom_components/`) | Creates a `select` entity in HA that publishes commands to MQTT |
| **Deno bridge** (`deno/`) | Receives MQTT commands, talks to the BLE device |

The Deno bridge must run on a machine that has Bluetooth access (e.g. the same
box as Home Assistant, a Raspberry Pi on the LAN, etc.).

---

## Part 1 – Install the HACS integration

### Prerequisites

* Home Assistant with [HACS](https://hacs.xyz) installed.
* The [MQTT integration](https://www.home-assistant.io/integrations/mqtt/)
  already configured in Home Assistant (Settings → Devices & Services → Add
  Integration → MQTT).

### Installation via HACS

1. In HACS → **Integrations** → click the three-dot menu → **Custom
   repositories**.
2. Add `https://github.com/marcomow/hass-addon-petoneer-smartdot` with
   category **Integration**.
3. Search for **Petoneer Smart Dot** and install it.
4. Restart Home Assistant.

### Setup

1. Go to **Settings → Devices & Services → Add Integration**.
2. Search for **Petoneer Smart Dot**.
3. Fill in the MQTT topics (leave defaults unless you customised the bridge):

| Field | Default |
|---|---|
| Command Topic | `petoneer_smartdot/command` |
| State Topic | `petoneer_smartdot/state` |

A new `select.petoneer_smartdot` entity will appear with four options:
`stop`, `preset_small`, `preset_medium`, `preset_large`.

---

## Part 2 – Run the Deno BLE bridge

The bridge is a Deno TypeScript program that lives in the `deno/` directory.
It bridges MQTT commands to the BLE device.

### Prerequisites

* [Deno](https://deno.com) ≥ 1.40 installed on the host machine.
* Bluetooth adapter accessible to the process.
* The host must be able to reach your MQTT broker over the network.

On Linux you may need to give Deno raw Bluetooth access:

```bash
sudo setcap 'cap_net_raw,cap_net_admin+eip' $(which deno)
```

### Configuration (environment variables)

| Variable | Default | Description |
|---|---|---|
| `MQTT_BROKER` | `mqtt://localhost:1883` | URL of your MQTT broker |
| `MQTT_USERNAME` | _(empty)_ | MQTT username (if required) |
| `MQTT_PASSWORD` | _(empty)_ | MQTT password (if required) |
| `COMMAND_TOPIC` | `petoneer_smartdot/command` | Topic to subscribe for commands |
| `STATE_TOPIC` | `petoneer_smartdot/state` | Topic to publish current state |

### Run

```bash
cd deno/
# Using the built-in task (reads deno.json)
deno task start

# Or inline with environment overrides
MQTT_BROKER=mqtt://192.168.1.10:1883 deno task start
```

### Run as a systemd service (optional)

Create `/etc/systemd/system/petoneer-bridge.service`:

```ini
[Unit]
Description=Petoneer Smart Dot MQTT-BLE bridge
After=network.target

[Service]
User=YOUR_USER
WorkingDirectory=/path/to/hass-addon-petoneer-smartdot/deno
Environment="MQTT_BROKER=mqtt://localhost:1883"
ExecStart=/usr/bin/deno task start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now petoneer-bridge
```

---

## Lovelace card

Add the entity to any dashboard card. An **Entities card** or a
**Select** card works well:

```yaml
type: entities
entities:
  - entity: select.petoneer_smartdot
```

---

## MQTT topics reference

| Topic | Direction | Payload |
|---|---|---|
| `petoneer_smartdot/command` | HA → bridge | `stop` / `preset_small` / `preset_medium` / `preset_large` |
| `petoneer_smartdot/state` | bridge → HA | same values, retained |

---

## Credits

Bluetooth reverse-engineering by [@urish](https://github.com/urish):

* [Reverse Engineering a Bluetooth Lightbulb](https://urish.medium.com/reverse-engineering-a-bluetooth-lightbulb-56580fcb7546)
* [Start Building with Web Bluetooth and Progressive Web Apps](https://urish.medium.com/start-building-with-web-bluetooth-and-progressive-web-apps-6534835959a6)

Dockerfile inspiration from [@balda](https://github.com/balda) –
[ruuvitag-discovery](https://github.com/balda/ruuvitag-discovery).
