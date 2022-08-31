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

'use strict';

import https from 'https';
import jsonld from 'jsonld';
import {request} from 'jsonld-request';
import path from 'node:path';
import {program} from 'commander';

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

// error handler
function _error(err) {
  if(err) {
    if(err.stack) {
      console.log(err.stack);
    } else {
      console.log(err.toString());
    }
    if(typeof err === 'object') {
      console.log('Error:', JSON.stringify(err, null, 2));
    }
    process.exit(1);
  }
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
    .option('-t, --type <type>', 'input data type [auto]')
    .option('-b, --base <base>', 'base IRI []');
  return command;
}

// init common request options
function _requestOptions(command) {
  const options = {};
  if(command.insecure) {
    options.agent = new https.Agent({rejectUnauthorized: false});
  }
  if(command.type) {
    options.dataType = command.type;
  }
  return options;
}

// init common jsonld options
function _jsonLdOptions(command, input) {
  const options = {};

  // setup base
  if(command.base) {
    // explicit base set
    options.base = command.base;
  } else if(input !== '-') {
    // only setup base if not stdin
    // use input as base if it looks like a URL
    // use a file URL otherwise
    if(_isHTTP(input)) {
      options.base = input;
    } else {
      options.base = 'file://' + path.resolve(process.cwd(), input);
    }
  }

  // setup documentLoader
  // FIXME: should be elsewhere
  options.documentLoader = async function documentLoader(url) {
    const reqopts = _requestOptions(command);
    const reqresult = await request(url, reqopts);
    return {
      contextUrl: null,
      documentUrl: url,
      document: reqresult.data || null
    };
  };

  return options;
}

program
  .on('--help', function() {
    console.log();
    console.log(
      '  The input parameter for all commands can be a filename, a URL\n' +
      '  beginning with "http://" or "https://", or "-" for stdin (the\n' +
      '  default).');
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
      '  N-Quads shortcut for the "normalize" command. For other commands\n' +
      '  you can pipe JSON-LD output to the "format" command.');
    console.log();
  });

_jsonLdCommand(program.command('format [filename|URL|-]'))
  .description('format and convert JSON-LD')
  .option('-f, --format <format>', 'output format [json]', String)
  .option('-q, --nquads', 'output application/nquads [false]')
  .option('-j, --json', 'output application/json [true]')
  .action(async function format(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
    options.format = cmd.format || 'json';
    if(cmd.nquads) {
      options.format = 'application/nquads';
    }
    if(cmd.json) {
      options.format = 'application/json';
    }

    let result;
    switch(options.format.toLowerCase()) {
      case 'nquads':
      case 'n-quads':
      case 'application/nquads':
        // normalize format for toRDF
        options.format = 'application/nquads';
        result = await jsonld.toRDF(input, options);
        break;
      case 'json':
      case 'jsonld':
      case 'json-ld':
      case 'ld+json':
      case 'application/json':
      case 'application/ld+json':
        // just doing basic JSON formatting
        const reqopts = _requestOptions(cmd);
        const reqresult = await request(input, reqopts);
        result = reqresult.data;
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
      eventHandler: ({event, next}) => {
        console.log(event);
        next();
      }
    });
  });

_jsonLdCommand(program.command('compact [filename|URL]'))
  .description('compact JSON-LD')
  .option('-c, --context <filename|URL>', 'context filename or URL')
  .option('-S, --no-strict', 'disable strict mode')
  .option('-A, --no-compact-arrays',
    'disable compacting arrays to single values')
  .option('-g, --graph', 'always output top-level graph [false]')
  .action(async function compact(input, cmd) {
    input = input || '-';
    if(!cmd.context) {
      throw new Error('ERROR: Context not specified, use -c/--context');
    }
    const options = _jsonLdOptions(cmd, input);
    options.strict = cmd.strict;
    options.compactArrays = cmd.compactArrays;
    options.graph = !!cmd.graph;

    const result = await jsonld.compact(input, cmd.context, options);

    await _output(result, cmd);
  });

_jsonLdCommand(program.command('expand [filename|URL|-]'))
  .description('expand JSON-LD')
  .option('    --keep-free-floating-nodes', 'keep free-floating nodes')
  .action(async function expand(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
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

    await _output(result.process, cmd);
  });

_jsonLdCommand(program.command('normalize [filename|URL|-]'))
  .description('normalize JSON-LD')
  .option('-f, --format <format>',
    'format to output (\'application/nquads\' for N-Quads')
  .option('-q, --nquads', 'use \'application/nquads\' format')
  .action(async function normalize(input, cmd) {
    input = input || '-';
    const options = _jsonLdOptions(cmd, input);
    if(cmd.nquads) {
      options.format = 'application/nquads';
    }
    if(cmd.format) {
      options.format = cmd.format;
    }

    const result = await jsonld.normalize(input, options);

    await _output(result.process, cmd);
  });

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch(e) {
    _error(e);
  }
})();