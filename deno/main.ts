/**
 * Petoneer Smart Dot – MQTT ↔ BLE bridge (Deno)
 *
 * Connects to an MQTT broker and forwards commands to the PetCat BLE device.
 *
 * Environment variables (all optional, defaults shown):
 *   MQTT_BROKER        mqtt://localhost:1883
 *   MQTT_USERNAME      (empty)
 *   MQTT_PASSWORD      (empty)
 *   COMMAND_TOPIC      petoneer_smartdot/command
 *   STATE_TOPIC        petoneer_smartdot/state
 *
 * Run:
 *   deno task start
 * or directly:
 *   deno run --allow-net --allow-env --allow-read --allow-sys --allow-ffi main.ts
 */

// deno-lint-ignore-file no-explicit-any
import mqtt from "npm:mqtt";
import { BluetoothController, type Command, COMMANDS } from "./bluetooth_controller.ts";

const MQTT_BROKER = Deno.env.get("MQTT_BROKER") ?? "mqtt://localhost:1883";
const MQTT_USERNAME = Deno.env.get("MQTT_USERNAME") ?? "";
const MQTT_PASSWORD = Deno.env.get("MQTT_PASSWORD") ?? "";
const COMMAND_TOPIC = Deno.env.get("COMMAND_TOPIC") ?? "petoneer_smartdot/command";
const STATE_TOPIC = Deno.env.get("STATE_TOPIC") ?? "petoneer_smartdot/state";

console.log("Petoneer Smart Dot MQTT-BLE bridge starting…");
console.log(`  MQTT broker    : ${MQTT_BROKER}`);
console.log(`  Command topic  : ${COMMAND_TOPIC}`);
console.log(`  State topic    : ${STATE_TOPIC}`);

const controller = new BluetoothController();

const connectOptions: Record<string, unknown> = {};
if (MQTT_USERNAME) connectOptions.username = MQTT_USERNAME;
if (MQTT_PASSWORD) connectOptions.password = MQTT_PASSWORD;

const client = mqtt.connect(MQTT_BROKER, connectOptions);

client.on("connect", () => {
  console.log("[MQTT] Connected to broker");

  client.subscribe(COMMAND_TOPIC, (err: Error | null) => {
    if (err) {
      console.error("[MQTT] Failed to subscribe to command topic:", err.message);
    } else {
      console.log(`[MQTT] Subscribed to ${COMMAND_TOPIC}`);
    }
  });

  // Publish initial retained state so HA knows the current position.
  client.publish(STATE_TOPIC, "stop", { retain: true });
});

client.on("message", async (topic: string, message: Buffer) => {
  if (topic !== COMMAND_TOPIC) return;

  const command = message.toString().trim() as Command;

  if (!(command in COMMANDS)) {
    console.error(`[MQTT] Unknown command received: '${command}' – ignoring`);
    return;
  }

  console.log(`[MQTT] Command received: ${command}`);

  // Always send stop first (mirrors the original addon behaviour).
  const stopped = await controller.sendCommand("stop");

  if (command !== "stop" && stopped) {
    await controller.sendCommand(command);
  }

  // Reflect the new state back to Home Assistant.
  client.publish(STATE_TOPIC, command, { retain: true });
});

client.on("error", (err: Error) => {
  console.error("[MQTT] Error:", err.message);
});

client.on("offline", () => {
  console.warn("[MQTT] Client is offline – waiting to reconnect…");
});

client.on("reconnect", () => {
  console.log("[MQTT] Reconnecting to broker…");
});
