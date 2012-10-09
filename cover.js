var path = require('path')
  , fs = require('fs')
  , _ = require('underscore')
  , instrument = require('./lib/instrument')
  , CoverageData = require('./coverage_data').CoverageData
  , crypto = require('crypto');

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
  
  return renderedSource
};

/**************************************************************
 * Cover method
 *************************************************************/
var cover = function(fileRegex, ignore, debugDirectory) {    
  var originalRequire = require.extensions['.js'];
  var coverageData = {};
  var match = null;
  
  ignore = ignore || [];
  
  if(fileRegex instanceof RegExp) {
    match = regex;
  } else {
    match = new RegExp(fileRegex ? (fileRegex.replace(/\//g, '\\/').replace(/\./g, '\\.')) : ".*", '');
  }
      
  var pathToCoverageStore = path.resolve(path.resolve(__dirname), "coverage_store.js").replace(/\\/g, "/");
  var templatePath = path.resolve(path.resolve(__dirname), "templates", "instrumentation_header.js");
  var template = fs.readFileSync(templatePath, 'utf-8');
  
  require.extensions['.js'] = function(module, filename) {
    filename = filename.replace(/\\/g, "/");

    if(!match.test(filename)) {
      return originalRequire(module, filename);
    }

    if(filename === pathToCoverageStore) {
      return originalRequire(module, filename);
    }
    
    // If the specific file is to be ignored
    var full = path.resolve(filename); 
    // Check if it needs to be ignored
    for(var i = 0; i < ignore.length; i++) {
      if(full.match(ignore[i]) != null) {
        return originalRequire(module, filename);  
      }
    }

    // If any of the parents of the file are to be ignored
    do {
      full = path.dirname(full);
      // Check if it needs to be ignored
      for(var i = 0; i < ignore.length; i++) {
        if(full.match(ignore[i]) != null) {
          return originalRequire(module, filename);  
        }
      }
    } while(full !== path.dirname(full));

    var data = fs.readFileSync(filename, 'utf8').trim();
    // Remove byte order mark if present
    if(data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }

    data = data.replace(/^\#\!.*/, '');
    var instrumented = instrument(data);
    var coverage = coverageData[filename] = new CoverageData(filename, instrumented);
    var newCode = addInstrumentationHeader(template, filename, instrumented, pathToCoverageStore);

    if(debugDirectory) {
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

/**************************************************************
 * Save the coverage data
 *************************************************************/
var transformCoverageData = function(coverageData, configs, noPrecombine) {
  // Setup the information we're going to save
  var files = {};
  var toSave = {
    // version: pkg.version,
    files: files
  };
  
  _.each(coverageData, function(fileData, fileName, lst) {
    // For each file, we hash the source to get a "version ID" 
    // for it
    var stats = fileData.stats();
    var fileSource = stats.source;
    var md5 = crypto.createHash('md5');
    md5.update(fileSource);
    var hash = md5.digest('hex');
    
    // We also save the stats and the hash,
    // which is everything we need in order
    // to be able to generate reports
    files[fileName] = {
      stats: stats,
      hash: hash
    }
  });

  return toSave;
};

exports.addInstrumentationHeader = addInstrumentationHeader;
exports.cover = cover;
exports.transformCoverageData = transformCoverageData;
