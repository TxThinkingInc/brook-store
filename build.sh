#!/bin/bash

# nami install bun bun.plus

bunu https://bash.ooo/bundle.js html html.bundle.js
mkdir worker
bun build --target=bun --outfile worker/task.worker.js task.worker.js
bunu https://bash.ooo/bundle.js worker worker.bundle.js
rm -rf worker
bun install
bun build --compile --outfile brook-store main.js
