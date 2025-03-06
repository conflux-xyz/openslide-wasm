export class OpenSlideImage {
    constructor(wasmApi, imgPtr) {
        Object.defineProperty(this, "imgPtr", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "wasmApi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.imgPtr = imgPtr;
        this.wasmApi = wasmApi;
    }
    getPropertyNames() {
        const stringArr = this.wasmApi._get_property_names(this.imgPtr);
        const memory = this.wasmApi.HEAPU8;
        const result = [];
        const charView = new Uint32Array(memory.buffer);
        for (let i = 0;; i++) {
            const stringPtr = charView[(stringArr >> 2) + i];
            if (stringPtr === 0)
                break;
            let str = "";
            for (let j = stringPtr; memory[j] !== 0; j++) {
                str += String.fromCharCode(memory[j]);
            }
            result.push(str);
        }
        return result;
    }
    getPropertyValue(name) {
        const nameCstr = cstring(this.wasmApi, name);
        const memory = this.wasmApi.HEAPU8;
        const stringPtr = this.wasmApi._get_property_value(this.imgPtr, nameCstr);
        let str = "";
        if (stringPtr === 0)
            return null;
        for (let j = stringPtr; memory[j] !== 0; j++) {
            str += String.fromCharCode(memory[j]);
        }
        this.wasmApi._free_result(nameCstr);
        return str;
    }
    getLevelCount() {
        return this.wasmApi._get_level_count(this.imgPtr);
    }
    getLevelDimensions(level) {
        const result = this.wasmApi._get_level_dimensions(this.imgPtr, level);
        const int64View = new BigInt64Array(this.wasmApi.HEAP8.buffer, result, 2);
        const w = int64View[0];
        const h = int64View[1];
        this.wasmApi._free_result(result);
        return [Number(w), Number(h)];
    }
    getLevelDownsample(level) {
        return this.wasmApi._get_level_downample(this.imgPtr, level);
    }
    async readRegion(x, y, level, w, h, readRgba = false) {
        // We malloc memory to pack all values into a single chunk of memory
        const args = Module._malloc(40);
        Module.HEAP64[args / 8] = 48804n; // int64_t x (8 bytes)
        Module.HEAP64[args / 8 + 1] = 34941n; // int64_t y (8 bytes)
        Module.HEAP32[args / 4 + 4] = 0; // int32_t level (4 bytes)
        Module.HEAP32[args / 4 + 5] = 0; // Padding (4 bytes, required for alignment)
        Module.HEAP64[args / 8 + 3] = 512n; // int64_t w (8 bytes)
        Module.HEAP64[args / 8 + 4] = 512n; // int64_t h (8 bytes)
        Module.HEAP32[args / 4 + 10] = 1; // int32_t read_rgba (4 bytes)
        const data = await this.wasmApi.ccall("read_region", "number", ["number", "number"], [this.imgPtr, args], {
            async: true,
        });
        Module._free_result(args);
        const sz = w * h * 4;
        const uint32View = new Uint8ClampedArray(this.wasmApi.HEAPU32.buffer, data, sz);
        this.wasmApi._free_result(data);
        return uint32View;
    }
    async drawToCanvas(canvas, x, y, level, w, h) {
        canvas.width = w;
        canvas.height = h;
        const canvasCtx = canvas.getContext("2d");
        if (!canvasCtx)
            throw "Error geting canvas context";
        const args = Module._malloc(40);
        Module.HEAP64[args / 8] = BigInt(x); // int64_t x (8 bytes)
        Module.HEAP64[args / 8 + 1] = BigInt(y); // int64_t y (8 bytes)
        Module.HEAP32[args / 4 + 4] = level; // int32_t level (4 bytes)
        Module.HEAP32[args / 4 + 5] = 0; // Padding (4 bytes, required for alignment)
        Module.HEAP64[args / 8 + 3] = BigInt(w); // int64_t w (8 bytes)
        Module.HEAP64[args / 8 + 4] = BigInt(h); // int64_t h (8 bytes)
        Module.HEAP32[args / 4 + 10] = 0; // int32_t read_rgba (4 bytes)
        const data = await this.wasmApi.ccall("read_region", "number", ["number", "number"], [this.imgPtr, args], {
            async: true,
        });
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
        this.wasmApi.FS;
    }
}
// Utility functions
async function fetchFileFromUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], url, { type: blob.type });
    return file;
}
function loadFile(wasmApi, file) {
    return new Promise((resolve, _) => {
        const chunkSize = 64 * 1024 * 1024;
        function writeToWasm(file, offset, chunkSize, filename) {
            const reader = new FileReader();
            const chunk = file.slice(offset, offset + chunkSize);
            reader.onload = function (event) {
                if (!event.target)
                    throw "Could not read file";
                const arrayBuffer = event.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);
                if (offset === 0) {
                    wasmApi.FS.createDataFile("/", filename, uint8Array, true, true);
                }
                else {
                    const stream = wasmApi.FS.open("/" + filename, "a+");
                    wasmApi.FS.write(stream, uint8Array, 0, uint8Array.length);
                    wasmApi.FS.close(stream);
                }
                offset += chunkSize;
                if (offset < file.size) {
                    writeToWasm(file, offset, chunkSize, filename);
                }
                else {
                    resolve(filename);
                }
            };
            reader.onerror = function (error) {
                console.error("Error reading file chunk:", error);
            };
            reader.readAsArrayBuffer(chunk);
        }
        let randomName = "__local_file__";
        for (let i = 0; i < 10; i++) {
            randomName += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
        randomName += ".tmp";
        writeToWasm(file, 0, chunkSize, randomName);
    });
}
function cstring(wasmApi, str) {
    const str_raw = new TextEncoder().encode(str);
    let ptr = wasmApi._malloc(str_raw.length + 1);
    let chunk = wasmApi.HEAPU8.subarray(ptr, ptr + str_raw.length);
    chunk.set(str_raw);
    wasmApi.HEAPU8[ptr + str_raw.length] = 0;
    return ptr;
}
export class OpenSlide {
    constructor() {
        Object.defineProperty(this, "wasmApi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isReady", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    async initialize(path = "", skipScriptLoad = false) {
        return new Promise(async (resolve) => {
            if (!skipScriptLoad) {
                const scripts = [path + "openslide-api.js"];
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
    async open(fileOrUrl, downloadToLocal = false) {
        let path = 0;
        if (typeof fileOrUrl === "string") {
            if (downloadToLocal) {
                const file = await fetchFileFromUrl(fileOrUrl);
                const wasmFilePath = await loadFile(this.wasmApi, file);
                path = cstring(this.wasmApi, wasmFilePath);
            }
            else {
                path = cstring(this.wasmApi, fileOrUrl);
            }
        }
        else {
            // copy the file onto the wasm file system
            const wasmFilePath = await loadFile(this.wasmApi, fileOrUrl);
            path = cstring(this.wasmApi, wasmFilePath);
        }
        const img = await this.wasmApi.ccall("load_image", "number", ["number"], [path], {
            async: true,
        });
        this.wasmApi._free_result(path);
        return new OpenSlideImage(this.wasmApi, img);
    }
}
