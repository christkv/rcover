var fs = require('fs')
  , path = require('path')
  , nodeunit = require('nodeunit')
  , CoverageData = require('./coverage_data').CoverageData
  , addInstrumentationHeader = require('./cover').addInstrumentationHeader
  , cover = require('./cover').cover
  , saveCoverageData = require('./cover').saveCoverageData
  , Module = require('module').Module;

/**************************************************************
 * Execute cover
 *************************************************************/
var ignore_paths = {}
ignore_paths[__dirname + "/node_modules"] = true;

var config = {
    debugDirectory: null
  , ignore: ignore_paths
  , regexp: null
  , dataDirectory: ".coverage_data"
  , prefix: "rcover_"
}

// Run cover
var coverage = cover(config.regexp, config.ignore, config.debugDirectory);
var store = require('./coverage_store');

/**************************************************************
 * Nodeunit runner
 *************************************************************/
// Default options for nodeunit
var options = {
  "error_prefix": "\u001B[31m",
  "error_suffix": "\u001B[39m",
  "ok_prefix": "\u001B[32m",
  "ok_suffix": "\u001B[39m",
  "bold_prefix": "\u001B[1m",
  "bold_suffix": "\u001B[22m",
  "assertion_prefix": "\u001B[35m",
  "assertion_suffix": "\u001B[39m"
}

var NodeunitRunner = function NodeunitRunner(paths, method, options) {
  this.paths = paths;
  this.method = method;
  this.options = options;
  // Get the test runner used
  this.testrunner = nodeunit.reporters.default;
}

NodeunitRunner.prototype.run = function() {  
  this.finalFiles = [];
  this.totalNumberOfFiles = 0;

  // For each entry load the file and extract all the test methods available
  for(var i = 0; i < this.paths.length; i++) {
    var file = this.paths[i];
    // Stat the object
    var stat = fs.statSync(__dirname + "/" + file);
    if(stat.isFile()) {
      this.finalFiles.push({file: file, path: __dirname + "/" + file});
    }
  }

  // Total number of files that need to be processed
  this.totalNumberOfFiles = this.finalFiles.length;
  // Only run tests verified as files
  for(var i = 0; i < this.finalFiles.length; i++) {
    _run(this, this.finalFiles, this.method);
  }  
}

var _run = function _run(self, files, method) {
  // Keeps the results for each method
  var allResults = [];

  // Set up an execution context
  var opts = {
    testspec: method,
    testFullSpec: null,
    moduleStart: function (name) {
      // console.log("------------------------------------------------ moduleStart")
    },

    moduleDone: function (name, assertions) {
      // console.log("------------------------------------------------ moduleDone")
    },

    testStart: function () {
      // console.log("------------------------------------------------ testStart")
    },

    testDone: function (name, assertions) {
      console.log("\n\n+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
      console.log("================================================= testDone :: " + name)
      console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
      coverage(function(coverageData) {        
        try {
          var measures = saveCoverageData(coverageData, config);

          // console.dir(Object.keys(coverageData))

          for(var reloadModule in coverageData) {
            delete require.cache[reloadModule];
            require(reloadModule);
          }

          // require('/Users/ck/coding/projects/rcover/test/nodeunit/library.js')

          console.dir(measures.files)
          // // Let's Calculate the diff and save it as it represents the actual values changed for this function
          // if(allResults.length == 0) {
          //   allResults.push({name: name, result: measures});
          // } else {
          //   // Locate previous measure
          //   var previousMeasure = allResults[allResults.length - 1].result;
          //   // console.log("------------------------------------------------------------")
          //   // console.log("=================================================== previous")
          //   // console.dir(previousMeasure.files)
          //   // console.log("=================================================== current")
          //   // console.dir(measures.files)
          // }
        } catch(e) {
          console.log(e.stack);
        }
      });
    },

    done: function (assertions) {
      console.log("================================================= done")
      self.totalNumberOfFiles = self.totalNumberOfFiles - 1;
      // Perform reporting
      if(self.totalNumberOfFiles == 0) {
        console.log("================================= DONE")
        _report(self);
      }
    }
  };

  // Run the file with options
  nodeunit.runFiles([files[0].path], opts);
}

var _report = function _report(self) {
  console.log("================================= _report")

}

exports.NodeunitRunner = NodeunitRunner;




















