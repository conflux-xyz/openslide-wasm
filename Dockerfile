FROM emscripten/emsdk
RUN apt-get update -y
RUN apt-get install -y autoconf automake zlib1g-dev libtool libglib2.0-dev-bin pkg-config python3 python3-pip python3-setuptools python3-wheel ninja-build
RUN pip3 install meson