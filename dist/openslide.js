async function fetchFileFromUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], url, { type: blob.type });
  return file;
}

function loadFile(ctx, file) {
  return new Promise((resolve, _) => {
    const chunkSize = 64 * 1024 * 1024;
    function writeToWasm(file, offset, chunkSize, filename) {
      console.log(file);
      const reader = new FileReader();
      const chunk = file.slice(offset, offset + chunkSize);
      reader.onload = function (event) {
        const arrayBuffer = event.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        if (offset === 0) {
          ctx.FS_createDataFile("/", filename, uint8Array, true, true);
        } else {
          const stream = ctx.FS_open("/" + filename, "a+");
          ctx.FS_write(stream, uint8Array, 0, uint8Array.length);
          ctx.FS_close(stream);
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

function cstring(str) {
  const str_raw = new TextEncoder().encode(str);
  let ptr = Module._malloc(str_raw.length + 1);
  let chunk = Module.HEAPU8.subarray(ptr, ptr + str_raw.length);
  chunk.set(str_raw);
  let terminator = Module.HEAPU8.subarray(
    ptr + str_raw.length,
    ptr + str_raw.length + 1,
  );
  terminator.set(0);
  return ptr;
}

function OpenslideImage(ctx, ptr) {
  return {
    getPropertyNames: () => {
      const stringArr = ctx._get_property_names(ptr);
      const memory = ctx.HEAPU8;
      const result = [];
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
    },
    getPropertyValue: (name) => {
      const nameCstr = cstring(name);
      const memory = ctx.HEAPU8;
      const stringPtr = ctx._get_property_value(ptr, nameCstr);
      let str = "";
      if (stringPtr === 0) return null;
      for (let j = stringPtr; memory[j] !== 0; j++) {
        str += String.fromCharCode(memory[j]);
      }
      ctx._free_result(nameCstr);
      return str;
    },
    getLevelCount: () => {
      return ctx._get_level_count(ptr);
    },
    getLevelDimensions: (level) => {
      const result = ctx._get_level_dimensions(ptr, level);
      const int64View = new BigInt64Array(ctx.HEAP8.buffer, result, 2);
      const w = int64View[0];
      const h = int64View[1];
      ctx._free_result(result);
      return [Number(w), Number(h)];
    },
    getLevelDownsample: (level) => {
      return ctx._get_level_downample(ptr, level);
    },
    readRegion: (x, y, level, w, h, format) => {
      if (format === undefined) {
        const data = ctx._read_region(
          ptr,
          BigInt(x),
          BigInt(y),
          level,
          BigInt(w),
          BigInt(h),
        );
        const sz = w * h * 4;
        const uint32View = new Uint32Array(ctx.HEAPU32.buffer, data, sz);
        ctx._free_result(data);
        return uint32View;
      } else {
      }
    },
    drawToCanvas: (canvas, x, y, level, w, h) => {
      canvas.width = w;
      canvas.height = h;
      const canvasCtx = canvas.getContext("2d");
      const data = ctx._read_region(
        ptr,
        BigInt(x),
        BigInt(y),
        level,
        BigInt(w),
        BigInt(h),
      );
      const sz = w * h * 4;
      const imgBuffer = new Uint32Array(ctx.HEAPU32.buffer, data, sz);
      ctx._free_result(data);
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
    },
    close: () => {
      ctx.close_image(ptr);
    },
  };
}

function OpenslideContext(ctx) {
  return {
    open: async (fileOrUrl) => {
      let file = null;
      if (typeof fileOrUrl === "string") {
        file = await fetchFileFromUrl(fileOrUrl);
      } else {
        file = fileOrUrl;
      }
      const filename = await loadFile(ctx, file);
      const path = cstring(filename);
      const img = ctx._load_image(path);
      ctx._free_result(path);
      return OpenslideImage(ctx, img);
    },
  };
}

async function Openslide(callback) {
  return new Promise(async (resolve, reject) => {
    const scripts = ["api.js"];
    const promises = scripts.map((file) => {
      const s = document.createElement("script");
      s.setAttribute("src", file);
      const promise = new Promise((resolve, reject) => {
        s.onload = () => {
          resolve();
        };
      });
      document.head.insertBefore(s, document.head.firstElementChild);
      return promise;
    });

    await Promise.all(promises);
    Module.onRuntimeInitialized = () => {
      const ctx = OpenslideContext(Module);
      if (callback) callback(ctx);
      resolve(ctx);
    };
  });
}
