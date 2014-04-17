/*
Copyright (c) 2012, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://yuilibrary.com/license/
*/
var fs = require('fs');

exports.check = function (options, blob, done) {
    var bail = null,
        sourceFile;

    if (blob.result.length === 0) {
        if (blob.name) {
            sourceFile = fs.readFileSync(blob.name, {
                encoding: 'UTF-8'
            });
        }
        if (!blob.name || sourceFile.length !== 0) {
            bail = 'writing zero length file from ' + blob.name;
        }
    }

    done(bail, new blob.constructor(blob.result, blob));
};

