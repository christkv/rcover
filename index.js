var path = require('path')
  , fs = require('fs')
  , _ = require('underscore')
  , instrument = require('./lib/instrument')
  , CoverageData = require('./coverage_data').CoverageData
  , addInstrumentationHeader = require('./cover').addInstrumentationHeader
  , cover = require('./cover').cover
  , saveCoverageData = require('./cover').saveCoverageData
  , Module = require('module').Module
  , crypto = require('crypto')
  , repl = require("repl");


/**************************************************************
 * Execute cover
 *************************************************************/
var config = {
    debugDirectory: null
  , ignore: { '/Users/ck/coding/projects/rcover/test/noframework/node_modules': true }
  , regexp: null
  , dataDirectory: ".coverage_data"
  , prefix: "rcover_"
}

// Run cover
var coverage = cover(config.regexp, config.ignore, config.debugDirectory);
var file = "/Users/ck/coding/projects/rcover/test/noframework/main.js"

process.nextTick(function() {
  try {
    // console.log("======================  TICK =========")
    // Load up the new argv
    var options = [];
    process.argv = ["node", file].concat(options)
    // Load the file as the main module
    Module.runMain(file, null, true)
  }
  catch(ex) {
    console.log(ex.stack);
  }
});

// Setup the on exit listener
process.on(
    "exit", 
    function() {
      coverage(function(coverageData) {
        // console.log("============== DONE")

        try {
          saveCoverageData(coverageData, config);
        } catch(e) {
          console.log(e.stack);
        }
      });
    });














