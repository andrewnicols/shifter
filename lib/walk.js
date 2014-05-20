
var log = require('./log'),
    Stack = require('./stack').Stack,
    timer = require('timethat'),
    fs = require('fs'),
    path = require('path'),
    shifter = require('./'),
    spawn = require('child_process').spawn,
    util = require('./util'),
    exists = util.exists,
    has = function (opt, name) {
        return opt.some(function (v) {
            return (v === name);
        });
    };

exports.run = function (cliOptions, filledOptions, callback) {
    if (!log.isTTY) {
        cliOptions.progress = false;
    }
    log.info('racing the directories');
    var modStack = new Stack(),
        start = new Date(),
        mods = [],
        excludes = {},
        max = cliOptions.max || false,
        bar,
        ProgressBar,
        i,
        args = [],
        checkDirectory;

    if (cliOptions.excludes && cliOptions.excludes.length) {
        cliOptions.excludes.forEach(function(mod) {
            excludes[mod] = mod;
        });
    }

    if (cliOptions.progress) {
        ProgressBar = require('progress');
        bar = new ProgressBar(log.color('  shifting [', 'magenta') +
        log.color(':bar', 'cyan') + log.color(']', 'magenta') +
        log.color(' :percent :etas', 'yellow'), {
            total: 100,
            width: 100,
            complete: '>',
            incomplete: ' '
        });
    }
    if (cliOptions.cssproc) {
        args.push('--cssproc');
        args.push(cliOptions.cssproc);
    }
    if (cliOptions.compressor) {
        args.push('--compressor');
    }
    if (cliOptions.clean) {
        args.push('--clean');
    }
    if (cliOptions.semi === false) {
        args.push('--no-semi');
    }
    if (cliOptions.coverage === false) {
        args.push('--no-coverage');
    }
    if (cliOptions.cache) {
        args.push('--cache');
    }
    if (cliOptions.istanbul) {
        args.push('--istanbul');
    }
    if (cliOptions.lint) {
        args.push('--lint');
        args.push(cliOptions.lint);
    }
    if (cliOptions.lint === false) {
        args.push('--no-lint');
    }
    if (cliOptions.csslint === false) {
        args.push('--no-csslint');
    }
    if (cliOptions['lint-stderr']) {
        args.push('--lint-stderr');
    }
    if (cliOptions.strict) {
        args.push('--strict');
    }
    if (cliOptions.assets === false) {
        args.push('--no-assets');
    }

    if (cliOptions['build-dir']) {
        args.push('--build-dir');
        args.push(cliOptions['build-dir']);
    }

    Object.keys(cliOptions).forEach(function (k) {
        if (k.indexOf('replace-') === 0) {
            args.push('--' + k + '=' + cliOptions[k]);
        }
    });

    if (args.length) {
        log.info('using ' + args.join(' '));
    }

    args.unshift(util.shifter);

    checkDirectory = function(startdir, workingdir) {
        fs.readdir(workingdir, modStack.add(function (err, dirs) {
            dirs.forEach(function (mod) {
                var p = path.join(workingdir, mod);
                if (!excludes[mod]) {
                    exists(path.join(p, 'build.json'), modStack.add(function (yes) {
                        var relative, stat;
                        if (yes) {
                            if (!cliOptions.modules || has(cliOptions.modules, mod)) {
                                relative = workingdir.replace(startdir, '');
                                mods.push(path.join(relative, mod));
                            }
                        } else if (cliOptions.recursive) {
                            stat = fs.statSync(p);
                            if (stat.isDirectory()) {
                                checkDirectory(startdir, p);
                            }
                        }
                    }));
                }
            });
        }));
    };

    checkDirectory(shifter.cwd(), shifter.cwd());

    modStack.done(function () {
        if (!mods.length) {
            return callback('no modules found, hitting the brakes.');
        }
        if (bar) {
            bar.total = mods.length - 1;
        }
        log.info('found ' + mods.length + ' modules to race' + ((max) ? ' (' + max + ' at a time)' : '') + ', let\'s do this');
        log.warn('this will be quiet, only status will be emitted for speed. failed builds will print after');
        var stack = new Stack(),
            errors = [],
            run = function () {
                var mod = mods.pop(), child;
                if (mod) {
                    child = spawn(process.execPath, args, {
                        cwd: path.join(shifter.cwd(), mod),
                        stdio: [process.stdin, 'ignore', process.stderr]
                    });
                    child.on('exit', stack.add(function (code) {
                        if (cliOptions.progress) {
                            bar.tick();
                        } else {
                            process.stdout.write((code ? log.color('!', 'red') : log.color('.', 'white')));
                        }
                        if (code) {
                            errors.push(mod);
                        }
                        run();
                    }));
                }
            };

        if (max) {
            for (i = 0; i < max; i = i + 1) {
                run();
            }
        } else {
            run();
        }

        stack.done(function () {
            console.log('');
            var end = new Date();
            log.info('done racing, the gears are toast');
            log.info('finished in ' + timer.calc(start, end) + ', pretty fast huh?');
            if (errors.length) {
                log.warn('the following builds exited with a 1');
                errors.forEach(function (mod) {
                    console.log('   ', log.color(mod, 'red'));
                });
                callback('Walk failed, ' + errors.length + ' builds exited with a 1');
            } else if (typeof callback === 'function') {
                callback();
            }
        });
    });
};
