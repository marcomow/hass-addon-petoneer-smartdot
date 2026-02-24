/**
 * Bluetooth controller for the Petoneer Smart Dot ("PetCat") device.
 *
 * Uses a **scan-on-demand** model: the BLE adapter is only acquired when a
 * command needs to be sent and is released immediately afterwards.  This
 * prevents Noble from holding the raw HCI socket permanently, which would
 * block every other Bluetooth integration (BlueZ / HA built-in BT) from
 * accessing the adapter.
 *
 * Flow for each command:
 *   1. Start scanning (Noble acquires HCI socket)
 *   2. Discover "PetCat" peripheral → stop scanning
 *   3. Connect → discover service & characteristic → write command
 *   4. Disconnect → stop Noble (HCI socket released)
 */

// deno-lint-ignore-file no-explicit-any
import noble from "npm:@abandonware/noble";

const SERVICE_UUID = "fff0";
const CHARACTERISTIC_UUID = "fff3";

const SCAN_TIMEOUT_MS = 15_000; // give up if device not found within 15 s

export const COMMANDS = {
  stop: "0f0407000008",
  preset_small: "0f0405000107",
  preset_medium: "0f0405000208",
  preset_large: "0f0405000309",
} as const;

export type Command = keyof typeof COMMANDS;

export class BluetoothController {
  /** Serialises concurrent sendCommand calls so only one BLE session runs at a time. */
  private queue: Promise<boolean> = Promise.resolve(false);

  /**
   * Send a BLE command to the device.
   *
   * Calls are automatically serialised: if a second command arrives while the
   * first is still in progress it will wait for the first to finish before
   * acquiring the adapter.
   */
  sendCommand(command: Command): Promise<boolean> {
    // Chain onto the existing queue so calls never overlap.
    this.queue = this.queue.then(() => this._executeCommand(command));
    return this.queue;
  }

  private async _executeCommand(command: Command): Promise<boolean> {
    const hexCommand = COMMANDS[command];
    if (!hexCommand) {
      console.error(`[BLE] Unknown command: ${command}`);
      return false;
    }

    let peripheral: any = null;

    try {
      peripheral = await this._scanForDevice();
    } catch (err) {
      console.error("[BLE] Scan failed:", err);
      this._stopNoble();
      return false;
    }

    // Scanning is already stopped inside _scanForDevice before we return.

    try {
      console.log(`[BLE] Connecting to PetCat (id=${peripheral.id})…`);
      await peripheral.connectAsync();

      const services = await peripheral.discoverServicesAsync([SERVICE_UUID]);
      const characteristics = await services[0].discoverCharacteristicsAsync([
        CHARACTERISTIC_UUID,
      ]);

      const buffer = Buffer.from(hexCommand, "hex");
      await characteristics[0].writeAsync(buffer, false);

      console.log(`[BLE] Command '${command}' sent successfully`);
      return true;
    } catch (error) {
      console.error(`[BLE] Error sending command '${command}':`, error);
      return false;
    } finally {
      // Always disconnect and release the adapter, even on error.
      try {
        await peripheral.disconnectAsync();
      } catch (_) {
        // ignore secondary disconnect errors
      }
      this._stopNoble();
    }
  }

  /**
   * Starts a BLE scan and resolves with the first "PetCat" peripheral found.
   * Stops scanning before resolving so the adapter is not held while we connect.
   * Rejects if the device is not found within SCAN_TIMEOUT_MS.
   */
  private _scanForDevice(): Promise<any> {
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;

      const onDiscover = (peripheral: any) => {
        if (peripheral.advertisement?.localName !== "PetCat") return;

        console.log(`[BLE] Found PetCat (id=${peripheral.id})`);
        clearTimeout(timeoutId);

        // Remove listeners and stop scanning BEFORE connecting.
        noble.removeListener("discover", onDiscover);
        noble.stopScanning();

        resolve(peripheral);
      };

      const onStateChange = async (state: string) => {
        if (state !== "poweredOn") return;
        noble.removeListener("stateChange", onStateChange);
        console.log("[BLE] Adapter powered on, scanning for PetCat…");
        await noble.startScanningAsync([SERVICE_UUID], false);
      };

      timeoutId = setTimeout(() => {
        noble.removeListener("discover", onDiscover);
        noble.removeListener("stateChange", onStateChange);
        noble.stopScanning();
        reject(new Error(`PetCat not found within ${SCAN_TIMEOUT_MS / 1000} s`));
      }, SCAN_TIMEOUT_MS);

      noble.on("discover", onDiscover);

      // If the adapter is already on, start scanning immediately;
      // otherwise wait for the stateChange event.
      if ((noble as any).state === "poweredOn") {
        noble.startScanningAsync([SERVICE_UUID], false).catch(reject);
      } else {
        noble.on("stateChange", onStateChange);
      }

      noble.on("warning", (msg: string) => console.warn("[BLE] Warning:", msg));
    });
  }

  /** Stops scanning and resets Noble to release the HCI socket. */
  private _stopNoble(): void {
    try {
      noble.stopScanning();
      // noble.reset() tears down the internal HCI socket binding and lets
      // other processes (BlueZ, other HA integrations) use the adapter again.
      noble.reset();
      console.log("[BLE] Adapter released");
    } catch (_) {
      // ignore – adapter may already be in a reset state
    }
  }
}
