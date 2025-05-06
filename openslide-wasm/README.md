# OpenSlideWASM

OpenSlideWASM is a Javascript library for parsing whole slide image formats. It wraps the OpenSlide C library via WebAssembly.

### Getting started

##### Install via Yarn

- `yarn add @conflux-xyz/openslide-wasm`

##### Install via NPM:

- `npm install @conflux-xyz/openslide-wasm`

##### Import into project

```javascript
import OpenSlide from "@conflux-xyz/openslide-wasm";

async function run() {
  const ctx = new OpenSlide();
  await ctx.initialize();
  const image = await ctx.open("sample.svs");
  const numLevels = image.getLevelCount();
  const dims = image.getLevelDimensions(0);
  // draw to a canvas with id "image"
  const canvas = document.getElementById("image");
  image.drawToCanvas(canvas, 0, 0, 0, 512, 512);
}
run();
```

#### Limitations

- OpenSlideWASM uses `SharedArrayBuffer`. This [article](https://blog.logrocket.com/understanding-sharedarraybuffer-and-cross-origin-isolation/) provides some helpful context.
- Only SVS image loading is supported.

#### Bugs or Feedback?

We welcome feedback. The best way to get in touch is via [Github Issues](https://github.com/conflux-xyz/openslide-wasm)
