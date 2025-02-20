type OpenslideWasmAPI = any;
type OpenslidePtr = number;

export class OpenSlideImage {
  imgPtr: OpenslidePtr;
  wasmApi: OpenslideWasmAPI;

  constructor(wasmApi: OpenslideWasmAPI, imgPtr: OpenslidePtr) {
    this.imgPtr = imgPtr;
    this.wasmApi = wasmApi;
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

  async readRegion(
    x: number,
    y: number,
    level: number,
    w: number,
    h: number,
    readRgba: boolean = false
  ) {
    // We malloc memory to pack all values into a single chunk of memory
    const args = Module._malloc(40);
    Module.HEAP64[(args / 8)] = 48804n;   // int64_t x (8 bytes)
    Module.HEAP64[(args / 8) + 1] = 34941n; // int64_t y (8 bytes)
    Module.HEAP32[(args / 4) + 4] = 0;    // int32_t level (4 bytes)
    Module.HEAP32[(args / 4) + 5] = 0;    // Padding (4 bytes, required for alignment)
    Module.HEAP64[(args / 8) + 3] = 512n; // int64_t w (8 bytes)
    Module.HEAP64[(args / 8) + 4] = 512n; // int64_t h (8 bytes)
    Module.HEAP32[(args / 4) + 10] = 1;   // int32_t read_rgba (4 bytes)
    
    const data = await this.wasmApi.ccall(
      "read_region",
      "number",
      ["number", "number"],
      [this.imgPtr, args],
      {
        async: true,
      }
    );
    Module._free_result(args);
    const sz = w * h * 4;
    const uint32View = new Uint8ClampedArray(
      this.wasmApi.HEAPU32.buffer,
      data,
      sz
    );
    this.wasmApi._free_result(data);
    return uint32View;
  }

  async drawToCanvas(
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

    const args = Module._malloc(40);
    Module.HEAP64[(args / 8)] = BigInt(x);   // int64_t x (8 bytes)
    Module.HEAP64[(args / 8) + 1] = BigInt(y); // int64_t y (8 bytes)
    Module.HEAP32[(args / 4) + 4] = level;    // int32_t level (4 bytes)
    Module.HEAP32[(args / 4) + 5] = 0;    // Padding (4 bytes, required for alignment)
    Module.HEAP64[(args / 8) + 3] = BigInt(w); // int64_t w (8 bytes)
    Module.HEAP64[(args / 8) + 4] = BigInt(h); // int64_t h (8 bytes)
    Module.HEAP32[(args / 4) + 10] = 0;   // int32_t read_rgba (4 bytes)
    
    const data = await this.wasmApi.ccall(
      "read_region",
      "number",
      ["number", "number"],
      [this.imgPtr, args],
      {
        async: true,
      }
    );
    Module._free_result(args);
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
    requestAnimationFrame(() => canvasCtx.putImageData(imageData, 0, 0));
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

declare const Module: any;

export class OpenSlide {
  private wasmApi: OpenslideWasmAPI;
  public isReady: boolean = false;

  async initialize(useWebworker: boolean = false) {
    return new Promise<unknown>(async (resolve) => {
      if (!useWebworker) {
        const scripts = ["openslide-api.js"];
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
    const path = cstring(this.wasmApi, fileOrUrl as string);
    const img = await this.wasmApi.ccall("load_image", "number", ["number"], [path], {
      async: true,
    });
    this.wasmApi._free_result(path);
    return new OpenSlideImage(this.wasmApi, img);
  }
}
