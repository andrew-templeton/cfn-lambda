var archiver = require('archiver');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var mkdirp = require('mkdirp');

module.exports = function(folder, outPath, callback) {
  var zip_parts = [];
  var archive = archiver('zip');

  mkdirp.sync( path.resolve(outPath, "..") );
  var output = fs.createWriteStream(outPath);
  output.on('close', callback);

  var options = {
    cwd: folder,
    ignore: [
      path.relative(folder, outPath),
      "deploy/**"
    ]
  };
  try {
    var ignore = fs.readFileSync( path.join(folder, ".zipignore"), 'utf8' );
    options.ignore = _.compact( _.flatten([options.ignore, ignore.split('\n')]) );
  } catch (e) {}

  archive.pipe(output);
  archive.glob('**/*.*', options);

  archive.finalize();
}
