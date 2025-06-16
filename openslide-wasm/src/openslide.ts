import { WorkerCommandBase, WorkerResponse, OpenSlideT, FileEntry } from "./types";

type PromiseFns = {
  resolve: (value: WorkerResponse) => void;
  reject: (reason: Error) => void;
  signal?: AbortSignal;
  abortHandler?: (event: Event) => void;
}

function randomString(length: number = 10) {
  let randomName = "";
  for (let i = 0; i < length; i++) {
    randomName += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
  }
  return randomName;
}


export interface ReadRegionOptions {
  signal?: AbortSignal;
}
interface CommandOptions {
  signal?: AbortSignal;
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
      const { signal, abortHandler } = promiseFn;
      if (signal && abortHandler) {
        signal.removeEventListener("abort", abortHandler);
      }
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

  sendCommand(command: WorkerCommandBase, opts?: CommandOptions): Promise<WorkerResponse> {
    const id = randomString(16);
    const signal = opts?.signal;
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.worker.postMessage({ ...command, id });
      const abortHandler = signal === undefined ? undefined : (event: Event) => {
        this.promiseFns.delete(id);
        this.worker.postMessage({ type: "abort", id });
        signal.removeEventListener("abort", abortHandler!);
        // TODO: Upgrade TypeScript to >5 and see if this fixes the issue here.
        const reason = (signal as any as { reason: string }).reason;
        reject(createAbortError(reason));
      };
      if (signal && abortHandler) {
        signal.addEventListener("abort", abortHandler);
      }
      this.promiseFns.set(id, { resolve, reject, signal, abortHandler });
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

  /**
   * Open a WSI with OpenSlide.
   * In the case of multi-file formats like DICOM, MIRAX, and Hamamatsu-VMS, use the `FileEntry[]` array
   * where each entry contains a `File` and its corresponding path.
   * The _first_ file in the array will be used to open the slide.
   * 
   * @param file A File, File array, FileEntry array, URL, or string representing the file path or URL to open.
   * @param downloadToLocal Whether to download the file to local storage (only applicable for URLs).
   * @returns A promise that resolves to an OpenSlideImage instance.
   */
  async open(file: File | File[] | FileEntry[] | URL | string, downloadToLocal: boolean = false): Promise<OpenSlideImage> {
    if (Array.isArray(file) && file.length === 0) {
      throw new Error("File array is empty");
    }
    if (isFileEntryArray(file)) {
      validateFileEntryArray(file);
    }
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

function isFileEntryArray(file: File | File[] | FileEntry[] | URL | string): file is FileEntry[] {
  return Array.isArray(file) && !file.some((f) => !isFileEntry(f));
}

function isFileEntry(file: File | FileEntry): file is FileEntry {
  return (file as FileEntry).file !== undefined && (file as FileEntry).path !== undefined;
}

function validateFileEntryArray(fileEntries: FileEntry[]) {
  for (const entry of fileEntries) {
    if (!isValidDescendantFilePath(entry.path)) {
      throw new Error(`Invalid file path: ${entry.path}`);
    }
  }
}

// Validate that the path is a relative path (not absolute),
// doesn't try to navigate to parent directories, and uses forward slashes
function isValidDescendantFilePath(path: string): boolean {
  if (path === "") {
    return false;
  }
  // Check if the path is absolute
  if (path.startsWith("/") || // Unix-like absolute path
      /^[A-Za-z]:[\\\/]/.test(path) || // Windows absolute path (e.g., C:\ or C:/)
      path.startsWith('\\\\')) { // Windows UNC path
    return false;
  }
  
  // Check for backslashes (disallow them)
  if (path.includes('\\')) {
    return false;
  }
  
  // Check for path traversal attempts using ..
  const parts = path.split('/');
  return !parts.includes('..') && !parts.includes('.');
}

function ensureFileOrUrl(file: File | File[] | FileEntry[] | URL | string): File | File[] | FileEntry[] | URL {
  if (Array.isArray(file) || file instanceof File || file instanceof URL) {
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
  const response = await fetch(url.toString());
  const blob = await response.blob();
  const file = new File([blob], filename, { type: blob.type });
  return file;
}

class AbortError extends Error {
  constructor(message = "Aborted") {
    super(message);
    this.name = "AbortError";
  }
}

function createAbortError(reason: string = "Aborted") {
  if (typeof DOMException === "function") {
    return new DOMException(reason, "AbortError");
  }

  // Custom fallback for environments without DOMException
  return new AbortError(reason);
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
  async readRegion(x: number, y: number, level: number, width: number, height: number, options?: ReadRegionOptions): Promise<Uint8ClampedArray> {
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "readRegion", payload: { osr, x, y, level, width, height } }, options);
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "readRegion") {
      throw new Error("Unexpected response type");
    }
    return response.payload.data;
  }

  /**
   * Read the ICC color profile embedded in the image.
   * @returns A promise that resolves to an ArrayBuffer containing the ICC profile data, or null if no profile is available.
   */
  async readIccProfile(): Promise<Uint8Array | null> {
    const { osr, worker } = this.getHandle();
    const response = await worker.sendCommand({ type: "readIccProfile", payload: { osr } });
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }
    if (response.type !== "readIccProfile") {
      throw new Error("Unexpected response type");
    }
    return response.payload.iccProfile;
  }

}

export type { OpenSlideImage };
export type { FileEntry };

/**
 * Convert an array of File objects to an array of FileEntry objects.
 * 
 * @param files An array of File objects.
 * @returns An array of FileEntry objects, each containing the file and its path.
 */
export function fileEntriesFromFiles(files: File[]): FileEntry[] {
  return files.map((file) => ({file, path: file.name}));
}


interface ApplyAlphaOptions {
  backgroundColor?: [number, number, number];
  inPlace?: boolean;
}
/**
 * Apply alpha compositing to the image data, following the
 * idiosyncrasies noted in the OpenSlide documentation.
 * By default the operation is performed in place.
 * Ref: https://openslide.org/docs/premultiplied-argb/
 * 
 * @param imageData The image data in RGBA format as a Uint8ClampedArray.
 * @param options Options for applying alpha compositing.
 * @param options.backgroundColor The background color to use for fully transparent pixels (default: [255, 255, 255]).
 * @param options.inPlace Whether to modify the imageData in place (default: true).
 */
export function applyAlpha(
  imageData: Uint8ClampedArray,
  options?: ApplyAlphaOptions,
) {
  const backgroundColor = options?.backgroundColor || [255, 255, 255];
  const inPlace = options?.inPlace ?? true;
  const returnImageData = inPlace ? imageData : new Uint8ClampedArray(imageData);

  for (let i = 0; i < returnImageData.length; i += 4) {
    const a = returnImageData[i + 3];
    if (a === 0) {
      // white (or could use openslide.background-color if available)
      returnImageData[i] = backgroundColor[0];
      returnImageData[i + 1] = backgroundColor[1];
      returnImageData[i + 2] = backgroundColor[2];
      returnImageData[i + 3] = 255; // Set alpha to 255
    } else if (a === 255) {
      // fully opaque, no need to premultiply => no-op
    } else {
      // Premultiply RGB values by alpha
      const alpha = a / 255; // Normalize alpha to [0, 1]
      returnImageData[i] = Math.round(returnImageData[i] * alpha);
      returnImageData[i + 1] = Math.round(returnImageData[i + 1] * alpha);
      returnImageData[i + 2] = Math.round(returnImageData[i + 2] * alpha);
      returnImageData[i + 3] = 255; // Set alpha to 255
    }
  }
  return returnImageData;
}