const logger = require('./logger');
const semver = require('semver');
const child_process = require('child_process');

/**
 * Represents and provides an interface to an executable habitat binary
 * available in the host environment
 */
class Habitat {

    constructor (command = 'hab') {
        this.command = command;
        this.version = null;
        this.build = null;
    }

    /**
     * Get the version of the hab binary
     * @return {?string} Version reported by habitat binary, or null if not available
     */
    async getVersion () {
        if (this.version === null) {
            try {
                const output = await this.exec({ version: true });
                [, this.version, this.build] = /^hab ([^\/]+)\/(\d+)$/.exec(output);
            } catch (err) {
                this.version = false;
            }
        }

        return this.version || null;
    }

    /**
     * Check if habitat version is satisfied
     * @param {string} range - The version or range habitat should satisfy (see https://github.com/npm/node-semver#ranges)
     * @return {boolean} True if habitat version satisfies provided range
     */
    async satisfiesVersion (range) {
        return semver.satisfies(await this.getVersion(), range);
    }

    /**
     * Executes habitat with given arguments
     * @param {string|string[]} args - Arguments to execute
     * @param {?Object} execOptions - Extra execution options
     * @returns {Promise}
     */
    async exec (...args) {
        const commandArgs = [];
        const commandEnv = {};
        const execOptions = {};


        // scan through all arguments
        let arg;

        while (arg = args.shift()) {
            switch (typeof arg) {
                case 'string':
                case 'number':
                    commandArgs.push(arg.toString());
                    break;
                case 'object':

                    // extract any exec options
                    if ('$nullOnError' in arg) {
                        execOptions.nullOnError = arg.$nullOnError;
                        delete arg.$nullOnError;
                    }

                    if ('$env' in arg) {
                        for (let key in arg.$env) {
                            commandEnv[key] = arg.$options[key];
                        }
                        delete arg.$env;
                    }

                    if ('$preserveEnv' in arg) {
                        execOptions.preserveEnv = arg.$preserveEnv;
                        delete arg.$preserveEnv;
                    }

                    if ('$options' in arg) {
                        for (let key in arg.$options) {
                            execOptions[key] = arg.$options[key];
                        }
                    }

                    if (arg.passthrough) {
                        execOptions.spawn = true;
                        execOptions.passthrough = true;
                        delete arg.passthrough;
                    }

                    if (arg.wait) {
                        execOptions.wait = true;
                        delete arg.wait;
                    }


                    // any remaiing elements are args/options
                    for (let key in arg) {
                        const value = arg[key];

                        if (key.length == 1) {
                            if (value === true) {
                                commandArgs.push('-'+key);
                            } else if (value !== false) {
                                commandArgs.push('-'+key, value);
                            }
                        } else {
                            if (value === true) {
                                commandArgs.push('--'+key);
                            } else if (value !== false) {
                                commandArgs.push('--'+key, value);
                            }
                        }
                    }

                    break;
                default:
                    throw 'unhandled exec argument';
            }
        }


        // prepare options
        if (execOptions.preserveEnv !== false) {
            Object.setPrototypeOf(commandEnv, process.env);
        }

        execOptions.env = commandEnv;


        // execute git command
        logger.debug(this.command, commandArgs.join(' '));

        if (execOptions.spawn) {
            const process = child_process.spawn(this.command, commandArgs, execOptions);

            if (execOptions.passthrough) {
                process.stdout.on('data', data => data.toString().trim().split(/\n/).forEach(line => logger.info(line)));
                process.stderr.on('data', data => data.toString().trim().split(/\n/).forEach(line => logger.error(line)));
            }

            if (execOptions.wait) {
                return new Promise((resolve, reject) => {
                    process.on('exit', code => {
                        if (code == 0) {
                            resolve();
                        } else {
                            reject(code);
                        }
                    });
                });
            }

            return process;
        } else if (execOptions.shell) {
            return new Promise((resolve, reject) => {
                child_process.exec(`${this.command} ${commandArgs.join(' ')}`, execOptions, (error, stdout, stderr) => {
                    if (error) {
                        if (execOptions.nullOnError) {
                            return resolve(null);
                        } else {
                            error.stderr = stderr;
                            return reject(error);
                        }
                    }

                    resolve(stdout.trim());
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                child_process.execFile(this.command, commandArgs, execOptions, (error, stdout, stderr) => {
                    if (error) {
                        if (execOptions.nullOnError) {
                            return resolve(null);
                        } else {
                            error.stderr = stderr;
                            return reject(error);
                        }
                    }

                    resolve(stdout.trim());
                });
            });
        }
    }
}

const habitat = new Habitat();

module.exports = function () {
    return habitat.exec.apply(habitat, arguments);
};

Object.setPrototypeOf(module.exports, habitat);