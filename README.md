# eslint-import-resolver-ember

> 🗺 import resolver for ember

## Installation

```
npm install eslint-import-resolver-ember --save-dev
```

## Usage

```js
rules: {
  'import/no-unresolved': [2, { ignore: ['^\@ember', 'htmlbars-inline-precompile'] }]
},
settings: {
  'import/resolver': 'eslint-import-resolver-ember',
},
```

If you have custom paths that you would like to expose simply add options to settings:

```
settings: {
  'import/resolver': 'eslint-import-resolver-ember': {
    customModuleMapping: {
      'foo': '@gabrielcsapo/foo'
    },
    customPathMappings: {
      'testing-foo/*': 'testing-foo/addons/*'
    }
  },
},
```
