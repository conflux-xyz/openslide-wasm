#include <stdio.h>
#include <openslide/openslide.h>
#include <emscripten/emscripten.h>

EMSCRIPTEN_KEEPALIVE
char* load_image(const char* path) {
    openslide_t * img = openslide_open("sample.svs");
    return (char*) img;
}

EMSCRIPTEN_KEEPALIVE
char * close_image(char * ptr) {
    openslide_close((openslide_t*) ptr);
}

EMSCRIPTEN_KEEPALIVE
int32_t get_level_count(char* ptr) {
  return openslide_get_level_count((openslide_t*)ptr);
}

EMSCRIPTEN_KEEPALIVE
double get_level_downsample(char* ptr, int32_t level) {
    return openslide_get_level_downsample((openslide_t*)ptr, level);
}

EMSCRIPTEN_KEEPALIVE
int64_t get_icc_profile_size(openslide_t *ptr) {
    return openslide_get_icc_profile_size((openslide_t*)ptr);
}

EMSCRIPTEN_KEEPALIVE
void read_icc_profile(openslide_t *ptr, void *dest) {
    return openslide_read_icc_profile((openslide_t*)ptr, dest);
}


EMSCRIPTEN_KEEPALIVE
double get_best_level_for_downsample(char* ptr, int32_t downsample) {
    return openslide_get_best_level_for_downsample((openslide_t*)ptr, downsample);
}

EMSCRIPTEN_KEEPALIVE
int64_t* get_level_dimensions(char* ptr, int32_t level) {
  int64_t* array = (int64_t*) malloc(2 * sizeof(int64_t));
  openslide_get_level_dimensions((openslide_t*)ptr, level, array, array + 1);
  return array;
}

EMSCRIPTEN_KEEPALIVE
void free_result(char* ptr) {
    free(ptr);
}

EMSCRIPTEN_KEEPALIVE
char* read_region(char *ptr, int64_t x, int64_t y, int32_t level, int64_t w, int64_t h) {
    char *buffer = malloc(w * h * 4);
    openslide_read_region((openslide_t*)ptr, buffer, x, y, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    return buffer;
}


int main() {


    
    openslide_t * img = openslide_open("sample.svs");
    int PREVIEW_SIZE = 512;
    uint32_t* buffer = malloc(sizeof(uint32_t) * PREVIEW_SIZE * PREVIEW_SIZE);
    openslide_read_region(img, buffer, 4000, 4000, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    for(int j = 0; j < PREVIEW_SIZE; j++) {
      for(int i = 0; i < PREVIEW_SIZE; i++) {
        uint32_t color = buffer[i + j * PREVIEW_SIZE];
        unsigned char* rgba = (unsigned char*)(&color);
      }
    }

}