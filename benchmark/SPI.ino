#include <Arduino.h>
#include <FastLED.h>

CRGB leds[1];

void setup() {
    FastLED.addLeds<APA102, MOSI, SCK, RGB>(leds, 1);
}

void loop() {
    leds[0] = CRGB::Red;
    FastLED.show();
    delay(1000);
    leds[0] = CRGB::Black;
    FastLED.show();
    delay(1000);
}
