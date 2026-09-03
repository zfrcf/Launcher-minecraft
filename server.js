#!/usr/bin/env node

const express = require('express')
const netApi = require('net-browserify')
const compression = require('compression')
const path = require('path')

// Create our app
const app = express()

app.get('/config.json', (_, res) => {
  const fs = require('fs')
  const configPath = path.join(__dirname, 'config.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (process.env.AZURE_CLIENT_ID) config.azureClientId = process.env.AZURE_CLIENT_ID
  res.json(config)
})

app.use(compression())
app.use(netApi({ allowOrigin: '*' }))
if (process.argv[3] === 'dev') {
  // https://webpack.js.org/guides/development/#using-webpack-dev-middleware
  const webpackDevMiddleware = require('webpack-dev-middleware')
  const config = require('./webpack.dev.js')
  const webpack = require('webpack')
  const compiler = webpack(config)

  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: config.output.publicPath
    })
  )
} else {
  app.use(express.static(path.join(__dirname, './public')))
}

// Start the server using PORT env (Railway) or CLI arg or fallback 8080
const port = process.env.PORT || process.argv[2] || 8080
const server = app.listen(port, '0.0.0.0', function () {
  console.log('Server listening on port ' + server.address().port)
})
