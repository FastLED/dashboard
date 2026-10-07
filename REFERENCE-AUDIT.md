# Symbol-reference audit

fbuild 2.5.37; saved benchmark ELFs reanalyzed with explicit cross-toolchain tools.
Memory totals, symbol sizes and ELF digests were verified unchanged.
Unexplained means no recorded symbol/object reference and not the ELF entry point; it is a review candidate, not proof of dead code.

Across 96 profiles: 41,645 unexplained live-row occurrences; 10,620 unresolved-name occurrences; 0 unavailable/failed analyses.

Tracking: [dashboard #18](https://github.com/FastLED/dashboard/issues/18), [fbuild #1659](https://github.com/FastLED/fbuild/issues/1659), [#1660](https://github.com/FastLED/fbuild/issues/1660), [#1661](https://github.com/FastLED/fbuild/issues/1661).

| Sketch | Platform | Version | Unexplained live rows | Missing graph names | Audit |
|---|---|---|---:|---:|---|
| blink | uno | 3.10.0 | 23 | 10 | [JSON](docs/data/reports/uno/971beb60288dc45009d502a4bec48f8d839d40b5-a9bb0d42758b-references.json) |
| blink | uno | 3.10.1 | 23 | 10 | [JSON](docs/data/reports/uno/dec101a1268e013ef42deee644ff58883179d61a-a9bb0d42758b-references.json) |
| blink | uno | 3.10.2 | 23 | 10 | [JSON](docs/data/reports/uno/3d1f9fe373b295254354f6266030557a497594cf-a9bb0d42758b-references.json) |
| blink | uno | 3.10.3 | 23 | 10 | [JSON](docs/data/reports/uno/20667c3a6413ed46a828f78ec95fb57e58d753f8-a9bb0d42758b-references.json) |
| blink | uno | 3.10.4 | 33 | 11 | [JSON](docs/data/reports/uno/adedfc40e73fb80f8e930318781036d8fe1dbd9f-a9bb0d42758b-references.json) |
| blink | uno | 3.10.5 | 33 | 11 | [JSON](docs/data/reports/uno/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-a9bb0d42758b-references.json) |
| blink | uno | 3.10.6 | 36 | 11 | [JSON](docs/data/reports/uno/ebf8c2823c486158a046d8e1e682d3143580ae4e-a9bb0d42758b-references.json) |
| blink | uno | master | 26 | 11 | [JSON](docs/data/reports/uno/a439902ac6af64e600031c01b5c2ac0df2e690bc-a9bb0d42758b-references.json) |
| blink | esp32s3 | 3.10.0 | 544 | 200 | [JSON](docs/data/reports/esp32s3/971beb60288dc45009d502a4bec48f8d839d40b5-2c2f645d8293-references.json) |
| blink | esp32s3 | 3.10.1 | 544 | 200 | [JSON](docs/data/reports/esp32s3/dec101a1268e013ef42deee644ff58883179d61a-2c2f645d8293-references.json) |
| blink | esp32s3 | 3.10.2 | 546 | 200 | [JSON](docs/data/reports/esp32s3/3d1f9fe373b295254354f6266030557a497594cf-2c2f645d8293-references.json) |
| blink | esp32s3 | 3.10.3 | 546 | 200 | [JSON](docs/data/reports/esp32s3/20667c3a6413ed46a828f78ec95fb57e58d753f8-2c2f645d8293-references.json) |
| blink | esp32s3 | 3.10.4 | 887 | 317 | [JSON](docs/data/reports/esp32s3/adedfc40e73fb80f8e930318781036d8fe1dbd9f-2c2f645d8293-references.json) |
| blink | esp32s3 | 3.10.5 | 887 | 317 | [JSON](docs/data/reports/esp32s3/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-2c2f645d8293-references.json) |
| blink | esp32s3 | 3.10.6 | 713 | 281 | [JSON](docs/data/reports/esp32s3/ebf8c2823c486158a046d8e1e682d3143580ae4e-2c2f645d8293-references.json) |
| blink | esp32s3 | master | 694 | 276 | [JSON](docs/data/reports/esp32s3/a439902ac6af64e600031c01b5c2ac0df2e690bc-2c2f645d8293-references.json) |
| blink | esp32dev | 3.10.0 | 443 | 129 | [JSON](docs/data/reports/esp32dev/971beb60288dc45009d502a4bec48f8d839d40b5-0a53b8e4f9de-references.json) |
| blink | esp32dev | 3.10.1 | 443 | 129 | [JSON](docs/data/reports/esp32dev/dec101a1268e013ef42deee644ff58883179d61a-0a53b8e4f9de-references.json) |
| blink | esp32dev | 3.10.2 | 449 | 130 | [JSON](docs/data/reports/esp32dev/3d1f9fe373b295254354f6266030557a497594cf-0a53b8e4f9de-references.json) |
| blink | esp32dev | 3.10.3 | 449 | 130 | [JSON](docs/data/reports/esp32dev/20667c3a6413ed46a828f78ec95fb57e58d753f8-0a53b8e4f9de-references.json) |
| blink | esp32dev | 3.10.4 | 782 | 245 | [JSON](docs/data/reports/esp32dev/adedfc40e73fb80f8e930318781036d8fe1dbd9f-0a53b8e4f9de-references.json) |
| blink | esp32dev | 3.10.5 | 782 | 245 | [JSON](docs/data/reports/esp32dev/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-0a53b8e4f9de-references.json) |
| blink | esp32dev | 3.10.6 | 589 | 209 | [JSON](docs/data/reports/esp32dev/ebf8c2823c486158a046d8e1e682d3143580ae4e-0a53b8e4f9de-references.json) |
| blink | esp32dev | master | 581 | 207 | [JSON](docs/data/reports/esp32dev/a439902ac6af64e600031c01b5c2ac0df2e690bc-0a53b8e4f9de-references.json) |
| blink | teensy41 | 3.10.0 | 215 | 1 | [JSON](docs/data/reports/teensy41/971beb60288dc45009d502a4bec48f8d839d40b5-72c54c2f8817-references.json) |
| blink | teensy41 | 3.10.1 | 215 | 1 | [JSON](docs/data/reports/teensy41/dec101a1268e013ef42deee644ff58883179d61a-72c54c2f8817-references.json) |
| blink | teensy41 | 3.10.2 | 383 | 1 | [JSON](docs/data/reports/teensy41/3d1f9fe373b295254354f6266030557a497594cf-72c54c2f8817-references.json) |
| blink | teensy41 | 3.10.3 | 383 | 1 | [JSON](docs/data/reports/teensy41/20667c3a6413ed46a828f78ec95fb57e58d753f8-72c54c2f8817-references.json) |
| blink | teensy41 | 3.10.4 | 486 | 1 | [JSON](docs/data/reports/teensy41/adedfc40e73fb80f8e930318781036d8fe1dbd9f-72c54c2f8817-references.json) |
| blink | teensy41 | 3.10.5 | 486 | 1 | [JSON](docs/data/reports/teensy41/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-72c54c2f8817-references.json) |
| blink | teensy41 | 3.10.6 | 435 | 3 | [JSON](docs/data/reports/teensy41/ebf8c2823c486158a046d8e1e682d3143580ae4e-72c54c2f8817-references.json) |
| blink | teensy41 | master | 417 | 2 | [JSON](docs/data/reports/teensy41/a439902ac6af64e600031c01b5c2ac0df2e690bc-72c54c2f8817-references.json) |
| spi | uno | 3.10.0 | 20 | 11 | [JSON](docs/data/reports/uno/971beb60288dc45009d502a4bec48f8d839d40b5-cd7917b867f4-references.json) |
| spi | uno | 3.10.1 | 20 | 11 | [JSON](docs/data/reports/uno/dec101a1268e013ef42deee644ff58883179d61a-cd7917b867f4-references.json) |
| spi | uno | 3.10.2 | 20 | 11 | [JSON](docs/data/reports/uno/3d1f9fe373b295254354f6266030557a497594cf-cd7917b867f4-references.json) |
| spi | uno | 3.10.3 | 20 | 11 | [JSON](docs/data/reports/uno/20667c3a6413ed46a828f78ec95fb57e58d753f8-cd7917b867f4-references.json) |
| spi | uno | 3.10.4 | 30 | 12 | [JSON](docs/data/reports/uno/adedfc40e73fb80f8e930318781036d8fe1dbd9f-cd7917b867f4-references.json) |
| spi | uno | 3.10.5 | 30 | 12 | [JSON](docs/data/reports/uno/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-cd7917b867f4-references.json) |
| spi | uno | 3.10.6 | 33 | 12 | [JSON](docs/data/reports/uno/ebf8c2823c486158a046d8e1e682d3143580ae4e-cd7917b867f4-references.json) |
| spi | uno | master | 23 | 12 | [JSON](docs/data/reports/uno/a439902ac6af64e600031c01b5c2ac0df2e690bc-cd7917b867f4-references.json) |
| spi | esp32s3 | 3.10.0 | 512 | 200 | [JSON](docs/data/reports/esp32s3/971beb60288dc45009d502a4bec48f8d839d40b5-4fa973ae38a5-references.json) |
| spi | esp32s3 | 3.10.1 | 512 | 200 | [JSON](docs/data/reports/esp32s3/dec101a1268e013ef42deee644ff58883179d61a-4fa973ae38a5-references.json) |
| spi | esp32s3 | 3.10.2 | 518 | 200 | [JSON](docs/data/reports/esp32s3/3d1f9fe373b295254354f6266030557a497594cf-4fa973ae38a5-references.json) |
| spi | esp32s3 | 3.10.3 | 518 | 200 | [JSON](docs/data/reports/esp32s3/20667c3a6413ed46a828f78ec95fb57e58d753f8-4fa973ae38a5-references.json) |
| spi | esp32s3 | 3.10.4 | 1365 | 334 | [JSON](docs/data/reports/esp32s3/adedfc40e73fb80f8e930318781036d8fe1dbd9f-4fa973ae38a5-references.json) |
| spi | esp32s3 | 3.10.5 | 1365 | 334 | [JSON](docs/data/reports/esp32s3/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-4fa973ae38a5-references.json) |
| spi | esp32s3 | 3.10.6 | 735 | 277 | [JSON](docs/data/reports/esp32s3/ebf8c2823c486158a046d8e1e682d3143580ae4e-4fa973ae38a5-references.json) |
| spi | esp32s3 | master | 724 | 274 | [JSON](docs/data/reports/esp32s3/a439902ac6af64e600031c01b5c2ac0df2e690bc-4fa973ae38a5-references.json) |
| spi | esp32dev | 3.10.0 | 425 | 127 | [JSON](docs/data/reports/esp32dev/971beb60288dc45009d502a4bec48f8d839d40b5-297d15e9528d-references.json) |
| spi | esp32dev | 3.10.1 | 425 | 127 | [JSON](docs/data/reports/esp32dev/dec101a1268e013ef42deee644ff58883179d61a-297d15e9528d-references.json) |
| spi | esp32dev | 3.10.2 | 429 | 127 | [JSON](docs/data/reports/esp32dev/3d1f9fe373b295254354f6266030557a497594cf-297d15e9528d-references.json) |
| spi | esp32dev | 3.10.3 | 429 | 127 | [JSON](docs/data/reports/esp32dev/20667c3a6413ed46a828f78ec95fb57e58d753f8-297d15e9528d-references.json) |
| spi | esp32dev | 3.10.4 | 960 | 275 | [JSON](docs/data/reports/esp32dev/adedfc40e73fb80f8e930318781036d8fe1dbd9f-297d15e9528d-references.json) |
| spi | esp32dev | 3.10.5 | 960 | 275 | [JSON](docs/data/reports/esp32dev/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-297d15e9528d-references.json) |
| spi | esp32dev | 3.10.6 | 612 | 205 | [JSON](docs/data/reports/esp32dev/ebf8c2823c486158a046d8e1e682d3143580ae4e-297d15e9528d-references.json) |
| spi | esp32dev | master | 607 | 205 | [JSON](docs/data/reports/esp32dev/a439902ac6af64e600031c01b5c2ac0df2e690bc-297d15e9528d-references.json) |
| spi | teensy41 | 3.10.0 | 193 | 1 | [JSON](docs/data/reports/teensy41/971beb60288dc45009d502a4bec48f8d839d40b5-ee0b36e3cdd3-references.json) |
| spi | teensy41 | 3.10.1 | 193 | 1 | [JSON](docs/data/reports/teensy41/dec101a1268e013ef42deee644ff58883179d61a-ee0b36e3cdd3-references.json) |
| spi | teensy41 | 3.10.2 | 348 | 1 | [JSON](docs/data/reports/teensy41/3d1f9fe373b295254354f6266030557a497594cf-ee0b36e3cdd3-references.json) |
| spi | teensy41 | 3.10.3 | 348 | 1 | [JSON](docs/data/reports/teensy41/20667c3a6413ed46a828f78ec95fb57e58d753f8-ee0b36e3cdd3-references.json) |
| spi | teensy41 | 3.10.4 | 1089 | 2 | [JSON](docs/data/reports/teensy41/adedfc40e73fb80f8e930318781036d8fe1dbd9f-ee0b36e3cdd3-references.json) |
| spi | teensy41 | 3.10.5 | 1089 | 2 | [JSON](docs/data/reports/teensy41/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-ee0b36e3cdd3-references.json) |
| spi | teensy41 | 3.10.6 | 427 | 3 | [JSON](docs/data/reports/teensy41/ebf8c2823c486158a046d8e1e682d3143580ae4e-ee0b36e3cdd3-references.json) |
| spi | teensy41 | master | 407 | 2 | [JSON](docs/data/reports/teensy41/a439902ac6af64e600031c01b5c2ac0df2e690bc-ee0b36e3cdd3-references.json) |
| rainbow | uno | 3.10.0 | 24 | 11 | [JSON](docs/data/reports/uno/971beb60288dc45009d502a4bec48f8d839d40b5-f8cec9378d3f-references.json) |
| rainbow | uno | 3.10.1 | 24 | 11 | [JSON](docs/data/reports/uno/dec101a1268e013ef42deee644ff58883179d61a-f8cec9378d3f-references.json) |
| rainbow | uno | 3.10.2 | 24 | 11 | [JSON](docs/data/reports/uno/3d1f9fe373b295254354f6266030557a497594cf-f8cec9378d3f-references.json) |
| rainbow | uno | 3.10.3 | 24 | 11 | [JSON](docs/data/reports/uno/20667c3a6413ed46a828f78ec95fb57e58d753f8-f8cec9378d3f-references.json) |
| rainbow | uno | 3.10.4 | 34 | 12 | [JSON](docs/data/reports/uno/adedfc40e73fb80f8e930318781036d8fe1dbd9f-f8cec9378d3f-references.json) |
| rainbow | uno | 3.10.5 | 34 | 12 | [JSON](docs/data/reports/uno/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-f8cec9378d3f-references.json) |
| rainbow | uno | 3.10.6 | 37 | 12 | [JSON](docs/data/reports/uno/ebf8c2823c486158a046d8e1e682d3143580ae4e-f8cec9378d3f-references.json) |
| rainbow | uno | master | 27 | 12 | [JSON](docs/data/reports/uno/a439902ac6af64e600031c01b5c2ac0df2e690bc-f8cec9378d3f-references.json) |
| rainbow | esp32s3 | 3.10.0 | 541 | 200 | [JSON](docs/data/reports/esp32s3/971beb60288dc45009d502a4bec48f8d839d40b5-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | 3.10.1 | 541 | 200 | [JSON](docs/data/reports/esp32s3/dec101a1268e013ef42deee644ff58883179d61a-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | 3.10.2 | 548 | 200 | [JSON](docs/data/reports/esp32s3/3d1f9fe373b295254354f6266030557a497594cf-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | 3.10.3 | 548 | 200 | [JSON](docs/data/reports/esp32s3/20667c3a6413ed46a828f78ec95fb57e58d753f8-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | 3.10.4 | 890 | 317 | [JSON](docs/data/reports/esp32s3/adedfc40e73fb80f8e930318781036d8fe1dbd9f-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | 3.10.5 | 890 | 317 | [JSON](docs/data/reports/esp32s3/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | 3.10.6 | 713 | 281 | [JSON](docs/data/reports/esp32s3/ebf8c2823c486158a046d8e1e682d3143580ae4e-6c6a7aa9db79-references.json) |
| rainbow | esp32s3 | master | 693 | 276 | [JSON](docs/data/reports/esp32s3/a439902ac6af64e600031c01b5c2ac0df2e690bc-6c6a7aa9db79-references.json) |
| rainbow | esp32dev | 3.10.0 | 444 | 129 | [JSON](docs/data/reports/esp32dev/971beb60288dc45009d502a4bec48f8d839d40b5-714bd9f69aa0-references.json) |
| rainbow | esp32dev | 3.10.1 | 444 | 129 | [JSON](docs/data/reports/esp32dev/dec101a1268e013ef42deee644ff58883179d61a-714bd9f69aa0-references.json) |
| rainbow | esp32dev | 3.10.2 | 449 | 130 | [JSON](docs/data/reports/esp32dev/3d1f9fe373b295254354f6266030557a497594cf-714bd9f69aa0-references.json) |
| rainbow | esp32dev | 3.10.3 | 449 | 130 | [JSON](docs/data/reports/esp32dev/20667c3a6413ed46a828f78ec95fb57e58d753f8-714bd9f69aa0-references.json) |
| rainbow | esp32dev | 3.10.4 | 782 | 245 | [JSON](docs/data/reports/esp32dev/adedfc40e73fb80f8e930318781036d8fe1dbd9f-714bd9f69aa0-references.json) |
| rainbow | esp32dev | 3.10.5 | 782 | 245 | [JSON](docs/data/reports/esp32dev/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-714bd9f69aa0-references.json) |
| rainbow | esp32dev | 3.10.6 | 589 | 209 | [JSON](docs/data/reports/esp32dev/ebf8c2823c486158a046d8e1e682d3143580ae4e-714bd9f69aa0-references.json) |
| rainbow | esp32dev | master | 581 | 207 | [JSON](docs/data/reports/esp32dev/a439902ac6af64e600031c01b5c2ac0df2e690bc-714bd9f69aa0-references.json) |
| rainbow | teensy41 | 3.10.0 | 216 | 1 | [JSON](docs/data/reports/teensy41/971beb60288dc45009d502a4bec48f8d839d40b5-5fd343110b20-references.json) |
| rainbow | teensy41 | 3.10.1 | 216 | 1 | [JSON](docs/data/reports/teensy41/dec101a1268e013ef42deee644ff58883179d61a-5fd343110b20-references.json) |
| rainbow | teensy41 | 3.10.2 | 384 | 1 | [JSON](docs/data/reports/teensy41/3d1f9fe373b295254354f6266030557a497594cf-5fd343110b20-references.json) |
| rainbow | teensy41 | 3.10.3 | 384 | 1 | [JSON](docs/data/reports/teensy41/20667c3a6413ed46a828f78ec95fb57e58d753f8-5fd343110b20-references.json) |
| rainbow | teensy41 | 3.10.4 | 487 | 1 | [JSON](docs/data/reports/teensy41/adedfc40e73fb80f8e930318781036d8fe1dbd9f-5fd343110b20-references.json) |
| rainbow | teensy41 | 3.10.5 | 487 | 1 | [JSON](docs/data/reports/teensy41/4880ae48cb6f9ceaefd4d15b5f25f4c43de95f4e-5fd343110b20-references.json) |
| rainbow | teensy41 | 3.10.6 | 436 | 3 | [JSON](docs/data/reports/teensy41/ebf8c2823c486158a046d8e1e682d3143580ae4e-5fd343110b20-references.json) |
| rainbow | teensy41 | master | 418 | 2 | [JSON](docs/data/reports/teensy41/a439902ac6af64e600031c01b5c2ac0df2e690bc-5fd343110b20-references.json) |
