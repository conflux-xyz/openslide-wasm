# OpenSlideWASM

OpenSlideWASM is a Javascript library wrapping OpenSlide via webassembly. With this library you can load images in any format that OpenSlide supports, read metadata and load image regions within a web browser.

The project compiles [OpenSlide](https://openslide.org/), along with its dependencies, to web assembly using [Emscripten](https://emscripten.org/). There are also additional Javascript wrappers for common slide operations such as file loading and tile fetching.

## Getting Started

### Installation

Install via [NPM](https://www.npmjs.com/) or [Yarn](https://classic.yarnpkg.com/en/):

```shell
yarn add @conflux-xyz/openslide-wasm
npm install @conflux-xyz/openslide-wasm
```

You can then import `OpenSlide` and use it as follows:

```typescript
import OpenSlide from "@conflux-xyz/openslide-wasm";

async function drawSlide(slideFile: File, mpp: number) {
   const openSlide = new OpenSlide({workers: 1});
   await openSlide.initialize();
   const slide = await openSlide.open(slideFile);
   const slideMppStr = await slide.getPropertyValue("openslide.mpp-x");
   if (!slideMppStr) {
      console.error("No MPP property found");
      await slide.close();
      return;
   }
   const slideMpp = parseFloat(slideMppStr);
   const downsample = mpp / slideMpp;
   const [width, height] = await slide.getLevelDimensions(0);
   const targetWidth = Math.round(width / downsample);
   const targetHeight = Math.round(height / downsample);
   const bestLevel = await slide.getBestLevelForDownsample(downsample);
   const [levelWidth, levelHeight] = await slide.getLevelDimensions(bestLevel);

   const region = await slide.readRegion(0, 0, bestLevel, levelWidth, levelHeight);
   const imageData = new ImageData(region, levelWidth, levelHeight);

   // Resize the image tile data to the desired width and height
   const bitmap = await createImageBitmap(imageData, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
   });

   const canvas = document.getElementById("image");
   const ctx2d = canvas.getContext("2d");
   canvas.style.border = "1px solid black";
   canvas.width = targetWidth;
   canvas.height = targetHeight;
   ctx2d.drawImage(bitmap, 0, 0);
};
```

## Examples

Check out the [examples/](./examples/) directory for a good example of reading a WSI from a File or URL.

You can run it yourself by:
```shell
cd openslide-wasm
yarn
yarn build
cd ../
python examples/server.py
```
and visit [http://localhost:8080/examples/canvas](http://localhost:8080/examples/canvas).

## Important Notes

### SharedArrayBuffer

OpenSlideWASM uses `SharedArrayBuffer`. This [article](https://blog.logrocket.com/understanding-sharedarraybuffer-and-cross-origin-isolation/) provides some helpful context.

Because of this, when you serve the web pages that use `OpenSlideWASM`, you will need to send the following headers with each request:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### CORS

When fetching files from a remote server into the browser, you will need to ensure CORS headers are appropriately set on the files that you are fetching.

For a fairly permissive example:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Allow-Headers: *
```

### Range Requests

If you want to reference a remote WSI but do not want to download it locally, `OpenSlideWASM` supports reading via byte range requests.

For this to work:
1. The server serving the WSIs must support byte range requests.
2. If the server is running behind a different domain, in addition the CORS headers listed above, the server will also need to provide the following response header:
```
Access-Control-Expose-Headers: Accept-Ranges, Content-Encoding, Content-Length
```

### Multi-File Formats

While many WSI file formats are single-file, and therefore straightforward to use in a browser context, some format are multi-file, such as [DICOM](https://openslide.org/formats/dicom/), [MIRAX](https://openslide.org/formats/mirax/), and [Hamamatsu VMS and VMU](https://openslide.org/formats/hamamatsu/).

Support for these formats is provided by using the `File[]` or `FileEntry[]` types to `openSlide.open(...)`:

```typescript
interface FileEntry {
   file: File;
   path: string;
}
```

This allows you to provide multiple files and allows you to specify the context of those files within a directory structure, if necessary.

The first element of the array is the one that will be passed to OpenSlide as the file to open.

Below are a few examples:
```typescript
// MIRAX requires a file `{NAME}.mrxs` file with a corresponding `{NAME}/` sibling directory.
function getMiraxFileEntries(files: File[]): FileEntry[] {
   const miraxFile = files.find(file => file.name.toLowerCase().endsWith(".mrxs"));
   if (!miraxFile) {
      throw new Error("No .mrxs file found in the provided files");
   }
   // Create the directory structure and ensure .mrxs file is first
   const miraxFileEntry = {file: miraxFile, path: miraxFile.name};
   const dirname = miraxFile.name.slice(0, -5); // Remove the .mrxs extension for the directory name
   const otherFiles = files.filter(file => file !== miraxFile);
   const otherFileEntries = otherFiles.map(file => ({file, path: `${dirname}/${file.name}`}))
   return [miraxFileEntry, ...otherFileEntries];
}

// Hamamatsu VMS requires reading in the `.vms` file but needs all other files as well.
function getHamamatsuVmsFiles(files: File[]): File[] {
   const vmsFile = files.find(file => file.name.toLowerCase().endsWith(".vms"));
   if (!vmsFile) {
      throw new Error("No .vms file found in the provided files");
   }
   const otherFiles = files.filter(file => file !== vmsFile);
   return [vmsFile, ...otherFiles];
}

// For DICOM, OpenSlide doesn't care which file is passed in, as long as all files are present
function getDicomFiles(files: File[]): File[] {
   // Basically a no-op
   return files;
}
```


### Other File Formats

We strive to support all WSI file formats that are supported by the OpenSlide C library.

If you find a format that works with the OpenSlide C library but not with OpenSlideWASM, please file an issue, and, even better, submit a pull request!