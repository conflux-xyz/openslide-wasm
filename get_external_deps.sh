export DEPENDENCIES_DIR=external
export SOURCE_HOME=$(pwd)/${DEPENDENCIES_DIR}

mkdir ${DEPENDENCIES_DIR}

# zlib
cd ${SOURCE_HOME}
git clone  --depth 1 --branch v1.2.13 https://github.com/madler/zlib.git

# libjpeg-turbo
cd ${SOURCE_HOME}
git clone git@github.com:libjpeg-turbo/libjpeg-turbo.git
cd libjpeg-turbo
git checkout e0e18de

# zstd
cd ${SOURCE_HOME}
git clone https://github.com/facebook/zstd.git
cd zstd
git checkout 80af41e
cd zstd/build/meson

# libffi
cd ${SOURCE_HOME}
git clone --depth 1 https://github.com/libffi/libffi.git
cd libffi
git checkout ac598b7

# glib
cd ${SOURCE_HOME}
git clone --depth 1 --branch wasm-calm-2.76.1 https://github.com/VitoVan/glib.git
cd glib
git apply ${SOURCE_HOME}/../patches/glib.patch

# libpng
cd ${SOURCE_HOME}
git clone https://github.com/emscripten-ports/libpng.git
cd libpng
git checkout 918d23f
 
# pixman
cd ${SOURCE_HOME}
mkdir pixman
cd pixman
wget https://cairographics.org/releases/pixman-0.42.2.tar.gz
tar -xvzf pixman-0.42.2.tar.gz

# freetype
cd ${SOURCE_HOME}
git clone  --depth 1 --branch VER-2-13-0 https://gitlab.freedesktop.org/freetype/freetype.git

# libexpat
cd ${SOURCE_HOME}
git clone  --depth 1 --branch R_2_5_0 https://github.com/libexpat/libexpat.git

# fontconfig
cd ${SOURCE_HOME}
git clone  --depth 1 --branch 2.14.2 https://gitlab.freedesktop.org/fontconfig/fontconfig.git
cd fontconfig
git apply ${SOURCE_HOME}/../patches/fontconfig.patch

# cairo
cd ${SOURCE_HOME}
git clone --depth 1 --branch 1.17.8 https://gitlab.freedesktop.org/cairo/cairo.git
git apply ${SOURCE_HOME}/../patches/cairo.patch

# openjpeg
cd ${SOURCE_HOME}
git clone https://github.com/uclouvain/openjpeg.git
cd openjpeg
git checkout 2d60670

# libxml2
cd ${SOURCE_HOME}
git clone https://gitlab.gnome.org/GNOME/libxml2.git
cd libxml2
git checkout 86401cc3d293d6ea3c4552885e3cadcd952021d1

# gdk-pixbuf
cd ${SOURCE_HOME}
git clone git@github.com:GNOME/gdk-pixbuf.git
cd gdk-pixbuf
git checkout e4315fb
git apply ${SOURCE_HOME}/../patches/gdk-pixbuf.patch

# sqlite
cd ${SOURCE_HOME}
git clone https://github.com/frida/sqlite
cd sqlite
git checkout 9337327
 
# libtiff
cd ${SOURCE_HOME}
wget https://download.osgeo.org/libtiff/tiff-4.7.0.tar.xz
tar -xf tiff-4.7.0.tar.xz
mv tiff-4.7.0 libtiff
cd libtiff
wget https://wrapdb.mesonbuild.com/v2/libtiff_4.7.0-1/get_patch -O patch.zip
unzip patch.zip
cp -r tiff-4.7.0/ .

# openslide
cd ${SOURCE_HOME}
git clone https://github.com/openslide/openslide
cd openslide
git checkout c592799
git apply ${SOURCE_HOME}/../patches/openslide.patch
