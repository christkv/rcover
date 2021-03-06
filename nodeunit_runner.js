var fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , nodeunit = require('nodeunit')
  , CoverageData = require('./coverage_data').CoverageData
  , addInstrumentationHeader = require('./cover').addInstrumentationHeader
  , cover = require('./cover').cover
  , transformCoverageData = require('./cover').transformCoverageData
  , Module = require('module').Module
  , jade = require('jade');

/**************************************************************
 * Execute cover
 *************************************************************/
var ignore_regexps = [/node_modules/];
var config = {
    debugDirectory: null
  , ignore: ignore_regexps
  , regexp: null
  , dataDirectory: ".coverage_data"
  , outputDirectory: "rcover_html"
  , prefix: "rcover_"
}

// Run cover
var coverage = null;
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

var NodeunitRunner = function NodeunitRunner(paths, ignore, method, options) {
  this.paths = paths;
  this.method = method;
  this.options = options;
  
  // Add all the paths to the coverage ignore
  if(Array.isArray(ignore) && ignore.length > 0) {
    config.ignore = config.ignore.concat(ignore);
  } else {
    config.ignore = config.ignore.concat(this.paths);
  }

  // Save the config
  this.config = config;
  // Set up the coverage
  coverage = cover(config.regexp, config.ignore, config.debugDirectory);
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
    var stat = fs.statSync(file);
    if(stat.isFile()) {
      this.finalFiles.push({file: file, path: file});
    }
  }

  // Total number of files that need to be processed
  this.totalNumberOfFiles = this.finalFiles.length;
  // Only run tests verified as files
  for(var i = 0; i < this.finalFiles.length; i++) {
    _run(this, this.finalFiles, this.method, config);
  }  
}

var _run = function _run(self, files, method, config) {
  // Keeps the results for each method
  var allResults = [];
  var testsByFile = {};
  var outputCounter = 0;

  // Build a list of all method names and files
  for(var i = 0; i < files.length; i++) {
    var tests = Object.keys(require(files[i].path)).filter(function(t) { return !t.toLowerCase().match(/^setup$|^teardown$/)});
    // Save the tests by this file so we can look them up
    testsByFile[files[i].file] = tests;
  }

  // Make the directory
  var dataDirectory = path.join(path.resolve(process.cwd()), config.dataDirectory);
  if(!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, "0755");
  } else {
    // Remove the data directory
    rmdirRecursiveSync(path.join(path.resolve(process.cwd()), config.dataDirectory));
    fs.mkdirSync(dataDirectory, "0755");    
  }

  // Make the output directory
  var outputDirectory = path.join(path.resolve(process.cwd()), config.outputDirectory);
  if(!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, "0755");
  } else {
    // Remove the data directory
    rmdirRecursiveSync(path.join(path.resolve(process.cwd()), config.outputDirectory));
    fs.mkdirSync(outputDirectory, "0755");    
  }

  // Set up an execution context
  var opts = {
    testspec: method,
    testFullSpec: null,
    moduleStart: function (name) {},
    moduleDone: function (name, assertions) {},
    testStart: function () {},

    testDone: function (name, assertions) {
      var currentPath = process.cwd();
      // Lookup the belonging file for this test
      for(var key in testsByFile) {
        if(testsByFile[key].indexOf(name) != null) {
          console.log("executing:: [" + key.replace(currentPath, '') + "] :: " + name);
        }
      }

      // Get the coverage data
      coverage(function(coverageData) {        
        try {
          // Get the transformed measure
          var measures = transformCoverageData(coverageData, config);
          // Lookup the belonging file for this test
          for(var key in testsByFile) {
            if(testsByFile[key].indexOf(name) != null) {
              measures.test_file = key;
              measures.test_method = name.toString();

              // Turn it into JSON and write it out
              var data = JSON.stringify(measures, 2, 2);  
              // Get the ID for this data (md5 hash)
              var dataMd5 = crypto.createHash('md5');
              dataMd5.update(data);
              var dataHash = dataMd5.digest('hex');
              
              // Create subdirectory for the results
              if(!fs.existsSync(dataDirectory + "/" + outputCounter)) {
                fs.mkdirSync(dataDirectory + "/" + outputCounter, "0755");
              }
              
              // Write out the file
              var dataFilename = path.join(dataDirectory + "/" + outputCounter, config.prefix + dataHash);
              fs.writeFileSync(dataFilename, data);
              // Update the counter for the result directories
              outputCounter = outputCounter + 1;  
              break;              
            }
          }

          // var pathToCoverageStore = path.resolve(path.resolve(__dirname), "coverage_store.js").replace(/\\/g, "/");
          // var coverageStore = require(pathToCoverageStore);

          // Reload all the modules we have coverage about to ensure correct behavior
          for(var reloadModule in coverageData) {
            delete require.cache[reloadModule];
            require(reloadModule);
          }
        } catch(e) {
          console.log(e.stack);
        }
      });
    },

    done: function (assertions) {
      self.totalNumberOfFiles = self.totalNumberOfFiles - 1;
      // Perform reporting
      if(self.totalNumberOfFiles == 0) {
        _report(self, config);
      }
    }
  };

  // Run the file with options
  nodeunit.runFiles([files[0].path], opts);
}

var _report = function _report(self, config) {
  // All the coverage data used to generate the final report
  var coverageData = {};
  // Let's retrieve the list of all available data
  var entries = fs.readdirSync(config.dataDirectory);
  for(var i = 0; i < entries.length; i++) {

    // For each entry if it's a directory read and process
    if(fs.statSync(config.dataDirectory + "/" + entries[i]).isDirectory()) {

      // Read in all the entries
      var files = fs.readdirSync(config.dataDirectory + "/" + entries[i]);
      for(var j = 0; j < files.length; j++) {

        if(fs.statSync(config.dataDirectory + "/" + entries[i] + "/" + files[j]).isFile()) {
          // Read and parse the data
          var data = JSON.parse(fs.readFileSync(config.dataDirectory + "/" + entries[i] + "/" + files[j], "utf8"));
          // Let's find all the covered data and add the correct measurements for them
          for(key in data.files) {
            // Add coverage data for this entry
            if(!coverageData[key]) coverageData[key] = [];
            // Add the test and method coverage info
            coverageData[key].push({
              test_file: data.test_file, test_method: data.test_method, data: data.files[key]
            });
          }
        }
      }
    }
  }

  // We now have all the data read in from the coverage run so we can generate the code overview
  // Render the results
  jade.renderFile(__dirname + "/templates/html/index.jade", 
    { pretty: true, 
      debug: false, 
      compileDebug: false,
      coverageData: coverageData
    }, function(err, str){
      if (err) throw err;
      fs.writeFileSync(config.outputDirectory + "/index.html", str, 'ascii');
    });

  // Process all the modules
  for(var key in coverageData) {
    // // Grab the data object for the 
    var data = coverageData[key];
    var test_file = data[0].test_file;
    var test_method = data[0].test_method;    
    var sources = data[0].data.stats.source.split(/\n/);

    // Missing lines
    var missing = [];
    // Preprocess some of the data (a list of all missing lines)
    for(var i = 0; i < data.length; i++) {
      if(missing.length == 0) {
        missing = data[i].data.stats.lines.map(function(r) { return r.lineno; });
      } else {
        missing_lines = data[i].data.stats.lines.map(function(r) { return r.lineno; });
        missing = intersect_safe(missing, missing_lines);
      }      
    }

    // Render the module
    jade.renderFile(__dirname + "/templates/html/module.jade", 
      { pretty: true, 
        debug: false, 
        compileDebug: false,
        module: key,
        sources: sources,
        missing: missing,
        test_file: test_file,
        test_method: test_method,
        coverage_data: data
      }, function(err, str){
        if (err) throw err;
        fs.writeFileSync(config.outputDirectory + "/" + key.replace(/\/|\.| /g, "_") + ".html", str, 'ascii');
      });    
  }
}

// Delete a directory recursively
var rmdirRecursiveSync = function(dirPath) {
  var files = fs.readdirSync(dirPath);
  
  for(var i = 0; i < files.length; i++) {
    var filePath = path.join(dirPath, files[i]);
    var file = fs.statSync(filePath);

    if(file.isDirectory()) {
      rmdirRecursiveSync(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  }

  fs.rmdirSync(dirPath);
};

/* finds the intersection of 
 * two arrays in a simple fashion.  
 *
 * PARAMS
 *  a - first array, must already be sorted
 *  b - second array, must already be sorted
 *
 * NOTES
 *
 *  Should have O(n) operations, where n is 
 *    n = MIN(a.length(), b.length())
 */
function intersect_safe(a, b) {
  var ai=0, bi=0;
  var result = new Array();

  while(ai < a.length && bi < b.length) {
    if(a[ai] < b[bi] ){ ai++; }
    else if (a[ai] > b[bi] ){ bi++; }
    else {
      result.push(a[ai]);
      ai++;
      bi++;
    }
  }

  return result;
}

exports.NodeunitRunner = NodeunitRunner;




















