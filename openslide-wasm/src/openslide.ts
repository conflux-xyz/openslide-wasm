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
  id: string;
  private worker: Worker;
  private promiseFns: Map<string, PromiseFns>;

  constructor() {
    this.id = randomString(16);
    this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { data } = event;
      const id = data.id;
      const promiseFn = this.promiseFns.get(id);
      if (!promiseFn) {
        return;
      }
      this.promiseFns.delete(id);
      const { resolve, reject } = promiseFn;
      if (data.type === "error") {
        reject(new Error(data.payload.message));
      } else {
        resolve(data);
      }
    };
    this.promiseFns = new Map();
  }

  numTasks(): number {
    return this.promiseFns.size;
  }

  sendCommand(command: WorkerCommandBase): Promise<WorkerResponse> {
    const id = randomString(16);
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.worker.postMessage({ ...command, id });
      this.promiseFns.set(id, { resolve, reject });
    });
  }

}

export interface OpenSlideOptions {
  workers?: number;
}
export default class OpenSlide {
  private workers: OpenSlideWorker[];

  /**
   * Creates an instance of OpenSlide with a specified number of workers.
   * 
   * @param {OpenSlideOptions} options - Options for OpenSlide.
   * @param {number} options.workers - The number of workers to create (default: 1).
   * @returns {OpenSlide} An instance of OpenSlide.
   * @throws {Error} If the number of workers is less than 1.
   */
  constructor(options?: OpenSlideOptions) {
    const workers = options?.workers || 1;
    if (workers < 1) {
      throw new Error("Number of workers must be at least 1");
    }
    this.workers = [];
    for (let i = 0; i < workers; i++) {
      this.workers.push(new OpenSlideWorker());
    }
  }

  async initialize() {
    const results = await Promise.all(this.workers.map((w) => w.sendCommand({ type: "init" })));
    for (const p of results) {
      if (p.type === "error") {
        throw new Error(p.payload.message);
      }
    }
    return;
  }

  async open(file: File | URL | string, downloadToLocal: boolean = false): Promise<OpenSlideImage> {
    const fileOrUrl = ensureFileOrUrl(file);
    if (fileOrUrl instanceof URL && downloadToLocal) {
      const file = await fetchFileFromUrl(fileOrUrl);
      return await this.open(file, false);
    }
    const fileOrString = fileOrUrl instanceof URL ? fileOrUrl.toString() : fileOrUrl;
    const responses = await Promise.all(this.workers.map((w) => w.sendCommand({ type: "open", payload: { file: fileOrString } })));
    const handles = responses.map((response, idx) => {
      if (response.type === "error") {
        throw new Error(response.payload.message);
      }
      if (response.type !== "open") {
        throw new Error("Unexpected response type");
      }
      return {
        osr: response.payload.osr,
        worker: this.workers[idx],
      };
    });
    return new OpenSlideImage(handles);
  }
}

function ensureFileOrUrl(file: File | URL | string): File | URL {
  if (file instanceof File || file instanceof URL) {
    return file;
  }
  if (file.startsWith("http://") || file.startsWith("https://")) {
    try {
      return new URL(file);
    } catch (e) {
      throw new Error("Invalid URL");
    }
  }
  // If the file does not start with http:// or https://, assume it is a relative URL
  // and try to create a URL object from it.
  // This will throw an error if the URL is invalid.
  try {
    return new URL(file, window.location.href);
  } catch (e) {
    throw new Error("Invalid URL");
  }
}


async function fetchFileFromUrl(url: URL) {
  const filename = url.pathname.split("/").pop() || "filename";
  console.log("Fetching file from URL:", url.toString());
  const response = await fetch(url.toString());
  console.log("Response status:", response.status);
  const blob = await response.blob();
  console.log("Blob size:", blob.size);
  const file = new File([blob], filename, { type: blob.type });
  return file;
}


interface OpenSlideHandle {
  osr: OpenSlideT;
  worker: OpenSlideWorker;
}

class OpenSlideImage {
  constructor(private handles: OpenSlideHandle[]) {
  }

  /**
   * Close the OpenSlide image.
   * @returns A promise that resolves when the image is closed.
   */
  async close() {
    const responses = await Promise.all(this.handles.map(({osr, worker}) => worker.sendCommand({ type: "close", payload: { osr } })));
    for (const response of responses) {
      if (response.type === "error") {
        throw new Error(response.payload.message);
      }
      if (response.type !== "close") {
        throw new Error("Unexpected response type");
      }
    }
  }


  private getHandle(): OpenSlideHandle {
    const sizes = this.handles.map((h) => h.worker.numTasks());
    const minSize = Math.min(...sizes);
    const minHandles = this.handles.filter((_, idx) => sizes[idx] === minSize);
    const possibleHandles = minHandles.length === 0 ? this.handles : minHandles;
    const index = Math.floor(Math.random() * possibleHandles.length);
    const handle = possibleHandles[index];
    return handle;
  }


  /**
   * Get the names of all properties in the image.
   * @returns An array of property names.
   */
  async getPropertyNames(): Promise<string[]> {
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "getPropertyNames", payload: { osr } });
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
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "getPropertyValue", payload: { osr, name } });
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
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "getLevelCount", payload: { osr } });
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
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "getLevelDimensions", payload: { osr, level } });
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
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "getLevelDownsample", payload: { osr, level } });
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
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "getBestLevelForDownsample", payload: { osr, downsample } });
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
   * @returns A promise that resolves to a Uint8ClampedArray containing the pixel data in RGBA format.
   */
  async readRegion(x: number, y: number, level: number, width: number, height: number): Promise<Uint8ClampedArray> {
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "readRegion", payload: { osr, x, y, level, width, height } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "readRegion") {
      throw new Error("Unexpected response type");
    }
    return response.payload.data;
  }
}

export type { OpenSlideImage };