# OpenSlideWASM

OpenSlideWASM is a Javascript library wrapping OpenSlide via webassembly. With this library you can load images in any format that OpenSlide supports, read metadata and load image regions within a web browser.

The project compiles [OpenSlide](https://openslide.org/), along with its dependencies, to web assembly using [Emscripten](https://emscripten.org/). There are also additional Javascript wrappers for common slide operations such as file loading and tile fetching.

## Getting Started

#### With script files
To use the library you just need to add `openslide.js` directory to your web project.  The dist folder has an example `index.html` to reference.

```javascript
<script language="javascript" type="module">
  import OpenSlide from "./openslide.js";
  async function run() {
   const ctx = new OpenSlide();
   await ctx.initialize();
   const image = await ctx.open("sample.svs");
   const numLevels = image.getLevelCount();
   const dims = image.getLevelDimensions(0);
   const canvas = document.getElementById("image");
   image.drawToCanvas(canvas, 0, 0, 0, 512, 512);
  }
  document.addEventListener("DOMContentLoaded", () => {
    run();
  });
</script>
```

You can also install via [Yarn](https://classic.yarnpkg.com/en/) or [NPM](https://www.npmjs.com/)
- `yarn add @conflux-xyz/openslide-wasm`
- `npm install @conflux-xyz/openslide-wasm`

See more details on using NPM or Yarn [here](https://github.com/conflux-xyz/openslide-wasm/blob/main/src/README.md).

## Limitations

- OpenSlideWASM uses `SharedArrayBuffer`. This [article](https://blog.logrocket.com/understanding-sharedarraybuffer-and-cross-origin-isolation/) provides some helpful context.
- Currently only SVS format is supported.

## Build using Docker

To build the project follow these steps:

1. Load dependencies by running the `get_external_deps.sh` script.

2. Build the Docker build environment. We have included all the build tools necessary (e.g Emscripten, Meson) in this container: `docker build -t wasm-build .`

3. Run the container `docker run -it -v .:/src wasm-build /bin/sh`

4. Run the build script: `cd /src; ./build.sh`

NOTE: The initial build can take 20-30 minutes to complete. Once the dependencies are compiled re-running the build script should be much faster.

5. In the src directory: `yarn install; yarn build`

## Build locally

1. Install the build tools below:

   - emscripten
   - Python 3.9 (python3 python3-pip python3-setuptools python3-wheel)
   - Meson
   - autoconf
   - automake
   - libtool
   - libglib2.0-dev-bin
   - pkg-config
   - ninja-build

2. Edit `emscripten-crossfile.meson` to point to your python path under the `[binaries]` section:

   ```
   [binaries]
   python = '/usr/bin/python3.9'
   ...
   ```

3. Load dependencies by running the `get_external_deps.sh` script.

4. Run the build command:
   ```
   EMSCRIPTEN_PATH=<your emscripten install directory> SOURCE_HOME=$(pwd) ./build.sh
   ```

5. In the src directory: `yarn install; yarn build`

## Tests
A basic set of unit tests is included in the src/tests directory. They can be run via `yarn test`