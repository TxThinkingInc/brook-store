#!/bin/bash

# nami install bun bun.plus

bunu https://bash.ooo/bundle.js static bundled.js
bun install
bun build --compile --outfile brook-user-system main.js
