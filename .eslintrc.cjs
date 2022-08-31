module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: [
    'digitalbazaar',
    'digitalbazaar/module',
    'digitalbazaar/jsdoc'
  ],
  rules: {
    'unicorn/prefer-node-protocol': 'error'
  }
};
