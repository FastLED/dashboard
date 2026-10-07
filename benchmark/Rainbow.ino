#include <Arduino.h>
#include <FastLED.h>

CRGB leds[16];
uint8_t hue = 0;

void setup() {
    FastLED.addLeds<NEOPIXEL, 3>(leds, 16);
}

void loop() {
    fill_rainbow(leds, 16, hue++, 16);
    FastLED.show();
    delay(20);
}
