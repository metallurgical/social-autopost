#!/bin/sh
# get latest code from repository
git pull
# install newest version of npm package if any
npm install
# clean and compile build directory
node ace build --production --ignore-ts-errors
# copy .env file into build directory
cp .env build
# enter into build directory
cd build
# compiled for production
npm ci --production
# reload pm2 service to take/reflect new changes
pm2 reload nodejs-social-autopost --update-env
