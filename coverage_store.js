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
        // Merge all previous diffs
        var previousDiff = {nodes:{}, blocks:{}};
        for(var i = 0; i < allCoverageDataDiffs[filename].length; i++) {
          var _diff = allCoverageDataDiffs[filename][i];
          // Go over the nodes
          for(var key in _diff.nodes) {
            if(previousDiff.nodes[key] == null)
              previousDiff.nodes[key] = _diff.nodes[key];
          }

          for(var key in _diff.blocks) {
            if(previousDiff.blocks[key] == null)
              previousDiff.blocks[key] = _diff.blocks[key];
          }
        }

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
  module.exports.reset = function(filename) {
    // delete coverageStore[filename];
    delete allCoverageDataDiffs[filename];
  }
})();