#include <stdio.h>
#include <openslide/openslide.h>

int main() {
  openslide_t * img = openslide_open("sample.svs");
    int32_t level_count = openslide_get_level_count(img);
    printf("Number of levels: %d\n", level_count);

    // Print dimensions for each level
    for (int32_t level = 0; level < level_count; level++) {
        int64_t width, height;
        openslide_get_level_dimensions(img, level, &width, &height);
        printf("Level %d: Width = %ld, Height = %ld\n", level, width, height);
    }

    printf("\nNamed Properties:\n");
    const char * const *property_names = openslide_get_property_names(img);
    if (property_names) {
        for (const char * const *name = property_names; *name != NULL; name++) {
            const char *value = openslide_get_property_value(img, *name);
            printf("  %s: %s\n", *name, value);
        }
    } else {
        printf("No properties found.\n");
    }

}