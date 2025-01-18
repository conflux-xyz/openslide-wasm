if [ -z "$EMSCRIPTEN_PATH" ]; then
  export EMSCRIPTEN_PATH=/emsdk/emsdk_env.sh
fi

if [ -z "$SOURCE_HOME" ]; then
  export SOURCE_HOME=/src
fi

source ${EMSCRIPTEN_PATH}
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

cd ${DEPS_DIRECTORY}

# Build zlib
if [ ! -f "$PKG_CONFIG_LIBDIR/libz.a" ]; then
cd ${DEPS_DIRECTORY}/zlib
(emconfigure ./configure --static --prefix=${BUILD_DIRECTORY} && \
    emmake make  && \
    emmake make install) || { echo 'zlib build failed'; exit 1; }
else
echo 'zlib found. Skipping build.';
fi

# Build libpng
if [ ! -f "$PKG_CONFIG_LIBDIR/libpng16.a" ]; then
cd ${DEPS_DIRECTORY}/libpng
autoreconf -fiv
emconfigure ./configure --host=${CHOST} --prefix=${BUILD_DIRECTORY} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread'
emmake make clean && \
emcmake cmake -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} -DPNG_STATIC=ON -DPNG_SHARED=OFF -DPNG_TESTS=OFF -s USE_PTHREADS=1 -pthread
emmake make install
else
echo 'libpng found. Skipping build.';
fi


# Build libjpeg
if [ ! -f "$PKG_CONFIG_LIBDIR/libjpeg.a" ]; then
cd ${DEPS_DIRECTORY}/libjpeg-turbo
(emcmake cmake . -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} && \
emmake make && \
emmake make install) || { echo 'lib-jpeg-turbo build failed'; exit 1; }
else
echo 'libjpeg found. Skipping build.';
fi

# Build zstd
if [ ! -f "$PKG_CONFIG_LIBDIR/libzstd.a" ]; then
cd ${DEPS_DIRECTORY}/zstd/build/meson
(CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="-lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release && \
    meson install -C _build) || { echo 'zstd build failed'; exit 1; }
else
echo 'libzstd found. Skipping build.';
fi

# Build libffi
if [ ! -f "$PKG_CONFIG_LIBDIR/libffi.a" ]; then
cd ${DEPS_DIRECTORY}/libffi
(./autogen.sh && \
    emconfigure ./configure --host=${CHOST} CFLAGS='-s USE_PTHREADS=1 -pthread' --prefix=${BUILD_DIRECTORY} --enable-static --disable-shared --disable-dependency-tracking --disable-builddir --disable-multi-os-directory --disable-raw-api --disable-structs --disable-docs && \
    emmake make && \
    emmake make install SUBDIRS='include') || { echo 'libffi build failed'; exit 1; }
else
echo 'libffi found. Skipping build.';
fi

# Build glib
if [ ! -f "$PKG_CONFIG_LIBDIR/libglib-2.0.a" ]; then
cd ${DEPS_DIRECTORY}/glib
(CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread' meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release \
  --force-fallback-for=pcre2,gvdb -Dselinux=disabled -Dxattr=false -Dlibmount=disabled -Dnls=disabled \
  -Dtests=false  -Dglib_assert=false -Dglib_checks=false && \
    meson install -C _build) || { echo 'glib build failed'; exit 1; }
else
echo 'glib found. Skipping build.';
fi

# Build pixman
if [ ! -f "$PKG_CONFIG_LIBDIR/libpixman-1.a" ]; then
cd ${DEPS_DIRECTORY}/pixman
wget https://cairographics.org/releases/pixman-0.42.2.tar.gz
tar -xvzf pixman-0.42.2.tar.gz
cd pixman-0.42.2
(CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="-lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build) || { echo 'pixman build failed'; exit 1; }
else
echo 'pixman found. Skipping build.';
fi

# Build freetype
if [ ! -f "$PKG_CONFIG_LIBDIR/libfreetype.a" ]; then
cd ${DEPS_DIRECTORY}/freetype

(CFLAGS="-s USE_PTHREADS=1 -pthread $(pkgconfig --cflags pixman)" LDFLAGS="-s USE_PTHREADS=1  -lpthread $(pkgconfig --cflags pixman)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build) || { echo 'freetype build failed'; exit 1; }
else
echo 'freetype found. Skipping build.';
fi

# Build libexpat
if [ ! -f "$PKG_CONFIG_LIBDIR/libexpat.a" ]; then
cd ${DEPS_DIRECTORY}/libexpat/expat
(./buildconf.sh &&
    emconfigure ./configure --without-docbook --host=${CHOST} --prefix=${BUILD_DIRECTORY} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread' && \
    emmake make && \
    emmake make install) || { echo 'liexpat build failed'; exit 1; }
else
echo 'libexpat found. Skipping build.';
fi

# Build fontconfig
if [ ! -f "$PKG_CONFIG_LIBDIR/libfontconfig.a" ]; then
cd ${DEPS_DIRECTORY}/fontconfig

(CFLAGS="-s USE_PTHREADS=1 -pthread $(pkgconfig --cflags pixman)" LDFLAGS="-s USE_PTHREADS=1  -lpthread $(pkgconfig --cflags pixman)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtools=disabled -Dtests=disabled && \
    meson install -C _build) || { echo 'fontconfig build failed'; exit 1; }
else
echo 'libfontconfig found. Skipping build.';
fi

# Build Cairo
if [ ! -f "$PKG_CONFIG_LIBDIR/libcairo.a" ]; then
cd ${DEPS_DIRECTORY}/cairo
(CFLAGS="$(pkg-config --cflags pixman freetype2, fontconfig, expat) -s USE_PTHREADS=1 -pthread" LDFLAGS="$(pkg-config --libs pixman libpng freetype2, fontconfig, expat) -lpthread  -s USE_PTHREADS=1 -pthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build) || { echo 'cairo build failed'; exit 1; }
else
echo 'cairo found. Skipping build.';
fi

# Build openjpeg
if [ ! -f "$PKG_CONFIG_LIBDIR/libopenjp2.a" ]; then
cd ${DEPS_DIRECTORY}/openjpeg
(emcmake cmake . -DCFLAGS="-s USE_PTHREADS=1 -pthread"  -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} &&\
emmake make install) || { echo 'openjpeg build failed'; exit 1; }
else
echo 'openjpeg found. Skipping build.';
fi

# Build libxml2
if [ ! -f "$PKG_CONFIG_LIBDIR/libxml2.a" ]; then
cd ${DEPS_DIRECTORY}/libxml2
(CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="  -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} -Dpython=disabled --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="-s USE_PTHREADS=1 -pthread " LDFLAGS="-lpthread" meson install -C _build) || { echo 'libxml2 build failed'; exit 1; }
else
echo 'libxml2 found. Skipping build.';
fi

# Build gdk-pixbuf
if [ ! -f "$PKG_CONFIG_LIBDIR/libgdk_pixbuf-2.0.a" ]; then
cd ${DEPS_DIRECTORY}/gdk-pixbuf
(CFLAGS="$(pkgconfig --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0) -s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS="$(pkgconfig --cflags libzstd libpng libtiff-4 libopenjp2 glib-2.0) -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS -Dgio_sniffing=false -Ddocs=false -Dtests=false --default-library=static --buildtype=release  && \
    CFLAGS="$(pkgconfig --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0) -s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS="$(pkgconfig --cflags libzstd libpng libtiff-4 libopenjp2 glib-2.0) -lpthread" meson install -C _build) || { echo 'gdk-pixbuf build failed'; exit 1; }
else
echo 'gdk-pixbuf found. Skipping build.';
fi

# Build sqlite3
if [ ! -f "$PKG_CONFIG_LIBDIR/libsqlite3.a" ]; then
cd ${DEPS_DIRECTORY}/sqlite
(CFLAGS="-s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS=" -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="-s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS=" -lpthread" meson install -C _build) || { echo 'sqlite3 build failed'; exit 1; }
else
echo 'sqlite3 found. Skipping build.';
fi

# Build libtiff
if [ ! -f "$PKG_CONFIG_LIBDIR/libtiff.a" ]; then
cd ${DEPS_DIRECTORY}/libtiff
(CFLAGS="-s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS=" -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="-s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS=" -lpthread" meson install -C _build) || { echo 'libtiff build failed'; exit 1; }
else
echo 'libtiff found. Skipping build.';
fi

# Build openslide
if [ ! -f "$PKG_CONFIG_LIBDIR/libopenslide.a" ]; then
cd ${DEPS_DIRECTORY}/openslide
(CFLAGS="-s USE_LIBJPEG=1 -s USE_ZLIB=1 $(pkgconfig --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0, cairo) -s USE_PTHREADS" LDFLAGS="-s USE_LIBJPEG=1  $(pkgconfig --libs glib-2.0, cairo) -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="$(pkgconfig --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0, cairo) -s USE_PTHREADS -s USE_LIBJPEG=1 " LDFLAGS="$(pkgconfig --libs glib-2.0, cairo) -lpthread" meson install -C _build) || { echo 'openslide build failed'; exit 1; }
else
echo 'openslide found. Skipping build.';
fi
# Build openslide wasm
cd ${DEPS_DIRECTORY}
(emcc -s FORCE_FILESYSTEM -s EXPORTED_FUNCTIONS="[ '_malloc', 'FS_open']" -s USE_LIBPNG=1 $(pkg-config --libs --cflags openslide glib-2.0) \
      ../src/api.c -o api.html) || { echo 'openslide-wasm build failed'; exit 1; }

cp ${DEPS_DIRECTORY}/api.wasm /src/dist/api.wasm
cp ${DEPS_DIRECTORY}/api.js /src/dist/api.js