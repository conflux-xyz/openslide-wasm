/// <reference types="emscripten" />
import { WorkerCommand, WorkerResponseBase, OpenSlideT, FileEntry } from "./types";
import createModule_ from "./lib.js";

const createModule: EmscriptenModuleFactory<OpenSlideEmscriptenModule> = createModule_;

const _TMP_PREFIX = "/tmp-";

type Pointer = number;

declare function cwrap<I extends Array<Emscripten.JSType | null> | [], R extends Emscripten.JSType | null>(
    ident: string,
    returnType: R,
    argTypes: I,
    opts: {async: true},
): (...arg: ArgsToType<I>) => Promise<ReturnToType<R>>;

interface OpenSlideEmscriptenModule extends EmscriptenModule {
  FS: typeof FS;
  cwrap: typeof cwrap;
  WORKERFS: Emscripten.FileSystemType;
  MEMFS: Emscripten.FileSystemType;
  UTF8ToString: typeof UTF8ToString;
}


function randomString(length: number = 10) {
  let randomName = "";
  for (let i = 0; i < length; i++) {
    randomName += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
  }
  return randomName;
}


interface QueueJob {
  id: string;
  fn: () => Promise<void>;
}
class Queue {
  private _queue: QueueJob[] = [];
  private _runningCount = 0;

  constructor(private _concurrency = 1) {}

  async run() {
    // Start as many tasks as we can, up to concurrency limit
    while (this._runningCount < this._concurrency && this._queue.length > 0) {
      const job = this._queue.shift();
      if (job) {
        this._runningCount++;
        // Execute the task and decrement counter when done
        // Use finally to ensure counter decrements even if task fails
        job.fn().finally(() => {
          this._runningCount--;
          // Try to run more tasks when this one completes
          this.run();
        });
      }
    }
  }

  add(job: QueueJob) {
    this._queue.push(job);
    this.run();
  }

  abort(id: string) {
    this._queue = this._queue.filter(job => job.id !== id);
  }
}

const _READ_REGION_CONCURRENCY = 4;
const _READ_REGION_QUEUE = new Queue(_READ_REGION_CONCURRENCY);

class OpenSlideApi {
  private _getPropertyNamesAsync: (osr: OpenSlideT) => Promise<Pointer>;
  private _getPropertyValueAsync: (osr: OpenSlideT, name: string) => Promise<Pointer>;
  private _getLevelCountAsync: (osr: OpenSlideT) => Promise<number>;
  private _getLevelDimensionsAsync: (osr: OpenSlideT, level: number) => Promise<number>;
  private _getLevelDownsampleAsync: (osr: OpenSlideT, level: number) => Promise<number>;
  private _getBestLevelForDownsampleAsync: (osr: OpenSlideT, downsample: number) => Promise<number>;
  private _readRegionAsync: (osr: OpenSlideT, args: number) => Promise<number>;
  private _getIccProfileSizeAsync: (osr: OpenSlideT) => Promise<bigint>;
  private _readIccProfileAsync: (osr: OpenSlideT, ptr: Pointer) => Promise<null>;
  private _openSlideAsync: (filepath: string) => Promise<OpenSlideT>;
  private _closeSlideAsync: (osr: OpenSlideT) => Promise<null>;
  private _osrMountMap: Map<OpenSlideT, string>;

  constructor(private lib: OpenSlideEmscriptenModule) {
    this._getPropertyNamesAsync = lib.cwrap("get_property_names", "number", ["number"], {async: true});
    this._getPropertyValueAsync = lib.cwrap("get_property_value", "number", ["number", "string"], {async: true});
    this._getLevelCountAsync = lib.cwrap("get_level_count", "number", ["number"], {async: true});
    this._getLevelDimensionsAsync = lib.cwrap("get_level_dimensions", "number", ["number", "number"], {async: true});
    this._getLevelDownsampleAsync = lib.cwrap("get_level_downsample", "number", ["number", "number"], {async: true});
    this._getBestLevelForDownsampleAsync = lib.cwrap("get_best_level_for_downsample", "number", ["number", "number"], {async: true});
    this._readRegionAsync = lib.cwrap("read_region", "number", ["number", "number"], {async: true});
    // @ts-expect-error ts(2322) - return value is actually bigint, but `cwrap` types don't support return value.
    this._getIccProfileSizeAsync = lib.cwrap("get_icc_profile_size", "number", ["number"], {async: true});
    this._readIccProfileAsync = lib.cwrap("read_icc_profile", null, ["number", "number"], {async: true});
    // TODO: consider changing the names "load_image" and "close_image"
    this._openSlideAsync = lib.cwrap("load_image", "number", ["string"], {async: true});
    this._closeSlideAsync = lib.cwrap("close_image", null, ["number"], {async: true});
    this._osrMountMap = new Map();
  }

  async getPropertyNames(osr: OpenSlideT): Promise<string[]> {
    const stringArr = await this._getPropertyNamesAsync(osr);
    const memory = this.lib.HEAPU8;
    const result: Array<string> = [];
    const charView = new Uint32Array(memory.buffer);
    for (let i = 0; ; i++) {
      const stringPtr = charView[(stringArr >> 2) + i];
      if (stringPtr === 0) break;
      let str = "";
      for (let j = stringPtr; memory[j] !== 0; j++) {
        str += String.fromCharCode(memory[j]);
      }
      result.push(str);
    }
    return result;
  }

  async getPropertyValue(osr: OpenSlideT, name: string) {
    const cString = await this._getPropertyValueAsync(osr, name);
    return this.lib.UTF8ToString(cString);
  }

  async getLevelCount(osr: OpenSlideT) {
    const count = await this._getLevelCountAsync(osr);
    return count;
  }

  async getLevelDimensions(osr: OpenSlideT, level: number): Promise<[number, number]> {
    const result = await this._getLevelDimensionsAsync(osr, level);
    const int64View = new BigInt64Array(this.lib.HEAP8.buffer, result, 2);
    const w = int64View[0];
    const h = int64View[1];
    this.lib._free(result);
    return [Number(w), Number(h)];
  }

  async getLevelDownsample(osr: OpenSlideT, level: number) {
    const downsample = await this._getLevelDownsampleAsync(osr, level);
    return downsample;
  }

  async getBestLevelForDownsample(osr: OpenSlideT, downsample: number) {
    const level = await this._getBestLevelForDownsampleAsync(osr, downsample);
    return level;
  }

  async readRegion(osr: OpenSlideT, x: number, y: number, level: number, width: number, height: number) {
    // We malloc memory to pack all values into a single chunk of memory
    const args = this.lib._malloc(40);
    this.lib.HEAP64[args / 8] = BigInt(x); // int64_t x (8 bytes)
    this.lib.HEAP64[args / 8 + 1] = BigInt(y); // int64_t y (8 bytes)
    this.lib.HEAP32[args / 4 + 4] = level; // int32_t level (4 bytes)
    this.lib.HEAP32[args / 4 + 5] = 0; // Padding (4 bytes, required for alignment)
    this.lib.HEAP64[args / 8 + 3] = BigInt(width); // int64_t w (8 bytes)
    this.lib.HEAP64[args / 8 + 4] = BigInt(height); // int64_t h (8 bytes)
    this.lib.HEAP32[args / 4 + 10] = 1; // int32_t read_rgba always 1 (4 bytes)

    const data = await this._readRegionAsync(osr, args);
    this.lib._free(args);

    const sz = width * height * 4;

    const imageArrayView = new Uint8ClampedArray(
      this.lib.HEAPU8.buffer,
      data,
      sz,
    );
    // Copy the data from WASM memory, otherwise we
    // will get a view of the memory that will be freed
    // and might change!
    const imageArray = imageArrayView.slice();
    this.lib._free(data);

    return imageArray;
  }

  async readIccProfile(osr: OpenSlideT): Promise<Uint8Array | null> {
    const bigSize = await this._getIccProfileSizeAsync(osr);
    if (bigSize > BigInt(Number.MAX_SAFE_INTEGER) || bigSize < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error("ICC profile size exceeds safe bounds for conversion to Number.");
    }
    const size = Number(bigSize);
    if (size === 0) {
      return null;
    }
    const profilePointer = this.lib._malloc(size);
    await this._readIccProfileAsync(osr, profilePointer);

    const profileArray = new Uint8Array(
      this.lib.HEAPU8.buffer,
      profilePointer,
      size
    );
    // Copy the data to avoid issues when memory is freed
    const profile = profileArray.slice();
    this.lib._free(profilePointer);
    return profile;
  }

  async open(file: File | File[] | FileEntry[] | string) {
    const fileOrUrl = (Array.isArray(file) || file instanceof File) ? file : new URL(file);
    const {filename, mountDir} = await this._openFile(fileOrUrl);
    const filepath = mountDir ? `${mountDir}/${filename}` : filename;
    const osr = await this._openSlideAsync(filepath);
    if (osr === 0) {
      // Eventually we should hook into `openslide_get_error` to get any relevant
      // error message. This would apply to all calls to the openslide C code.
      throw new Error("Failed to open slide");
    }
    if (mountDir) {
      this._osrMountMap.set(osr, mountDir);
    }
    return osr;
  }

  async _openFile(file: File | File[] | FileEntry[] | URL) {
    if (file instanceof URL) {
      return {
        filename: "remote",
        mountDir: this._mountUrl(file),
      };
    } else {
      const files = fileEntriesFromFilesOrFileEntries(file);
      return {
        filename: files[0].path,
        mountDir: this._mountFiles(files),
      };
    }
  }

  _mountFiles(files: FileEntry[]) {
    const dirname = `${_TMP_PREFIX}${randomString()}`;
    this.lib.FS.mkdir(dirname);
    const mountNode = this.lib.FS.mount(this.lib.WORKERFS, {}, dirname) as FS.FSNode;

    const nodes = new Map<string, FS.FSNode>();
    nodes.set(dirname, mountNode);
    const ensureParent = (path: string): FS.FSNode => {
      const parts = path.split("/");
      let currentNode: FS.FSNode = mountNode;
      for (let i = 0; i < parts.length - 1; i++) {
        const partDirname = parts.slice(0, i + 1).join("/");
        const part = parts[i];
        if (!nodes.has(partDirname)) {
          // Create the directory if it doesn't exist
          // @ts-expect-error ts(2339)
          const newNode = this.lib.WORKERFS.createNode(currentNode, part, this.lib.WORKERFS.DIR_MODE, 0) as FS.FSNode;
          nodes.set(partDirname, newNode);
        }
        currentNode = nodes.get(partDirname)!;
      }
      return currentNode;
    }
    files.forEach((fileEntry) => {
      const {file, path} = fileEntry;
      const parentDir = ensureParent(path);
      const fileName = path.split("/").pop()!;
      const lastModifiedDate = file.lastModified ? new Date(file.lastModified) : undefined;
      // @ts-expect-error ts(2339)
      this.lib.WORKERFS.createNode(parentDir, fileName, this.lib.WORKERFS.FILE_MODE, 0, file, lastModifiedDate);
    });
    return dirname;
  }

  _mountUrl(url: URL) {
    const dirname = `${_TMP_PREFIX}${randomString()}`;
    this.lib.FS.mkdir(dirname);
    this.lib.FS.mount(this.lib.MEMFS, {}, dirname)
    const f = this.lib.FS.createLazyFile(dirname, "remote", url.toString(), true, false);
    return dirname;
  };

  async close(osr: OpenSlideT) {
    const mountDir = this._osrMountMap.get(osr);
    await this._closeSlideAsync(osr);
    if (mountDir) {
      this.lib.FS.unmount(mountDir);
      this.lib.FS.rmdir(mountDir);
      this._osrMountMap.delete(osr);
    }
  }
}

let api: OpenSlideApi | undefined = undefined;


function doPostMessage(id: string, message: WorkerResponseBase) {
  self.postMessage({id, ...message});
}

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const {data} = e;
  const {id} = data;
  if (data.type === "init") {
    if (api) {
      doPostMessage(id, {type: "error",payload: {message: "OpenSlide API already initialized"}});
      return;
    }
    const lib = await createModule();
    api = new OpenSlideApi(lib);
    doPostMessage(id, {type: "ready"});
    return;
  };

  if (!api) {
    doPostMessage(id, {type: "error", payload: {message: "OpenSlide API not initialized"}});
    return;
  }

  try {
    await handleMessage(api, data);
  } catch (error) {
    console.error("Error handling message:", error);
    doPostMessage(id, {type: "error", payload: {message: (error as Error).message}});
  }
}

async function handleMessage(
  api: OpenSlideApi,
  data: WorkerCommand,
) {
  const {id} = data;
  const {type: dataType} = data;
  switch (dataType) {
    case "init": {
      break;
    }
    case "open": {
      const {file} = data.payload;
      const osr = await api.open(file);
      doPostMessage(id, {type: "open", payload: {osr}});
      break;
    }
    case "close": {
      const {osr} = data.payload;
      await api.close(osr);
      doPostMessage(id, {type: "close", payload: {osr}});
      break;
    }
    case "getPropertyNames": {
      const {osr} = data.payload;
      const names = await api.getPropertyNames(osr);
      doPostMessage(id, {type: "getPropertyNames", payload: {names}});
      break;
    }
    case "getPropertyValue": {
      const {osr, name} = data.payload;
      const value = await api.getPropertyValue(osr, name);
      doPostMessage(id, {type: "getPropertyValue", payload: {value}});
      break;
    }
    case "getLevelCount": {
      const {osr} = data.payload;
      const count = await api.getLevelCount(osr);
      doPostMessage(id, {type: "getLevelCount", payload: {count}});
      break;
    }
    case "getLevelDimensions": {
      const {osr, level} = data.payload;
      const dimensions = await api.getLevelDimensions(osr, level);
      doPostMessage(id, {type: "getLevelDimensions", payload: {dimensions}});
      break;
    }
    case "getLevelDownsample": {
      const {osr, level} = data.payload;
      const downsample = await api.getLevelDownsample(osr, level);
      doPostMessage(id, {type: "getLevelDownsample", payload: {downsample}});
      break;
    }
    case "getBestLevelForDownsample": {
      const {osr, downsample} = data.payload;
      const level = await api.getBestLevelForDownsample(osr, downsample);
      doPostMessage(id, {type: "getBestLevelForDownsample", payload: {level}});
      break;
    }
    case "readRegion": {
      const {osr, x, y, level, width, height} = data.payload;
      _READ_REGION_QUEUE.add({
        id,
        fn: async () => {
          // If we don't add some minor wait here, we don't give the worker
          // a chance to process other messages. This is especially important
          // for the abort messages, which might include an abort of this readRegion
          // call.
          // Even though `api.readRegion` is async, it doesn't seem to yield
          // the event loop.
          await timeout(0);
          const regionData = await api.readRegion(osr, x, y, level, width, height);
          doPostMessage(id, {type: "readRegion", payload: {data: regionData}});
        },
      });
      break;
    }
    case "readIccProfile": {
      const {osr} = data.payload;
      const iccProfile = await api.readIccProfile(osr);
      doPostMessage(id, {type: "readIccProfile", payload: {iccProfile}});
      break;
    }
    case "abort": {
      _READ_REGION_QUEUE.abort(id);
      break;
    }
    default:
      exhaustiveCheck(dataType);
  }
}

function timeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exhaustiveCheck(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}


function fileEntriesFromFilesOrFileEntries(file: File | File[] | FileEntry[]): FileEntry[] {
  if (file instanceof File) {
    return [{file, path: file.name}];
  } else if (Array.isArray(file)) {
    return file.map((f) => {
      if (f instanceof File) {
        return {file: f, path: f.name};
      } else {
        return f;
      }
    });
  } else {
    throw new Error("Invalid input type, expected File, File[], or FileEntry[]");
  }
}