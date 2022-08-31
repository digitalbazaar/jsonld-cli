# jsonld-cli ChangeLog

## 1.0.0 - 2022-xx-xx

## Changed
- **BREAKING**: Update dependencies. Likely behavior changes since last release.
- **BREAKING**: Change `--nquads` option to `--n-quads`.
- **BREAKING**: Requre Node.js >=14.

## Added
- Add `toRdf` command.
- Add `lint` command. Note that this uses currently private unstable
  [jsonld.js][] APIs.
- Add `safe` mode to commands.

## 0.3.0 - 2018-07-06

## Changed
- *BREAKING*: Update dependencies. Includes update to jsonld.js 1.x which fixes
  bugs but could also cause some behavior changes. Future updates will include
  more processing control flags.

## 0.2.0 - 2017-12-18

## Changed
- Updated dependencies.

## 0.1.0 - 2015-09-12

### Added
- Command line interface tool from [jsonld.js][].

[jsonld.js]: https://github.com/digitalbazaar/jsonld.js
