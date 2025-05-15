#!/usr/bin/env sh

set -e

if [ -z "$EMSCRIPTEN_PATH" ]; then
  export EMSCRIPTEN_PATH=/emsdk/emsdk_env.sh
fi

if [ -z "$SOURCE_HOME" ]; then
  export SOURCE_HOME=/src
fi

# source ${EMSCRIPTEN_PATH}
alias pkgconfig=pkg-config
export MAKEFLAGS="-j$(nproc)"
export DEPS_DIRECTORY=${SOURCE_HOME}/external
export BUILD_DIRECTORY=${DEPS_DIRECTORY}/build
export EM_PKG_CONFIG_PATH=${BUILD_DIRECTORY}/lib/pkgconfig/
export PKG_CONFIG_PATH=${BUILD_DIRECTORY}/lib/pkgconfig/
export EM_PKG_CONFIG_LIBDIR=${BUILD_DIRECTORY}/lib/
export PKG_CONFIG_LIBDIR=${BUILD_DIRECTORY}/lib/
export CHOST="wasm32-unknown-linux"
export ax_cv_c_float_words_bigendian=no
export MESON_CROSS=${SOURCE_HOME}/emscripten-crossfile.meson

export DEFAULT_CFLAGS="-O3 -msimd128 -s USE_PTHREADS=1 -pthread"
export DEFAULT_LDFLAGS="-O3 -lpthread"

cd ${DEPS_DIRECTORY}

# Build zlib
echo "=========="
echo "Building libz"
if [ ! -f "$PKG_CONFIG_LIBDIR/libz.a" ]; then
cd ${DEPS_DIRECTORY}/zlib
(emconfigure ./configure \
    --static \
    --prefix=${BUILD_DIRECTORY} && \
    emmake make  && \
    emmake make install) || { echo 'zlib build failed'; exit 1; }
else
echo 'zlib found. Skipping build.';
fi

# Build libpng
echo "=========="
echo "Building libpng"
if [ ! -f "$PKG_CONFIG_LIBDIR/libpng16.a" ]; then
cd ${DEPS_DIRECTORY}/libpng
emcmake cmake . \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="${DEFAULT_CFLAGS}" \
    -DCMAKE_EXE_LINKER_FLAGS="${DEFAULT_LDFLAGS}" \
    -DCMAKE_SHARED_LINKER_FLAGS="${DEFAULT_LDFLAGS}" \
    -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} \
    -DPNG_STATIC=ON \
    -DPNG_SHARED=OFF \
    -DPNG_TESTS=OFF \
    -DZLIB_INCLUDE_DIR=${BUILD_DIRECTORY}/include/ \
    -DZLIB_LIBRARY=${BUILD_DIRECTORY}/lib/libz.a
emmake make install
else
echo 'libpng found. Skipping build.';
fi


# Build libjpeg
echo "=========="
echo "Building libjpeg"
if [ ! -f "$PKG_CONFIG_LIBDIR/libjpeg.a" ]; then
cd ${DEPS_DIRECTORY}/libjpeg-turbo
(emcmake cmake . \
    -DCMAKE_C_FLAGS="${DEFAULT_CFLAGS}" \
    -DCMAKE_EXE_LINKER_FLAGS="${DEFAULT_LDFLAGS}" \
    -DCMAKE_SHARED_LINKER_FLAGS="${DEFAULT_LDFLAGS}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} && \
emmake make && \
emmake make install) || { echo 'lib-jpeg-turbo build failed'; exit 1; }
else
echo 'libjpeg found. Skipping build.';
fi

# Build zstd
echo "=========="
echo "Building zstd"
if [ ! -f "$PKG_CONFIG_LIBDIR/libzstd.a" ]; then
cd ${DEPS_DIRECTORY}/zstd/build/meson
(CFLAGS="${DEFAULT_CFLAGS}" LDFLAGS="${DEFAULT_LDFLAGS}" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release && \
    meson install -C _build) || { echo 'zstd build failed'; exit 1; }
else
echo 'libzstd found. Skipping build.';
fi

# Build libffi
echo "=========="
echo "Building libffi"
if [ ! -f "$PKG_CONFIG_LIBDIR/libffi.a" ]; then
cd ${DEPS_DIRECTORY}/libffi
(./autogen.sh && \
    emconfigure ./configure \
        --host=${CHOST} \
        CFLAGS="${DEFAULT_CFLAGS}" \
        --prefix=${BUILD_DIRECTORY} \
        --enable-static \
        --disable-shared \
        --disable-dependency-tracking \
        --disable-builddir \
        --disable-multi-os-directory \
        --disable-raw-api \
        --disable-structs \
        --disable-docs && \
    emmake make && \
    emmake make install SUBDIRS='include') || { echo 'libffi build failed'; exit 1; }
else
echo 'libffi found. Skipping build.';
fi

# Build glib
echo "=========="
echo "Building glib"
if [ ! -f "$PKG_CONFIG_LIBDIR/libglib-2.0.a" ]; then
cd ${DEPS_DIRECTORY}/glib
(CFLAGS="${DEFAULT_CFLAGS}" LDFLAGS="${DEFAULT_LDFLAGS}" \
    meson setup _build \
    --prefix=${BUILD_DIRECTORY} \
    --cross-file=$MESON_CROSS --default-library=static --buildtype=release \
    --force-fallback-for=pcre2,gvdb -Dselinux=disabled -Dxattr=false -Dlibmount=disabled -Dnls=disabled \
    -Dtests=false  -Dglib_assert=false -Dglib_checks=false && \
    meson install -C _build) || { echo 'glib build failed'; exit 1; }
else
echo 'glib found. Skipping build.';
fi

# Build pixman
echo "=========="
echo "Building pixman"
if [ ! -f "$PKG_CONFIG_LIBDIR/libpixman-1.a" ]; then
cd ${DEPS_DIRECTORY}/pixman
wget https://cairographics.org/releases/pixman-0.42.2.tar.gz
tar -xvzf pixman-0.42.2.tar.gz
cd pixman-0.42.2
(CFLAGS="${DEFAULT_CFLAGS}" LDFLAGS="${DEFAULT_LDFLAGS}" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build) || { echo 'pixman build failed'; exit 1; }
else
echo 'pixman found. Skipping build.';
fi

# Build freetype
echo "=========="
echo "Building freetype"
if [ ! -f "$PKG_CONFIG_LIBDIR/libfreetype.a" ]; then
cd ${DEPS_DIRECTORY}/freetype

(CFLAGS="${DEFAULT_CFLAGS} $(pkg-config --cflags pixman)" LDFLAGS="${DEFAULT_LDFLAGS} $(pkg-config --libs pixman)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build) || { echo 'freetype build failed'; exit 1; }
else
echo 'freetype found. Skipping build.';
fi

# Build libexpat
echo "=========="
echo "Building libexpat"
if [ ! -f "$PKG_CONFIG_LIBDIR/libexpat.a" ]; then
cd ${DEPS_DIRECTORY}/libexpat/expat
(./buildconf.sh &&
    emconfigure ./configure \
        --without-docbook \
        --host=${CHOST} \
        --prefix=${BUILD_DIRECTORY} \
        --enable-shared=no \
        --disable-dependency-tracking \
        CFLAGS="${DEFAULT_CFLAGS}" \
        LDFLAGS="${DEFAULT_LDFLAGS}" && \
    emmake make && \
    emmake make install) || { echo 'liexpat build failed'; exit 1; }
else
echo 'libexpat found. Skipping build.';
fi

# Build fontconfig
echo "=========="
echo "Building fontconfig"
if [ ! -f "$PKG_CONFIG_LIBDIR/libfontconfig.a" ]; then
cd ${DEPS_DIRECTORY}/fontconfig

(CFLAGS="${DEFAULT_CFLAGS} $(pkg-config --cflags pixman)" LDFLAGS="${DEFAULT_LDFLAGS} $(pkg-config --libs pixman)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtools=disabled -Dtests=disabled && \
    meson install -C _build) || { echo 'fontconfig build failed'; exit 1; }
else
echo 'libfontconfig found. Skipping build.';
fi

# Build Cairo
echo "=========="
echo "Building cairo"
if [ ! -f "$PKG_CONFIG_LIBDIR/libcairo.a" ]; then
cd ${DEPS_DIRECTORY}/cairo
(CFLAGS="${DEFAULT_CFLAGS} $(pkg-config --cflags pixman freetype2 fontconfig expat)" LDFLAGS="${DEFAULT_LDFLAGS} $(pkg-config --libs pixman libpng freetype2 fontconfig expat)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build) || { echo 'cairo build failed'; exit 1; }
else
echo 'cairo found. Skipping build.';
fi

# Build libtiff
echo "=========="
echo "Building libtiff"
if [ ! -f "$PKG_CONFIG_LIBDIR/libtiff.a" ]; then
cd ${DEPS_DIRECTORY}/libtiff
(CFLAGS="${DEFAULT_CFLAGS}" LDFLAGS="${DEFAULT_LDFLAGS}" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Djpeg=enabled -Dpkg_config_path=${PKG_CONFIG_PATH} && \
    meson install -C _build) || { echo 'libtiff build failed'; exit 1; }
else
echo 'libtiff found. Skipping build.';
fi

# Build openjpeg
echo "=========="
echo "Building openjpeg"
if [ ! -f "$PKG_CONFIG_LIBDIR/libopenjp2.a" ]; then
cd ${DEPS_DIRECTORY}/openjpeg
(emcmake cmake . \
    -DCMAKE_C_FLAGS="${DEFAULT_CFLAGS}" \
    -DCMAKE_EXE_LINKER_FLAGS="${DEFAULT_LDFLAGS}" \
    -DCMAKE_SHARED_LINKER_FLAGS="${DEFAULT_LDFLAGS}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_CODEC=OFF \
    -DZLIB_INCLUDE_DIR=${BUILD_DIRECTORY}/include/ \
    -DZLIB_LIBRARY=${BUILD_DIRECTORY}/lib/libz.a \
    -DTIFF_INCLUDE_DIR=${BUILD_DIRECTORY}/include/ \
    -DTIFF_LIBRARY=${BUILD_DIRECTORY}/lib/libtiff.a \
    -DPNG_LIBRARY=${BUILD_DIRECTORY}/lib/libpng16.a \
    -DPNG_PNG_INCLUDE_DIR=${BUILD_DIRECTORY}/include/ \
    -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} && \
emmake make install) || { echo 'openjpeg build failed'; exit 1; }
else
echo 'openjpeg found. Skipping build.';
fi

# Build libxml2
echo "=========="
echo "Building libxml2"
if [ ! -f "$PKG_CONFIG_LIBDIR/libxml2.a" ]; then
cd ${DEPS_DIRECTORY}/libxml2
(CFLAGS="${DEFAULT_CFLAGS}" LDFLAGS="${DEFAULT_LDFLAGS}" meson setup _build --prefix=${BUILD_DIRECTORY} -Dpython=disabled --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    meson install -C _build) || { echo 'libxml2 build failed'; exit 1; }
else
echo 'libxml2 found. Skipping build.';
fi

# Build gdk-pixbuf
echo "=========="
echo "Building gdk-pixbuf"
if [ ! -f "$PKG_CONFIG_LIBDIR/libgdk_pixbuf-2.0.a" ]; then
cd ${DEPS_DIRECTORY}/gdk-pixbuf
(CFLAGS="${DEFAULT_CFLAGS} $(pkg-config --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0 libjpeg)" LDFLAGS="${DEFAULT_LDFLAGS} $(pkg-config --libs libzstd libpng libtiff-4 libopenjp2 glib-2.0 libjpeg)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS -Dgio_sniffing=false -Ddocs=false -Dtests=false --default-library=static --buildtype=release  && \
    meson install -C _build) || { echo 'gdk-pixbuf build failed'; exit 1; }
else
echo 'gdk-pixbuf found. Skipping build.';
fi

# Build sqlite3
echo "=========="
echo "Building sqlite3"
if [ ! -f "$PKG_CONFIG_LIBDIR/libsqlite3.a" ]; then
cd ${DEPS_DIRECTORY}/sqlite
(CFLAGS="${DEFAULT_CFLAGS}" LDFLAGS="${DEFAULT_LDFLAGS}" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    meson install -C _build) || { echo 'sqlite3 build failed'; exit 1; }
else
echo 'sqlite3 found. Skipping build.';
fi

# Build openslide
echo "=========="
echo "Building openslide"
if [ ! -f "$PKG_CONFIG_LIBDIR/libopenslide.a" ]; then
cd ${DEPS_DIRECTORY}/openslide
(CFLAGS="${DEFAULT_CFLAGS} $(pkg-config --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0 cairo libjpeg)" LDFLAGS="${DEFAULT_LDFLAGS} $(pkg-config --libs glib-2.0 cairo libjpeg)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    meson install -C _build) || { echo 'openslide build failed'; exit 1; }
else
echo 'openslide found. Skipping build.';
fi

# Build openslide wasm
echo "=========="
echo "Building openslide-api.c"
cd ${DEPS_DIRECTORY}

# Notes:
# - `-s ASYNCIFY=1` appears to be necessary for FS.createLazyFile to work.
# - For development builds, consider removing -Os to speed up builds (~4x speedup).
#   Also consider adding `-g` to add DWARF debug information.
    # -O3 \
    # -msimd128 \
(emcc -lworkerfs.js -s WASM=1 \
    -O3 -flto -msimd128 \
    -s MODULARIZE=1 -s EXPORT_NAME="createModule" -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web,worker \
    -s WASM_BIGINT -s ASYNCIFY_STACK_SIZE=65536 -s ASYNCIFY=1 -s ALLOW_MEMORY_GROWTH \
    -s EXPORTED_FUNCTIONS="[ '_malloc', '_free', 'FS', 'cwrap', 'UTF8ToString']" \
    -s EXPORTED_RUNTIME_METHODS=FS,MEMFS,WORKERFS,HEAP8,HEAPU8,HEAP32,HEAP64 \
    $(pkg-config --libs --cflags openslide glib-2.0) \
      ../openslide-wasm/openslide-api.c -o ../openslide-wasm/src/lib.js) || { echo 'openslide-wasm build failed'; exit 1; }