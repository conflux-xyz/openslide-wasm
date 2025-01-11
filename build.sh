source ~/src/emsdk/emsdk_env.sh
alias pkgconfig=pkg-config
export SOURCE_HOME=~/src/new/openslide
export MAKEFLAGS="-j$(nproc)"
export magicdir=${SOURCE_HOME}/magic
export magicprefix=${magicdir}/build
export EM_PKG_CONFIG_PATH=${magicprefix}/lib/pkgconfig/
export PKG_CONFIG_PATH=${magicprefix}/lib/pkgconfig/
export EM_PKG_CONFIG_LIBDIR=${magicprefix}/lib/
export PKG_CONFIG_LIBDIR=${magicprefix}/lib/
export CHOST="wasm32-unknown-linux"
export ax_cv_c_float_words_bigendian=no
export LIBTOOLIZE=/opt/homebrew/bin/glibtoolize
export MESON_CROSS=~/src/new/openslide/emscripten-crossfile.meson


mkdir ${magicdir}
mkdir ${magicprefix}

# rm -rf build

# cd ${magicdir}
# git clone  --depth 1 --branch v1.2.13 https://github.com/madler/zlib.git
# cd ${magicdir}/zlib


# emconfigure ./configure --static --prefix=${magicprefix} && \
#     emmake make  && \
#     emmake make install

# cd ${magicdir}
# git clone git@github.com:libjpeg-turbo/libjpeg-turbo.git
# cd ${magicdir}/libjpeg-turbo
# autoreconf -fiv
# emconfigure ./configure --host=${CHOST} --prefix=${magicprefix} CFLAGS='-s USE_PTHREADS=1 -pthread'  --enable-static --disable-shared --disable-dependency-tracking --disable-builddir --disable-multi-os-directory --disable-raw-api --disable-structs --disable-docs
# emcmake cmake . -DCMAKE_INSTALL_PREFIX=${magicprefix} 
# emmake make install

# cd ${magicdir}
# git clone https://github.com/facebook/zstd.git
# cd ${magicdir}/zstd/build/meson
# CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="-lpthread" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release && \
#     meson install -C _build


# cd ${magicdir}
# git clone --depth 1 https://github.com/libffi/libffi.git
# cd ${magicdir}/libffi
# git checkout ac598b7

# ./autogen.sh && \
#     emconfigure ./configure --host=${CHOST} CFLAGS='-s USE_PTHREADS=1 -pthread' --prefix=${magicprefix} --enable-static --disable-shared --disable-dependency-tracking --disable-builddir --disable-multi-os-directory --disable-raw-api --disable-structs --disable-docs && \
#     emmake make && \
#     emmake make install SUBDIRS='include'

# cd ${magicdir}
# git clone --depth 1 --branch wasm-calm-2.76.1 https://github.com/VitoVan/glib.git
# cd ${magicdir}/glib

# CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread' meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release \
#   --force-fallback-for=pcre2,gvdb -Dselinux=disabled -Dxattr=false -Dlibmount=disabled -Dnls=disabled \
#   -Dtests=false  -Dglib_assert=false -Dglib_checks=false && \
#     meson install -C _build


# cd ${magicdir}
# git clone https://github.com/emscripten-ports/libpng.git
# cd ${magicdir}/libpng
# mkdir build
# autoreconf -fiv
# emconfigure ./configure --host=${CHOST} --prefix=${magicprefix} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread'
# emmake make clean && \
# emcmake cmake -DCMAKE_INSTALL_PREFIX=${magicprefix} -DPNG_STATIC=ON -DPNG_SHARED=OFF -DPNG_TESTS=OFF -s USE_PTHREADS=1 -pthread
# emmake make install


# cd ${magicdir}
# mkdir pixman
# cd ${magicdir}/pixman
# wget https://cairographics.org/releases/pixman-0.42.2.tar.gz
# tar -xvzf pixman-0.42.2.tar.gz
# cd pixman-0.42.2

# CFLAGS="-s USE_PTHREADS=1 -pthread $(pkg-config --cflags libpng)" LDFLAGS="-lpthread $(pkg-config --cflags libpng)" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
#     meson install -C _build

# cd ${magicdir}
# git clone  --depth 1 --branch VER-2-13-0 https://gitlab.freedesktop.org/freetype/freetype.git
# cd ${magicdir}/freetype

# CFLAGS="-s USE_PTHREADS=1 -pthread $(pkgconfig --cflags libpng, pixman)" LDFLAGS="-s USE_PTHREADS=1  -lpthread $(pkgconfig --cflags libpng, pixman)" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
#     meson install -C _build

# cd ${magicdir}
# git clone  --depth 1 --branch R_2_5_0 https://github.com/libexpat/libexpat.git
# cd ${magicdir}/libexpat/expat

# ./buildconf.sh &&
#     emconfigure ./configure --without-docbook --host=${CHOST} --prefix=${magicprefix} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-lpthread' && \
#     emmake make && \
#     emmake make install

# cd ${magicdir}
# git clone  --depth 1 --branch 2.14.2 https://gitlab.freedesktop.org/fontconfig/fontconfig.git
# cd ${magicdir}/fontconfig

# CFLAGS="-s USE_PTHREADS=1 -pthread $(pkgconfig --cflags libpng, pixman)" LDFLAGS="-s USE_PTHREADS=1  -lpthread $(pkgconfig --cflags libpng, pixman)" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtools=disabled -Dtests=disabled && \
#     meson install -C _build

# cd ${magicdir}
# git clone --depth 1 --branch 1.17.8 https://gitlab.freedesktop.org/cairo/cairo.git
# cd ${magicdir}/cairo

# CFLAGS="$(pkg-config --cflags libpng freetype2, fontconfig, expat) -s USE_PTHREADS=1 -pthread" LDFLAGS="$(pkg-config --libs libpng freetype2, fontconfig, expat) -lpthread  -s USE_PTHREADS=1 -pthread" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release -Dtests=disabled && \
#     meson install -C _build


# cd ${magicdir}
# git clone https://github.com/uclouvain/openjpeg.git
# cd ${magicdir}/openjpeg
# emcmake cmake . -DCFLAGS="-s USE_PTHREADS=1 -pthread"  -DCMAKE_INSTALL_PREFIX=${magicprefix} &&\
# emmake make install


# cd ${magicdir}
# git clone https://github.com/libsdl-org/libtiff.git
# cd ${magicdir}/libtiff
# autoreconf -fiv
# emconfigure ./configure CXXFLAGS="-s USE_PTHREADS=1 -pthread" --host=${CHOST} --prefix=${magicprefix} --enable-shared=no --disable-dependency-tracking CFLAGS='-s USE_PTHREADS=1 -pthread' LDFLAGS='-s USE_PTHREADS=1 -pthread -lpthread' &&\
# emcmake cmake . -DCXXFLAGS="-s USE_PTHREADS=1 -pthread" -DCFLAGS="-s USE_PTHREADS=1 -pthread" -DCMAKE_INSTALL_PREFIX=${magicprefix} &&\
# emmake make install

# cd ${magicdir}
# git clone https://gitlab.gnome.org/GNOME/libxml2.git
# cd ${magicdir}/libxml2
# CFLAGS="-s USE_PTHREADS=1 -pthread" LDFLAGS="  -lpthread" meson setup _build --prefix=${magicprefix} -Dpython=disabled --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
#     CFLAGS="-s USE_PTHREADS=1 -pthread " LDFLAGS="-lpthread" meson install -C _build

# cd ${magicdir}
# git clone git@github.com:GNOME/gdk-pixbuf.git
# cd ${magicdir}/gdk-pixbuf
# git checkout e4315fb
# CFLAGS="$(pkgconfig --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0) -s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS="$(pkgconfig --cflags libzstd libpng libtiff-4 libopenjp2 glib-2.0) -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS -Dgio_sniffing=false -Ddocs=false -Dtests=false --default-library=static --buildtype=release  && \
#     CFLAGS="$(pkgconfig --cflags libpng libzstd libtiff-4 libopenjp2 glib-2.0) -s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS="$(pkgconfig --cflags libzstd libpng libtiff-4 libopenjp2 glib-2.0) -lpthread" meson install -C _build


# cd ${magicdir}
# git clone https://github.com/frida/sqlite
# cd ${magicdir}/sqlite
# CFLAGS="-s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS=" -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
#     CFLAGS="-s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS=" -lpthread" meson install -C _build


# cd ${magicdir}/libtiff
# CFLAGS="-s USE_LIBJPEG=1 -s USE_PTHREADS=1 -pthread" LDFLAGS=" -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
#     CFLAGS="-s USE_PTHREADS=1 -pthread -s USE_LIBJPEG=1 " LDFLAGS=" -lpthread" meson install -C _build


# cd ${magicdir}
# git clone https://github.com/openslide/openslide
# cd ${magicdir}/openslide
# CFLAGS="-s USE_LIBJPEG=1 -s USE_ZLIB=1 $(pkgconfig --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0, cairo) -s USE_PTHREADS" LDFLAGS="-s USE_LIBJPEG=1  $(pkgconfig --libs glib-2.0, cairo) -s USE_LIBJPEG=1 -lpthread" meson setup _build --prefix=${magicprefix} --cross-file=$MESON_CROSS --default-library=static --buildtype=release  && \
#     CFLAGS="$(pkgconfig --cflags sqlite3 gdk-pixbuf-2.0 libtiff-4 libopenjp2 glib-2.0, cairo) -s USE_PTHREADS -s USE_LIBJPEG=1 " LDFLAGS="$(pkgconfig --libs glib-2.0, cairo) -lpthread" meson install -C _build


cd ${magicdir}
emcc  --preload-file  ../sample.svs@sample.svs \
      $(pkg-config --libs --cflags openslide glib-2.0) \
      ../hello-conflux.c -o hello-conflux.html