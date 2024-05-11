#!/bin/bash

bun lib/bundle.js static bundle.js
bun build --compile --outfile brook-user-system main.js
