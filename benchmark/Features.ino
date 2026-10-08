#include <Arduino.h>
#include <FastLED.h>

// Representative feature mix that still fits an Arduino Uno: two controllers
// (clockless + hardware SPI), color correction, power limiting, palettes,
// noise, beat waves, fading, blurring and timed updates.

#define NUM_STRIP 30
#define NUM_SPI 8

CRGB strip[NUM_STRIP];
CRGB spi[NUM_SPI];
CRGBPalette16 palette = PartyColors_p;
uint8_t hue = 0;

void setup() {
    FastLED.addLeds<WS2812B, 3, GRB>(strip, NUM_STRIP)
        .setCorrection(TypicalLEDStrip);
    FastLED.addLeds<APA102, MOSI, SCK, BGR>(spi, NUM_SPI);
    FastLED.setBrightness(128);
    FastLED.setMaxPowerInVoltsAndMilliamps(5, 500);
}

void loop() {
    EVERY_N_MILLISECONDS(20) { hue++; }
    fadeToBlackBy(strip, NUM_STRIP, 32);
    uint8_t pos = beatsin8(13, 0, NUM_STRIP - 1);
    strip[pos] += ColorFromPalette(palette, hue, 255, LINEARBLEND);
    blur1d(strip, NUM_STRIP, 64);
    for (uint8_t i = 0; i < NUM_SPI; i++) {
        uint8_t level = inoise8(i * 40, millis() / 8);
        spi[i] = CHSV(hue + i * 8, 255, level);
    }
    FastLED.show();
}
