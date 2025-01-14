# Openslide Web Assembly

The project compiles [Openslide](https://openslide.org/), along with its dependencies, to web assembly using [Emscripten](https://emscripten.org/). There are also additional Typescript wrappers for common slide operations such as file loading and tile fetching.

## Building from scratch
To build the project follow these steps:
1. Load dependencies. You can either extract the included tar (`tar -xvzf external.tar.gz`) or run the `get_external_deps.sh` script. 

2. Build the Docker build environment. We have included all the build tools necessary (e.g Emscripten, Meson) in this container: `docker build -t wasm-build .`

3. Login to the container `docker run -it -v dist:/dist wasm-build /bin/bash` 

4. Run the build script inside the container `./build.sh`

NOTE: The initial build can take an hour or more complete. You may see errors or warnings relating to CMake configuration, you can ignore these.

## Using the library
