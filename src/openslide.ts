type OpenslideWasmAPI = any;
type OpenslidePtr = number;

class OpenslideImage {
  imgPtr: OpenslidePtr;
  wasmApi: OpenslideWasmAPI;
  filename: string;

  constructor(wasmApi: OpenslideWasmAPI, imgPtr: OpenslidePtr, filename: string) {
    this.imgPtr = imgPtr;
    this.wasmApi = wasmApi;
    this.filename = filename;
  }

  getPropertyNames() {
    const stringArr = this.wasmApi._get_property_names(this.imgPtr);
    const memory = this.wasmApi.HEAPU8;
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

  getPropertyValue(name: string) {
    const nameCstr = cstring(this.wasmApi, name);
    const memory = this.wasmApi.HEAPU8;
    const stringPtr = this.wasmApi._get_property_value(this.imgPtr, nameCstr);
    let str = "";
    if (stringPtr === 0) return null;
    for (let j = stringPtr; memory[j] !== 0; j++) {
      str += String.fromCharCode(memory[j]);
    }
    this.wasmApi._free_result(nameCstr);
    return str;
  }

  getLevelCount() {
    return this.wasmApi._get_level_count(this.imgPtr);
  }

  getLevelDimensions(level: number) {
    const result = this.wasmApi._get_level_dimensions(this.imgPtr, level);
    const int64View = new BigInt64Array(this.wasmApi.HEAP8.buffer, result, 2);
    const w = int64View[0];
    const h = int64View[1];
    this.wasmApi._free_result(result);
    return [Number(w), Number(h)];
  }

  getLevelDownsample(level: number) {
    return this.wasmApi._get_level_downample(this.imgPtr, level);
  }

  readRegion(
    x: number,
    y: number,
    level: number,
    w: number,
    h: number,
    readRgba: boolean = false
  ) {
    const data = this.wasmApi._read_region(
      this.imgPtr,
      BigInt(x),
      BigInt(y),
      level,
      BigInt(w),
      BigInt(h),
      readRgba
    );
    const sz = w * h * 4;
    const uint32View = new Uint8ClampedArray(
      this.wasmApi.HEAPU32.buffer,
      data,
      sz
    );
    this.wasmApi._free_result(data);
    return uint32View;
  }

  drawToCanvas(
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    level: number,
    w: number,
    h: number
  ) {
    canvas.width = w;
    canvas.height = h;
    const canvasCtx: CanvasRenderingContext2D | null = canvas.getContext("2d");

    if (!canvasCtx) throw "Error geting canvas context";

    const data = this.wasmApi._read_region(
      this.imgPtr,
      BigInt(x),
      BigInt(y),
      level,
      BigInt(w),
      BigInt(h)
    );
    const sz = w * h * 4;
    const imgBuffer = new Uint32Array(this.wasmApi.HEAPU32.buffer, data, sz);
    this.wasmApi._free_result(data);
    const imageData = canvasCtx.createImageData(w, h);
    for (let i = 0; i < imgBuffer.length; i++) {
      const rgba = imgBuffer[i];
      const offset = i * 4;
      imageData.data[offset] = (rgba >> 16) & 0xff;
      imageData.data[offset + 1] = (rgba >> 8) & 0xff;
      imageData.data[offset + 2] = rgba & 0xff;
      imageData.data[offset + 3] = (rgba >> 24) & 0xff;
    }
    canvasCtx.putImageData(imageData, 0, 0);
  }
  close() {
    this.wasmApi.close_image(this.imgPtr);
    this.wasmApi.FS
  }
}

// Utility functions
function cstring(wasmApi: OpenslideWasmAPI, str: string) {
  const str_raw = new TextEncoder().encode(str);
  let ptr = wasmApi._malloc(str_raw.length + 1);
  let chunk = wasmApi.HEAPU8.subarray(ptr, ptr + str_raw.length);
  chunk.set(str_raw);
  let terminator = wasmApi.HEAPU8.subarray(
    ptr + str_raw.length,
    ptr + str_raw.length + 1
  );
  terminator.set(0);
  return ptr;
}

async function fetchFileFromUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], url, { type: blob.type });
  return file;
}

function loadFile(wasmApi: OpenslideWasmAPI, file: File) {
  return new Promise((resolve, _) => {
    const chunkSize = 64 * 1024 * 1024;
    function writeToWasm(
      file: File,
      offset: number,
      chunkSize: number,
      filename: string
    ) {
      const reader = new FileReader();
      const chunk = file.slice(offset, offset + chunkSize);
      reader.onload = function (event: ProgressEvent<FileReader>) {
        if (!event.target) throw "Could not read file";
        const arrayBuffer = event.target.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        if (offset === 0) {
          wasmApi.FS.createDataFile("/", filename, uint8Array, true, true);
        } else {
          const stream = wasmApi.FS.open("/" + filename, "a+");
          wasmApi.FS.write(stream, uint8Array, 0, uint8Array.length);
          wasmApi.FS.close(stream);
        }
        offset += chunkSize;
        if (offset < file.size) {
          writeToWasm(file, offset, chunkSize, filename);
        } else {
          resolve(filename);
        }
      };
      reader.onerror = function (error) {
        console.error("Error reading file chunk:", error);
      };

      reader.readAsArrayBuffer(chunk);
    }
    let randomName = "";
    for (let i = 0; i < 10; i++) {
      randomName += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
    }
    randomName += ".tmp";
    writeToWasm(file, 0, chunkSize, randomName);
  });
}
declare const Module: any;

class Openslide {
  private wasmApi: OpenslideWasmAPI;
  public isReady: boolean = false;

  async initialize(useWebworker: boolean = false) {
    return new Promise<unknown>(async (resolve) => {
      if (!useWebworker) {
        const scripts = ["api.js"];
        const promises = scripts.map((file) => {
          const s = document.createElement("script");
          s.setAttribute("src", file);
          const promise = new Promise((resolve) => {
            s.onload = () => {
              resolve(true);
            };
          });
          document.head.insertBefore(s, document.head.firstElementChild);
          return promise;
        });
        await Promise.all(promises);
      }
      Module.onRuntimeInitialized = () => {
        this.wasmApi = Module;
        this.isReady = true;
        resolve(true);
      };
    });
  }

  async open(fileOrUrl: File | string) {
    let file: File | null = null;
    if (typeof fileOrUrl === "string") {
      file = await fetchFileFromUrl(fileOrUrl);
    } else {
      file = fileOrUrl;
    }
    const filename = (await loadFile(Module, file)) as string;
    const path = cstring(this.wasmApi, filename);
    const img = this.wasmApi._load_image(path) as number;
    this.wasmApi._free_result(path);
    return new OpenslideImage(this.wasmApi, img, filename);
  }
}
