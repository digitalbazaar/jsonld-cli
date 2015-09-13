jsonld-cli
==========

[![Dependency Status](https://img.shields.io/david/digitalbazaar/jsonld-cli.svg)](https://david-dm.org/digitalbazaar/jsonld-cli)

Introduction
------------

This module provides a command line tool `jsonld` to manipulate [JSON-LD][]
data. It is written in JavaScript for [node.js][] and uses the [jsonld.js][]
and [jsonld-request][]. Inputs can be from stdin, URLs, or files.

## Requirements

* [node.js][]
* [npm][]

## Installation

```
npm install -g jsonld-cli
```

## Usage

The `jsonld` command line tool can be used to:

 * Transform JSON-LD to compact, expanded, normalized, or flattened form
 * Transform RDFa to JSON-LD
 * Normalize JSON-LD/RDFa Datasets to NQuads

To show tool options, a list of commands, or command options:

    jsonld --help
    jsonld COMMAND --help

To compact a document on the Web using a JSON-LD context published on
the Web:

    jsonld compact -c "https://w3id.org/payswarm/v1" "http://recipes.payswarm.com/?p=10554"

The command above will read in a PaySwarm Asset and Listing in RDFa 1.0 format,
convert it to JSON-LD expanded form, compact it using the
'https://w3id.org/payswarm/v1' context, and dump it out to the console in
compacted form.

    jsonld normalize -q "http://recipes.payswarm.com/?p=10554"

The command above will read in a PaySwarm Asset and Listing in RDFa 1.0 format,
normalize the data using the RDF Dataset normalization algorithm, and
then dump the output to normalized NQuads format. The NQuads can then be
processed via SHA-256, or similar algorithm, to get a deterministic hash
of the contents of the Dataset.

Commercial Support
------------------

Commercial support for this library is available upon request from
[Digital Bazaar][]: support@digitalbazaar.com

Source Code
-----------

http://github.com/digitalbazaar/jsonld-cli

[Digital Bazaar]: http://digitalbazaar.com/
[JSON-LD]: http://json-ld.org/
[RDFa]: http://www.w3.org/TR/rdfa-core/
[json-ld.org]: https://github.com/json-ld/json-ld.org
[jsonld-request]: https://github.com/digitalbazaar/jsonld-request
[jsonld.js]: https://github.com/digitalbazaar/jsonld.js
[node.js]: https://nodejs.org/
[npm]: https://npmjs.org/
