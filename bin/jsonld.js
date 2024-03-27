#!/usr/bin/env node
/**
 * A command line JSON-LD utility.
 *
 * @author David I. Lehn <dlehn@digitalbazaar.com>
 *
 * BSD 3-Clause License
 * Copyright (c) 2013-2022 Digital Bazaar, Inc.
 * All rights reserved.
 */
import {fileURLToPath} from 'node:url';
import https from 'node:https';
import {inspect} from 'node:util';
import jsonld from 'jsonld';
import {jsonldRequest} from 'jsonld-request';
import path from 'node:path';
import {program} from 'commander';
import {readFileSync} from 'node:fs';

const version = {
  value: undefined,
  toString() {
    // load version when used
    if(this.value === undefined) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const pkg =
        JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json')));
      this.value = pkg.version;
    }
    return this.value;
  }
};

program.version(version);

// all allowed modes for jsonld-request
const ALLOW_ALL = ['stdin', 'file', 'http', 'https'];
const ALLOW_DEFAULT = ['http', 'https'];
const ALLOW_NONE = [];

// Parse the string or value and return the boolean value encoded or raise an
// exception.
function boolify(value) {
  if(typeof value === 'boolean') {
    return value;
  }
  if(typeof value === 'string' && value) {
    switch(value.toLowerCase()) {
      case 'true':
      case 't':
      case '1':
      case 'yes':
      case 'y':
        return true;
      case 'false':
      case 'f':
      case '0':
      case 'no':
      case 'n':
        return false;
    }
  }
  // if here we couldn't parse it
  throw new Error('Invalid boolean:' + value);
}

// common output function
async function _output(data, cmd) {
  if(typeof data === 'object') {
    const output = JSON.stringify(data, null, cmd.indent);
    process.stdout.write(output);
  } else if(typeof data === 'string') {
    process.stdout.write(data.trim());
  } else {
    process.stdout.write(data);
  }
  if(cmd.newline) {
    process.stdout.write('\n');
  }
}

// lint warning handler
function _warningHandler({event, next}) {
  if(event.level === 'warning') {
    console.log(`WARNING: ${event.message}`);
    console.log(inspect(event, {colors: true, depth: 10}));
  }
  next();
}

// error handler
function _error(err, msg = 'Error:') {
  if(err) {
    if(err.stack) {
      console.log(err.stack);
    } else {
      console.log(err.toString());
    }
    if(typeof err === 'object') {
      const {cause, ...options} = err;
      if(Object.keys(options).length !== 0) {
        console.log(msg, inspect(options, {colors: true, depth: 10}));
      }
      if(cause) {
        _error(cause, 'Error Cause:');
      }
    }
    process.exit(1);
  }
}

// request wrapper to handle primary/secondary loading access
let _primary = true;
async function _jsonldRequest(url, reqOptions, options) {
  const _options = {...reqOptions};
  if(_primary) {
    _options.allow = ALLOW_ALL;
  } else {
    _options.allow = options.allow;
  }
  _primary = false;
  return jsonldRequest(url, _options);
}

// check for HTTP/HTTPS URL
function _isHTTP(url) {
  return (url.indexOf('http://') === 0 || url.indexOf('https://') === 0);
}

// init common command options
function _jsonLdCommand(command) {
  command
    .option('-i, --indent <spaces>', 'spaces to indent [2]', Number, 2)
    .option('-N, --no-newline', 'do not output the trailing newline [newline]')
    .option('-k, --insecure', 'allow insecure connections [false]')
    .option('-a, --allow <list>',
      'allowed secondary resource loaders (none,all,stdin,file,http,https) ' +
      '[http,https]')
    .option('-t, --type <type>', 'input data type [auto]')
    .option('-B, --auto-base', 'use base IRI from source [false]')
    .option('-b, --base <base>', 'base IRI [null]')
    .option('-l, --lint', 'show lint warnings [false]')
    .option('-s, --safe', 'enable safe mode [false]');
  return command;
}

// determine source base
function _getSourceBase(command, input) {
  // stdin
  if(input === '-') {
    return 'stdin://';
  }
  // use input as base if it looks like a URL
  if(_isHTTP(input)) {
    return input;
  }
  // use a file URL otherwise
  return 'file://' + path.resolve(process.cwd(), input);
}

// determine base
function _getBase(command, input) {
  // explicit base set
  if(command.base) {
    return command.base;
  }
  if(command.sourceBase) {
    return _getSourceBase(command, input);
  }
  return null;
}

// init common request options
function _requestOptions(command, input) {
  const options = {};
  if(command.insecure) {
    options.agent = new https.Agent({rejectUnauthorized: false});
  }
  if(command.type) {
    options.dataType = command.type;
  }
  options.base = _getBase(command, input);
  return options;
}

// init common jsonld options
function _jsonLdOptions(command, input) {
  const options = {};

  if(command.allow) {
    // split allow modes
    options.allow = command.allow.split(',');
    if(options.allow.includes('all')) {
      options.allow = ALLOW_ALL;
    } else if(options.allow.includes('none')) {
      options.allow = ALLOW_NONE;
    }
  } else {
    // default to only load secondary HTTP/HTTPS resources
    options.access = ALLOW_DEFAULT;
  }

  if(command.lint) {
    options.eventHandler = _warningHandler;
  }

  if(command.safe) {
    options.safe = true;
  }

  options.base = _getBase(command, input);

  // setup documentLoader
  // FIXME: should be elsewhere
  options.documentLoader = async function documentLoader(url) {
    const reqOpts = _requestOptions(command, url);
    const reqResult = await _jsonldRequest(url, reqOpts, options);
    return {
      contextUrl: null,
      documentUrl: url,
      document: reqResult.data || null
    };
  };

  return options;
}

program
  .on('--help', function() {
    console.log();
    console.log(
      '  The primary input for all commands can be a filename, a URL\n' +
      '  beginning with "http://" or "https://", or "-" for stdin (the\n' +
      '  default). Secondary loaded resources can only be HTTP or HTTPS\n' +
      '  by default for security reasons unless the "-a/--allow" option\n' +
      '  is used.');
    console.log();
    console.log(
      '  Input type can be specified as a standard content type or a\n' +
      '  simple string for common types. See the "request" extension code\n' +
      '  for available types. XML and HTML variations will be converted\n' +
      '  with an RDFa processor if available. If the input type is not\n' +
      '  specified it will be auto-detected based on file extension, URL\n' +
      '  content type, or by guessing with various parsers. Guessing may\n' +
      '  not always produce correct results.');
    console.log();
    console.log(
      '  Output type can be specified for the "format" command and a\n' +
      '  N-Quads shortcut for the "canonize" command. For other commands\n' +
      '  you can pipe JSON-LD output to the "format" command.');
    console.log();
  });

_jsonLdCommand(program.command('format [filename|URL|-]'))
  .description('format and convert JSON-LD')
  .option('-c, --context <filename|URL>', 'context filename or URL')
  .option('-f, --format <format>', 'output format [json]', String)
  .option('-q, --n-quads', 'output application/n-quads [false]')
  .option('-j, --json', 'output application/json [true]')
  .action(async function format(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
    options.format = cmd.format || 'json';
    if(cmd.nQuads) {
      options.format = 'application/n-quads';
    }
    if(cmd.json) {
      options.format = 'application/json';
    }
    if(cmd.context) {
      options.expandContext = cmd.context;
    }

    let result;
    switch(options.format.toLowerCase()) {
      case 'nquads':
      case 'n-quads':
      case 'application/nquads':
      case 'application/n-quads':
        // normalize format for toRDF
        options.format = 'application/n-quads';
        result = await jsonld.toRDF(input, options);
        break;
      case 'json':
      case 'jsonld':
      case 'json-ld':
      case 'ld+json':
      case 'application/json':
      case 'application/ld+json':
        // just doing basic JSON formatting
        const reqOpts = _requestOptions(cmd, input);
        const reqResult = await _jsonldRequest(input, reqOpts, options);
        result = reqResult.data;
        break;
      default:
        throw new Error('ERROR: Unknown format: ' + options.format);
    }

    await _output(result, cmd);
  });

_jsonLdCommand(program.command('lint [filename|URL|-]'))
  .description('lint JSON-LD')
  .action(async function lint(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);

    await jsonld.expand(input, {
      ...options,
      eventHandler: _warningHandler
    });
  });

_jsonLdCommand(program.command('compact [filename|URL]'))
  .description('compact JSON-LD')
  .option('-c, --context <filename|URL>', 'context filename or URL')
  .option('-A, --no-compact-arrays',
    'disable compacting arrays to single values')
  .option('-g, --graph', 'always output top-level graph [false]')
  .action(async function compact(input, cmd) {
    input = input || '-';
    if(!cmd.context) {
      throw new Error('ERROR: Context not specified, use -c/--context');
    }
    const options = _jsonLdOptions(cmd, input);
    options.compactArrays = cmd.compactArrays;
    options.graph = !!cmd.graph;

    const result = await jsonld.compact(input, cmd.context, options);

    await _output(result, cmd);
  });

_jsonLdCommand(program.command('expand [filename|URL|-]'))
  .description('expand JSON-LD')
  .option('-c, --context <filename|URL>', 'context filename or URL')
  .option('    --keep-free-floating-nodes', 'keep free-floating nodes')
  .action(async function expand(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
    if(cmd.context) {
      options.expandContext = cmd.context;
    }
    options.keepFreeFloatingNodes = cmd.keepFreeFloatingNodes;

    const result = await jsonld.expand(input, options);

    await _output(result, cmd);
  });

_jsonLdCommand(program.command('flatten [filename|URL|-]'))
  .description('flatten JSON-LD')
  .option('-c, --context <filename|URL>',
    'context filename or URL for compaction [none]')
  .action(async function flatten(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);

    const result = await jsonld.flatten(input, cmd.context, options);

    await _output(result, cmd);
  });

_jsonLdCommand(program.command('frame [filename|URL|-]'))
  .description('frame JSON-LD')
  .option('-f, --frame <filename|URL>', 'frame to use')
  .option('    --embed <embed>', 'default @embed flag [true]', boolify, true)
  .option('    --explicit <explicit>',
    'default @explicit flag [false]', boolify, false)
  .option('    --omit-default <omit-default>',
    'default @omitDefault flag [false]', boolify, false)
  .action(async function frame(input, cmd) {
    input = input || '-';
    if(!cmd.frame) {
      throw new Error('ERROR: Frame not specified, use -f/--frame');
    }
    const options = _jsonLdOptions(cmd, input);
    options.embed = cmd.embed;
    options.explicit = cmd.explicit;
    options.omitDefault = cmd.omitDefault;

    const result = await jsonld.frame(input, cmd.frame, options);

    await _output(result, cmd);
  });

// TODO: add fromRdf support
//_jsonLdCommand(program.command('fromRdf [filename|URL|-]'))
// ...

_jsonLdCommand(program.command('toRdf [filename|URL|-]'))
  .description('convert JSON-LD into an RdfDataset')
  .option('-f, --format <format>',
    'format to output (\'application/n-quads\' for N-Quads')
  .option('-q, --n-quads', 'use \'application/n-quads\' format')
  .option('-g, --generalized-rdf', 'produce generalized RDF')
  .action(async function toRdf(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
    if(cmd.nQuads) {
      options.format = 'application/n-quads';
    }
    if(cmd.generalizedRdf) {
      options.produceGeneralizedRdf = true;
    }
    if(cmd.format) {
      options.format = cmd.format;
    }

    const result = await jsonld.toRDF(input, options);

    await _output(result, cmd);
  });

_jsonLdCommand(program.command('canonize [filename|URL|-]'))
  .description('canonize JSON-LD')
  .option('-f, --format <format>',
    'format to output (\'application/n-quads\' for N-Quads')
  .option('-q, --n-quads', 'use \'application/n-quads\' format')
  .action(async function canonize(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
    if(cmd.nQuads) {
      options.format = 'application/n-quads';
    }
    if(cmd.format) {
      options.format = cmd.format;
    }

    const result = await jsonld.canonize(input, options);

    await _output(result, cmd);
  });

program
  .parseAsync(process.argv)
  .catch(e => {
    _error(e);
  });
