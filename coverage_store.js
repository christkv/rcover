// Copyright 2011 Itay Neeman
//
// Licensed under the MIT License

(function() {
  var coverageStore = {};     
  var allCoverageDataDiffs = {};
  
  module.exports = {};
  module.exports.register = function(filename) {
    return coverageStore[filename] = coverageStore[filename] || {nodes: {}, blocks: {}};        
  }
  
  module.exports.getStore = function(filename) {
    if(!allCoverageDataDiffs[filename]) allCoverageDataDiffs[filename] = [];

    if(coverageStore[filename]) {
      var diffCoverage = {nodes:{}, blocks:{}};
      var coverage = coverageStore[filename];

      if(allCoverageDataDiffs[filename].length == 0) {
        for(var key in coverage.nodes) {
          diffCoverage.nodes[key] = {index:key, count: coverage.nodes[key].count};
        }

        for(var key in coverage.blocks) {
          diffCoverage.blocks[key] = {index:key, count: coverage.blocks[key].count};
        }

        allCoverageDataDiffs[filename].push(diffCoverage);
        return diffCoverage;
      } else {
        var previousDiff = allCoverageDataDiffs[filename][allCoverageDataDiffs[filename].length - 1];
        var diffCoverage = {nodes:{}, blocks:{}};

        for(var key in coverage.nodes) {
          if(previousDiff.nodes[key] == null) {
            diffCoverage.nodes[key] = {index:key, count: 1};
          } else if(previousDiff.nodes[key].count < coverage.nodes[key].count) {
            diffCoverage.nodes[key] = {index:key, count: 1};
          }
        }

        for(var key in coverage.blocks) {
          if(previousDiff.blocks[key] == null) {
            diffCoverage.blocks[key] = {index:key, count: 1};
          } else if(previousDiff.blocks[key].count < coverage.blocks[key].count) {
            diffCoverage.blocks[key] = {index:key, count: 1};
          }
        }

        allCoverageDataDiffs[filename].push(diffCoverage);
        return diffCoverage;
      }
    } 

    return coverageStore[filename] || {};
  }

  /**
   * Reset all the counters
   **/
  module.exports.reset = function() {
    // coverageStore["/Users/ck/coding/projects/rcover/test/nodeunit/library.js"].nodes({})

    // var keys = Object.keys(coverageStore);
    // for(var i = 0; i < keys.length; i++) {
    //   for(key in coverageStore[keys[i]].nodes) {
    //     coverageStore[keys[i]].nodes[key].count = 0;
    //     // delete coverageStore[keys[i]].nodes[key]['index'];
    //   }

    //   for(key in coverageStore[keys[i]].blocks) {
    //     coverageStore[keys[i]].blocks[key].count = 0;
    //     // delete coverageStore[keys[i]].nodes[key]['index'];
    //   }
    // }
  }
})();