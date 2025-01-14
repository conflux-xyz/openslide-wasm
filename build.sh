source /emsdk/emsdk_env.sh
alias pkgconfig=pkg-config
export SOURCE_HOME=/src
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

mkdir ${BUILD_DIRECTORY}

# Build zlib
cd ${DEPS_DIRECTORY}/zlib
emconfigure ./configure --static --prefix=${BUILD_DIRECTORY} && \
    emmake make  && \
    emmake make install

# Build libjpeg
cd ${DEPS_DIRECTORY}/libjpeg-turbo
autoreconf -fiv
emconfigure ./configure --host=${CHOST} --prefix=${BUILD_DIRECTORY} CFLAGS='-s USE_PTHREADS=1 -pthread'  --enable-static --disable-shared --disable-dependency-tracking --disable-builddir --disable-multi-os-directory --disable-raw-api --disable-structs --disable-docs
emcmake cmake . -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} 
emmake make install

# Build zstd
cd ${DEPS_DIRECTORY}/zstd/build/meson
CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="-lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release && \
    meson install -C _build

# Build libffi
cd ${DEPS_DIRECTORY}/libffi
./autogen.sh && \
    emconfigure ./configure --host=${CHOST} CFLAGS='-s USE_PTHREADS=1 -pthread' --prefix=${BUILD_DIRECTORY} --enable-static --disable-shared --disable-dependency-tracking --disable-builddir --disable-multi-os-directory --disable-raw-api --disable-structs --disable-docs && \
    emmake make && \
    emmake make install SUBDIRS='include'

# Build glib
cd ${DEPS_DIRECTORY}/glib

CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread' meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release \
  --force-fallback-for=pcre2,gvdb -Dselinux=disabled -Dxattr=false -Dlibmount=disabled -Dnls=disabled \
  -Dtests=false  -Dglib_assert=false -Dglib_checks=false && \
    meson install -C _build

# Build libpng
cd ${DEPS_DIRECTORY}/libpng
mkdir build
autoreconf -fiv
emconfigure ./configure --host=${CHOST} --prefix=${BUILD_DIRECTORY} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread'
emmake make clean && \
emcmake cmake -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} -DPNG_STATIC=ON -DPNG_SHARED=OFF -DPNG_TESTS=OFF -s USE_PTHREADS=1 -pthread
emmake make install

# Build pixman
cd ${DEPS_DIRECTORY}/pixman
wget https://cairographics.org/releases/pixman-0.42.2.tar.gz
tar -xvzf pixman-0.42.2.tar.gz
cd pixman-0.42.2

CFLAGS="-s USE_PTHREADS=1 -pthread $(pkg-config --cflags libpng)" LDFLAGS="-lpthread $(pkg-config --cflags libpng)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build

# Build freetype
cd ${DEPS_DIRECTORY}/freetype

CFLAGS="-s USE_PTHREADS=1 -pthread $(pkgconfig --cflags libpng, pixman)" LDFLAGS="-s USE_PTHREADS=1  -lpthread $(pkgconfig --cflags libpng, pixman)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build

# Build libexpat
cd ${DEPS_DIRECTORY}/libexpat/expat

./buildconf.sh &&
    emconfigure ./configure --without-docbook --host=${CHOST} --prefix=${BUILD_DIRECTORY} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread' && \
    emmake make && \
    emmake make install

# Build fontconfig
cd ${DEPS_DIRECTORY}/fontconfig

CFLAGS="-s USE_PTHREADS=1 -pthread $(pkgconfig --cflags libpng, pixman)" LDFLAGS="-s USE_PTHREADS=1  -lpthread $(pkgconfig --cflags libpng, pixman)" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtools=disabled -Dtests=disabled && \
    meson install -C _build

# Build Ciaro
cd ${DEPS_DIRECTORY}/cairo

CFLAGS="$(pkg-config --cflags libpng freetype2, fontconfig, expat) -s USE_PTHREADS=1 -pthread" LDFLAGS="$(pkg-config --libs libpng freetype2, fontconfig, expat) -lpthread  -s USE_PTHREADS=1 -pthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
    meson install -C _build


# Build openjpeg
cd ${DEPS_DIRECTORY}/openjpeg
emcmake cmake . -DCFLAGS="-s USE_PTHREADS=1 -pthread"  -DCMAKE_INSTALL_PREFIX=${BUILD_DIRECTORY} &&\
emmake make install

# Build libxml2
cd ${DEPS_DIRECTORY}/libxml2
CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="  -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} -Dpython=disabled --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="-s USE_PTHREADS=1 -pthread " LDFLAGS="-lpthread" meson install -C _build

# Build gdk-pixbuf
cd ${DEPS_DIRECTORY}/gdk-pixbuf
CFLAGS="$(pkgconfig --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0) -s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS="$(pkgconfig --cflags libzstd libpng libtiff-4 libopenjp2 glib-2.0) -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS -Dgio_sniffing=false -Ddocs=false -Dtests=false --default-library=static --buildtype=release  && \
    CFLAGS="$(pkgconfig --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0) -s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS="$(pkgconfig --cflags libzstd libpng libtiff-4 libopenjp2 glib-2.0) -lpthread" meson install -C _build

# Build sqlite3
cd ${DEPS_DIRECTORY}/sqlite
CFLAGS="-s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS=" -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="-s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS=" -lpthread" meson install -C _build

# Build libtiff
cd ${DEPS_DIRECTORY}/libtiff
CFLAGS="-s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS=" -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="-s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS=" -lpthread" meson install -C _build

# Build openslide
cd ${DEPS_DIRECTORY}/openslide
CFLAGS="-s USE_LIBJPEG=1 -s USE_ZLIB=1 $(pkgconfig --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0, cairo) -s USE_PTHREADS" LDFLAGS="-s USE_LIBJPEG=1  $(pkgconfig --libs glib-2.0, cairo) -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${BUILD_DIRECTORY} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
    CFLAGS="$(pkgconfig --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0, cairo) -s USE_PTHREADS -s USE_LIBJPEG=1 " LDFLAGS="$(pkgconfig --libs glib-2.0, cairo) -lpthread" meson install -C _build

# Build openslide wasm
cd ${DEPS_DIRECTORY}
emcc  --preload-file  ../src/sample.svs@sample.svs \
      $(pkg-config --libs --cflags openslide glib-2.0) \
      ../src/api.c -o api.html