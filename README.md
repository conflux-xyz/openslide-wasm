# Openslide.js

Openslide WASM is a Javascript library wrapping Openslide via webassembly. With this library you can load images in any format that Openslide supports, read metadata and load image regions within a web browser.

The project compiles [Openslide](https://openslide.org/), along with its dependencies, to web assembly using [Emscripten](https://emscripten.org/). There are also additional Javascript wrappers for common slide operations such as file loading and tile fetching.

## Getting Started
To use the library you just need to add the files in the `/dist` directory to your web project and add `openslide.js` in a script tag in your HTML file. The example folder has a complete setup, including a python server and sample SVS to play with. 

```javascript
async function run() {
    const ctx = await Openslide();
    const image = await ctx.open('sample.svs');
    const numLevels = image.getLevelCount();
    const dims = image.getLevelDimensions(0);
    const canvas = document.getElementById("image");
    image.drawToCanvas(canvas, 0, 0, 0, 512, 512);
}
run();

```

## Limitations
Openslide.js uses `SharedArrayBuffer`, so any website it is included in *cannot* make cross-origin requests. This might require image viewing features to be hosted in an iframe. Take a look at `src/server.py` for an example on the necessary headers for running the script. This [article](https://blog.logrocket.com/understanding-sharedarraybuffer-and-cross-origin-isolation/) provides some helpful context.


## Build using Docker
To build the project follow these steps:
1. Load dependencies. You can either extract the included tar (`tar -xvzf external.tar.gz`) or run the `get_external_deps.sh` script. 

2. Build the Docker build environment. We have included all the build tools necessary (e.g Emscripten, Meson) in this container: `docker build -t wasm-build .`

3. Run the container `docker run -v .:/src wasm-build /bin/sh` 

4. Run the build script: `cd /src; ./build.sh`

NOTE: The initial build can take 20-30 minutes to complete. Once the dependencies are compiled re-running the build script should be much faster.

## Build locally
1. Install the build tools below:
    * emscripten
    * Python 3.9 (python3 python3-pip python3-setuptools python3-wheel)
    * Meson
    * autoconf 
    * automake 
    * libtool 
    * libglib2.0-dev-bin 
    * pkg-config  
    * ninja-build

2. Edit `emscripten-crossfile.meson` to point to your python path under the `[binaries]` section:
    ```
    [binaries]
    python = '/usr/bin/python3.9'
    ...
    ```

3. Load dependencies. You can either extract the included tar (`tar -xvzf external.tar.gz`) or run the `get_external_deps.sh` script. 

4. Run the build command: 
    ```
    EMSCRIPTEN_PATH=<your emscripten install directory> SOURCE_HOME=$(pwd) ./build.sh
    ```

