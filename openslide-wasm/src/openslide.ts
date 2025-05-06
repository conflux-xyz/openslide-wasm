import { WorkerCommandBase, WorkerResponse, OpenSlideT } from "./types";

type PromiseFns = {
  resolve: (value: WorkerResponse) => void;
  reject: (reason: Error) => void;
}

function randomString(length: number = 10) {
  let randomName = "";
  for (let i = 0; i < length; i++) {
    randomName += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
  }
  return randomName;
}

class OpenSlideWorker {
  _worker: Worker;
  _promiseFns: Map<string, PromiseFns>;

  constructor() {
    this._worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    this._worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { data } = event;
      const id = data.id;
      const promiseFns = this._promiseFns.get(id);
      if (!promiseFns) {
        return;
      }
      const { resolve, reject } = promiseFns;
      if (data.type === "error") {
        reject(new Error(data.payload.message));
      } else {
        resolve(data);
      }
    };
    this._promiseFns = new Map();
  }

  sendCommand(command: WorkerCommandBase): Promise<WorkerResponse> {
    const id = randomString(16);
    return new Promise<WorkerResponse>((resolve, reject) => {
      this._worker.postMessage({ ...command, id });
      this._promiseFns.set(id, { resolve, reject });
    });
  }

}

export default class OpenSlide {
  private worker: OpenSlideWorker;

  constructor() {
    this.worker = new OpenSlideWorker();
  }

  async initialize() {
    const p = await this.worker.sendCommand({ type: "init" });
    if (p.type === "error") {
      throw new Error(p.payload.message);
    }
    return;
  }

  async open(file: File | string, downloadToLocal: boolean = false): Promise<OpenSlideImage> {
    const response = await this.worker.sendCommand({ type: "open", payload: { file, downloadToLocal } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "open") {
      throw new Error("Unexpected response type");
    }
    return new OpenSlideImage(response.payload.osr, this.worker);
  }
}

class OpenSlideImage {
  constructor(private osr: OpenSlideT, private worker: OpenSlideWorker) {
  }

  /**
   * Close the OpenSlide image.
   * @returns A promise that resolves when the image is closed.
   */
  async close() {
    const response = await this.worker.sendCommand({ type: "close", payload: { osr: this.osr } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "close") {
      throw new Error("Unexpected response type");
    }
  }

  /**
   * Get the names of all properties in the image.
   * @returns An array of property names.
   */
  async getPropertyNames(): Promise<string[]> {
    const response = await this.worker.sendCommand({ type: "getPropertyNames", payload: { osr: this.osr } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "getPropertyNames") {
      throw new Error("Unexpected response type");
    }
    return response.payload.names;
  }

  /**
   * Get the value of a property by name.
   * @param name - The name of the property.
   * @returns The value of the property, or null if not found.
   */
  async getPropertyValue(name: string): Promise<string | null> {
    const response = await this.worker.sendCommand({ type: "getPropertyValue", payload: { osr: this.osr, name } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "getPropertyValue") {
      throw new Error("Unexpected response type");
    }
    return response.payload.value;
  }

  /**
   * Get the number of levels in the image.
   * @returns The number of levels in the image.
   */
  async getLevelCount(): Promise<number> {
    const response = await this.worker.sendCommand({ type: "getLevelCount", payload: { osr: this.osr } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "getLevelCount") {
      throw new Error("Unexpected response type");
    }
    return response.payload.count;
  }

  /**
   * Get the dimensions of a given level.
   * @param level - The level of the image.
   * @returns The dimensions of the specified level as a tuple [width, height].
   */
  async getLevelDimensions(level: number): Promise<[number, number]> {
    const response = await this.worker.sendCommand({ type: "getLevelDimensions", payload: { osr: this.osr, level } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "getLevelDimensions") {
      throw new Error("Unexpected response type");
    }
    return response.payload.dimensions;
  }

  /**
   * Get the downsample factor for a given level.
   * @param level - The level of the image.
   * @returns The downsample factor for the specified level.
   */
  async getLevelDownsample(level: number): Promise<number> {
    const response = await this.worker.sendCommand({ type: "getLevelDownsample", payload: { osr: this.osr, level } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "getLevelDownsample") {
      throw new Error("Unexpected response type");
    }
    return response.payload.downsample;
  }

  /**
   * Get the best level for a given downsample factor.
   * @param downsample - The desired downsample factor.
   * @returns The best level for the specified downsample factor.
   */
  async getBestLevelForDownsample(downsample: number): Promise<number> {
    const response = await this.worker.sendCommand({ type: "getBestLevelForDownsample", payload: { osr: this.osr, downsample } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "getBestLevelForDownsample") {
      throw new Error("Unexpected response type");
    }
    return response.payload.level;
  }

  /**
   * Read a region of the image at the specified level and dimensions.
   * @param x - The x coordinate of the top-left corner of the region.
   * @param y - The y coordinate of the top-left corner of the region.
   * @param level - The level of the image to read from.
   * @param width - The width of the region to read.
   * @param height - The height of the region to read.
   * @param readRgba - Whether to read the region as RGBA (default: false).
   * @returns A promise that resolves to a Uint8ClampedArray containing the pixel data.
   */
  async readRegion(x: number, y: number, level: number, width: number, height: number, readRgba: boolean = false): Promise<Uint8ClampedArray> {
    const response = await this.worker.sendCommand({ type: "readRegion", payload: { osr: this.osr, x, y, level, width, height, readRgba } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "readRegion") {
      throw new Error("Unexpected response type");
    }
    return response.payload.data;
  }
}