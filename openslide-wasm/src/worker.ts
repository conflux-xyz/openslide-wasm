/// <reference types="emscripten" />
import { WorkerCommand, WorkerResponseBase, OpenSlideT } from "./types";
// let createModule: EmscriptenModuleFactory<OpenSlideEmscriptenModule>;
import createModule from "./lib.js";

// NOTE: This is currently necessary because we have patched the openslide
// source code to check for this prefix to know if a file is a local file
// rather than a remote file which triggers fetch requests.
const _TMP_LOCAL_PREFIX = "/tmp-local-";

type Pointer = number;

declare var WORKERFS: Emscripten.FileSystemType;
declare function cwrap<I extends Array<Emscripten.JSType | null> | [], R extends Emscripten.JSType | null>(
    ident: string,
    returnType: R,
    argTypes: I,
    opts: {async: true},
): (...arg: ArgsToType<I>) => Promise<ReturnToType<R>>;

interface OpenSlideEmscriptenModule extends EmscriptenModule {
  FS: typeof FS;
  cwrap: typeof cwrap;
  WORKERFS: typeof WORKERFS;
  UTF8ToString: typeof UTF8ToString;
}


function randomString(length: number = 10) {
  let randomName = "";
  for (let i = 0; i < length; i++) {
    randomName += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
  }
  return randomName;
}


async function fetchFileFromUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const u = new URL(response.url);
  const filename = u.pathname.split("/").pop() || "filename";
  const file = new File([blob], filename, { type: blob.type });
  return file;
}


class OpenSlideApi {
  private _getPropertyNamesAsync: (osr: OpenSlideT) => Promise<Pointer>;
  private _getPropertyValueAsync: (osr: OpenSlideT, name: string) => Promise<Pointer>;
  private _getLevelCountAsync: (osr: OpenSlideT) => Promise<number>;
  private _getLevelDimensionsAsync: (osr: OpenSlideT, level: number) => Promise<number>;
  private _getLevelDownsampleAsync: (osr: OpenSlideT, level: number) => Promise<number>;
  private _getBestLevelForDownsampleAsync: (osr: OpenSlideT, downsample: number) => Promise<number>;
  private _readRegionAsync: (osr: OpenSlideT, args: number) => Promise<number>;
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

  async readRegion(osr: OpenSlideT, x: number, y: number, level: number, width: number, height: number, readRgba: boolean = false) {
    // We malloc memory to pack all values into a single chunk of memory
    const args = this.lib._malloc(40);
    this.lib.HEAP64[args / 8] = BigInt(x); // int64_t x (8 bytes)
    this.lib.HEAP64[args / 8 + 1] = BigInt(y); // int64_t y (8 bytes)
    this.lib.HEAP32[args / 4 + 4] = level; // int32_t level (4 bytes)
    this.lib.HEAP32[args / 4 + 5] = 0; // Padding (4 bytes, required for alignment)
    this.lib.HEAP64[args / 8 + 3] = BigInt(width); // int64_t w (8 bytes)
    this.lib.HEAP64[args / 8 + 4] = BigInt(height); // int64_t h (8 bytes)
    this.lib.HEAP32[args / 4 + 10] = readRgba ? 1 : 0; // int32_t read_rgba (4 bytes)

    const data = await this._readRegionAsync(osr, args);
    this.lib._free(args);

    const sz = width * height * 4;
    const imageArray = new Uint8ClampedArray(
      this.lib.HEAPU8.buffer,
      data,
      sz,
    );
    this.lib._free(data);
    return imageArray;
  }

  async open(file: File | string, downloadToLocal: boolean = false) {
    const {filename, mountDir} = await this._open_file(file, downloadToLocal);
    const filepath = mountDir ? `${mountDir}/${filename}` : filename;
    const osr = await this._openSlideAsync(filepath);
    if (mountDir) {
      this._osrMountMap.set(osr, mountDir);
    }
    return osr;
  }

  async _open_file(file: File | string, downloadToLocal: boolean = false) {
    if (typeof file === "string") {
      if (downloadToLocal) {
        const fileObj = await fetchFileFromUrl(file);
        return {
          filename: fileObj.name,
          mountDir: this._mount_file(fileObj),
        };
      } else {
        return {
          filename: file,
          mountDir: null,
        };
      }
    } else {
      return {
        filename: file.name,
        mountDir: this._mount_file(file),
      };
    }
  }

  _mount_file(file: File) {
    const dirname = `${_TMP_LOCAL_PREFIX}${randomString()}`;
    this.lib.FS.mkdir(dirname);
    this.lib.FS.mount(this.lib.WORKERFS, { files: [file] }, dirname)
    return dirname;
  }

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
      const {file, downloadToLocal} = data.payload;
      const osr = await api.open(file, downloadToLocal);
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
      const {osr, x, y, level, width, height, readRgba} = data.payload;
      const regionData = await api.readRegion(osr, x, y, level, width, height, readRgba);
      doPostMessage(id, {type: "readRegion", payload: {data: regionData}});
      break;
    }
    default:
      exhaustiveCheck(dataType);
  }
}

function exhaustiveCheck(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}