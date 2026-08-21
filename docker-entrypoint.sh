#!/bin/sh
set -e
# Prisma CLI lives in its own tree (see Dockerfile) so it cannot shadow the
# generated client in ./node_modules.
node prisma-cli/node_modules/prisma/build/index.js migrate deploy
exec node server.js
