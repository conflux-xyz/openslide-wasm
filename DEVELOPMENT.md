# Development

## Building

### Build using Docker

To build the project follow these steps:

1. Load dependencies by running the `get_external_deps.sh` script.

2. Build the Docker build environment. We have included all the build tools necessary (e.g Emscripten, Meson) in this container: `docker build -t wasm-build .`

3. Build in the docker container: `docker run -v .:/src wasm-build ./build.sh`

NOTE: The initial build can take 20-30 minutes to complete. Once the dependencies are compiled re-running the build script should be much faster.

4. In the `openslide-wasm` directory: `yarn install; yarn build`

### Build locally

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

5. In the `openslide-wasm` directory: `yarn install; yarn build`

## Tests
A basic set of unit tests is included in the `openslide-wasm/tests/` directory. They can be run via `yarn test`


## Debugging

To debug, set `DEBUG_MODE="on"` in `build.sh`, re-fetch all external dependencies, and re-build.

This will build with DWARF flags and source maps.

Then following https://developer.chrome.com/blog/wasm-debugging-2020/,
1. Install the extension: https://goo.gle/wasm-debugging-extension
2. Add the following path substitution:
    * old path: `/src/`
    * new path: `http://localhost:8080/`

This will then allow you to debug openslide-wasm by running

```shell
python examples/server.py
```
and visiting [`http://localhost:8080/examples/canvas`](http://localhost:8080/examples/canvas).

You should then be able to use the chrome devtools for debugging.