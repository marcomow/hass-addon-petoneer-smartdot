/**
 * Bluetooth controller for the Petoneer Smart Dot ("PetCat") device.
 *
 * Uses Noble via Deno's npm compatibility layer to communicate over BLE.
 * The device exposes a single writable characteristic (fff3) on service fff0.
 * Each preset is a 6-byte hex payload sent to that characteristic.
 */

// deno-lint-ignore-file no-explicit-any
import noble from "npm:@abandonware/noble";

const SERVICE_UUID = "fff0";
const CHARACTERISTIC_UUID = "fff3";

export const COMMANDS = {
  stop: "0f0407000008",
  preset_small: "0f0405000107",
  preset_medium: "0f0405000208",
  preset_large: "0f0405000309",
} as const;

export type Command = keyof typeof COMMANDS;

export class BluetoothController {
  private peripheral: any = null;
  private scanning = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    noble.on("stateChange", async (state: string) => {
      console.log(`[BLE] Adapter state: ${state}`);
      if (state === "poweredOn") {
        this.scanning = true;
        await noble.startScanningAsync([SERVICE_UUID], false);
        console.log("[BLE] Scanning for PetCat device…");
      } else {
        this.scanning = false;
        noble.stopScanning();
      }
    });

    // Restart scan automatically when it stops (e.g. after a connection).
    noble.on("scanStop", async () => {
      if (this.scanning) {
        await noble.startScanningAsync([SERVICE_UUID], false);
      }
    });

    noble.on("warning", (msg: string) => console.warn("[BLE] Warning:", msg));

    noble.on("discover", (peripheral: any) => {
      if (peripheral.advertisement?.localName === "PetCat") {
        console.log(`[BLE] Found PetCat (id=${peripheral.id})`);
        this.peripheral = peripheral;
      }
    });
  }

  async sendCommand(command: Command): Promise<boolean> {
    const hexCommand = COMMANDS[command];
    if (!hexCommand) {
      console.error(`[BLE] Unknown command: ${command}`);
      return false;
    }

    if (!this.peripheral) {
      console.error("[BLE] PetCat not discovered yet – is it powered on and in range?");
      return false;
    }

    try {
      noble.reset();

      const services = await this.peripheral.discoverServicesAsync([SERVICE_UUID]);
      const movementService = services[0];
      const characteristics = await movementService.discoverCharacteristicsAsync(
        [CHARACTERISTIC_UUID],
      );
      const movementCharacteristic = characteristics[0];

      // Buffer.from is available in Deno via the Node.js compat layer.
      const buffer = Buffer.from(hexCommand, "hex");
      await movementCharacteristic.writeAsync(buffer, false);
      await this.peripheral.disconnectAsync();

      console.log(`[BLE] Command '${command}' sent successfully`);
      return true;
    } catch (error) {
      console.error(`[BLE] Error sending command '${command}':`, error);
      try {
        await this.peripheral?.disconnectAsync();
      } catch (_) {
        // ignore secondary disconnect errors
      }
      return false;
    }
  }
}
