var path = require('path')
  , fs = require('fs')
  , _ = require('underscore')
  , instrument = require('./lib/instrument')
  , Module = require('module').Module
  , repl = require("repl");

/**************************************************************
 * Coverage Data
 *************************************************************/
var CoverageData = function CoverageData (filename, instrumentor) {
    this.instrumentor = instrumentor;
    this.filename = filename;
    this.nodes = {};
    this.visitedBlocks = {};
    this.source = instrumentor.source;
};

// Note that a node has been visited
CoverageData.prototype.visit = function(node) {
  console.log("================ visit")
}

// Note that a node has been visited
CoverageData.prototype.visitBlock = function(blockIndex) {
  console.log("================ visitBlock")
}

// Get all the nodes we did not see
CoverageData.prototype.missing = function() {
  console.log("================ missing")
}

// Get all the nodes we did see
CoverageData.prototype.seen = function() {  
  console.log("================ seen")
}

// Calculate node coverage statistics
CoverageData.prototype.blocks = function() {
  console.log("================ blocks")
}

// Get per-line code coverage information
CoverageData.prototype.coverage = function() {  
  console.log("================ coverage")
}

CoverageData.prototype.prepare = function() {
  console.log("================ prepare")
}

// Get statistics for the entire file, including per-line code coverage
// and block-level coverage
CoverageData.prototype.stats = function() {
  console.log("================ stats")
}

/**************************************************************
 * Helper methods
 *************************************************************/
var addInstrumentationHeader = function(template, filename, instrumented, coverageStorePath) {
    var template = _.template(template);
    var renderedSource = template({
        instrumented: instrumented,
        coverageStorePath: coverageStorePath,
        filename: filename,
        source: instrumented.instrumentedSource
    });
    
    // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% LOAD") 
    // console.log(renderedSource)
    return renderedSource
};

/**************************************************************
 * Cover method
 *************************************************************/
var cover = function(fileRegex, ignore, debugDirectory) {    
  var originalRequire = require.extensions['.js'];
  var coverageData = {};
  var match = null;
  
  ignore = ignore || {};
  
  if(fileRegex instanceof RegExp) {
    match = regex;
  } else {
    match = new RegExp(fileRegex ? (fileRegex.replace(/\//g, '\\/').replace(/\./g, '\\.')) : ".*", '');
  }
      
  var pathToCoverageStore = path.resolve(path.resolve(__dirname), "coverage_store.js").replace(/\\/g, "/");
  var templatePath = path.resolve(path.resolve(__dirname), "templates", "instrumentation_header.js");
  var template = fs.readFileSync(templatePath, 'utf-8');
  
  require.extensions['.js'] = function(module, filename) {
      console.log("=========================== LOAD " + filename)
      
      filename = filename.replace(/\\/g, "/");

      if(!match.test(filename)) return originalRequire(module, filename);
      if(filename === pathToCoverageStore) return originalRequire(module, filename);
      
      // If the specific file is to be ignored
      var full = path.resolve(filename); 
      if(ignore[full]) {
        return originalRequire(module, filename);
      }
      
      // If any of the parents of the file are to be ignored
      do {
        full = path.dirname(full);
        if (ignore[full]) {
          return originalRequire(module, filename);
        }
      } while(full !== path.dirname(full));

      var data = fs.readFileSync(filename, 'utf8').trim();
      // Remove byte order mark if present
      if(data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1);
      }

      data = data.replace(/^\#\!.*/, '');

      // console.log("------------------------------ data START")
      // console.log(data)
      // console.log("------------------------------ data END")

      // console.dir(filename)
      var instrumented = instrument(data);

      // console.log("------------------------------ instrumented START")
      // console.log(instrumented)
      // console.log("------------------------------ instrumented END")

      var coverage = coverageData[filename] = new CoverageData(filename, instrumented);

      // console.dir(pathToCoverageStore)
      
      var newCode = addInstrumentationHeader(template, filename, instrumented, pathToCoverageStore);

      if (debugDirectory) {
          var outputPath = path.join(debugDirectory, filename.replace(/[\/|\:|\\]/g, "_") + ".js");
          fs.writeFileSync(outputPath, newCode);
      }   

      return module._compile(newCode, filename);
  };
  
  // Setup the data retrieval and release functions
  var coverage = function(ready) {
    ready(coverageData);
  };
  
  coverage.release = function() {
    require.extensions['.js'] = originalRequire;
  };
  
  return coverage;
};

var regExp = null;
var ignore = { '/Users/ck/coding/projects/rcover/test/noframework/node_modules': true }
var debugDirectory = null;
// Run cover
var coverage = cover(regExp, ignore, debugDirectory);
var file = "/Users/ck/coding/projects/rcover/test/noframework/main.js"

process.nextTick(function() {
    try {
        console.log("======================  TICK =========")
        // Load up the new argv
        var options = [];
        process.argv = ["node", file].concat(options)
        
        // console.dir(file)
        // Load the file as the main module
        Module.runMain(file, null, true)

        // var store = require('./coverage_store');//.getStore(this.filename);
        // console.dir(store.getStore('/Users/ck/coding/projects/rcover/test/noframework/main.js'))
        // console.dir(store.getStore('/Users/ck/coding/projects/rcover/test/noframework/somelib.js'))
        // global.store = store;
        // // console.dir(module.exports.getStore)

        // repl.start({
        //   prompt: "rcover> ",
        //   global: true,
        //   input: process.stdin,
        //   output: process.stdout
        // });

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
        console.log("============== DONE")

        // saveCoverageData(coverageData, config);

        var store = require('./coverage_store');//.getStore(this.filename);
        console.dir(store.getStore('/Users/ck/coding/projects/rcover/test/noframework/main.js'))
        console.dir(store.getStore('/Users/ck/coding/projects/rcover/test/noframework/somelib.js'))
        // console.dir(coverageData)
      });
    });














