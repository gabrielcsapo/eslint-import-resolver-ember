const fs = require('fs');
const path = require('path');
const resolver = require('resolve');

const pathToCheckRelative = path.resolve(process.cwd(), 'app');

function createDirectoryReferenceMap(directoryName, packageData) {
  let name = packageData['name'];

  try {
    // make sure we check the build artifacts to make sure the name was defined here as well
    const index = require(path.resolve(directoryName, 'index.js'));

    if (index.name) {
      name = index.name;
    }
  } catch (ex) {
    // noop
  }

  return {
    [`${name}/*`]: `${directoryName}/addon/*`,
    [`${name}/test-support/*`]: `${directoryName}/addon-test-support/*`,
  };
}

function createReferenceMap(addonSources, options = {}, alreadySearched = {}) {
  const { extraImportSources } = options;

  let directoriesReferenceMap = {};

  addonSources.concat(extraImportSources).forEach(addonSource => {
    try {
      const directoryNames = fs.readdirSync(addonSource);

      [addonSource, ...directoryNames].forEach(directoryName => {
        const currentDirectory = path.resolve(addonSource, directoryName);

        if (
          !path.extname(currentDirectory) &&
          fs.existsSync(path.resolve(currentDirectory, 'package.json'))
        ) {
          // make sure we don't loop over ourselves
          if (!alreadySearched[currentDirectory]) {
            alreadySearched[currentDirectory] = true;
          } else {
            return;
          }

          const packageData = require(path.resolve(
            currentDirectory,
            'package.json'
          ));

          const directoryReferenceMap = createDirectoryReferenceMap(
            directoryName,
            packageData,
            addonSource,
            addonSources
          );

          directoriesReferenceMap = {
            ...directoryReferenceMap,
            ...directoriesReferenceMap,
          };

          const subDirectoryReferenceMap = createReferenceMap(
            getPossiblePathsFromPackage(
              packageData,
              directoryName,
              alreadySearched
            ),
            options,
            alreadySearched
          );

          if (subDirectoryReferenceMap) {
            directoriesReferenceMap = {
              ...subDirectoryReferenceMap,
              ...directoriesReferenceMap,
            };
          }
        }
      });
    } catch (ex) {
      // we don't care about errors
    }
  });

  return directoriesReferenceMap;
}

function getPossiblePathsFromPackage(
  packageData = {},
  parentDirectory = '',
  alreadySearched = {}
) {
  let possiblePaths = [];
  const dependencies = packageData['dependencies'];
  const emberAddon = packageData['ember-addon'];

  if (emberAddon && emberAddon['apps']) {
    possiblePaths = possiblePaths.concat(
      emberAddon['apps'].map(p =>
        path.resolve(process.cwd(), parentDirectory, p)
      )
    );
  }

  if (emberAddon && emberAddon['paths']) {
    possiblePaths = possiblePaths.concat(
      emberAddon['paths'].map(p =>
        path.resolve(process.cwd(), parentDirectory, p)
      )
    );
  }

  if (dependencies) {
    const foundDependencies = Object.keys(dependencies)
      .filter(dependency => {
        return dependency.match(/\/ember/) || dependency.match(/^ember/);
      })
      .map(dependency => {
        return path.dirname(
          resolver.sync(dependency, { basedir: process.cwd() })
        );
      })
      .filter(fullPath => !alreadySearched[fullPath]);

    possiblePaths = possiblePaths.concat(foundDependencies || []);
  }

  return possiblePaths;
}

function isRelative(source) {
  return source[0] === '.';
}

function getExtension(absolutePath) {
  return absolutePath.indexOf('templates') > -1 ? '.hbs' : '.js';
}

const referenceMap = createReferenceMap([
  path.resolve(process.cwd(), 'app'),
  process.cwd(),
]);

exports.interfaceVersion = 2;
exports.resolve = function resolve(source, file, config) {
  const { customPathMappings = {}, customModuleMapping = {} } = config || {};

  // TODO: write a test for this (when someone explicitly overrides a node_modules namespace)
  if (Object.keys(customModuleMapping).length > 0) {
    const baseModuleName = source.split('/')[0];
    const mappingExists = customModuleMapping[baseModuleName];

    if (mappingExists) {
      source = source.replace(baseModuleName, mappingExists);
    }
  }

  try {
    try {
      const resolvedPath = resolver.sync(source, { basedir: process.cwd() });

      return {
        found: true,
        path: resolvedPath,
      };
    } catch (ex) {
      if (isRelative(source)) {
        const resolvedPath = path.resolve(pathToCheckRelative, source);

        if (resolvedPath === pathToCheckRelative) {
          // this is the application path
          return {
            found: true,
            path: path.resolve(resolvedPath, 'app.js'),
          };
        } else {
          const theoreticallyWhereItShouldLive =
            resolvedPath + getExtension(resolvedPath);

          if (fs.existsSync(theoreticallyWhereItShouldLive)) {
            return {
              found: true,
              path: theoreticallyWhereItShouldLive,
            };
          }
        }
      } else {
        const combinedReferencMap = { ...referenceMap, ...customPathMappings };

        const found = Object.keys(combinedReferencMap).filter(match => {
          const reg = new RegExp(`^${match}`);

          return reg.exec(source);
        });

        if (found.length > 0) {
          const foundMostRelevant = found.reduce(function(a, b) {
            return a.length > b.length ? a : b;
          });
          const partFoundCheck = new RegExp(
            `^${foundMostRelevant.replace('*', '(.+?)$')}`
          );
          const partFound = partFoundCheck.exec(source);

          const theoreticallyWhereItShouldLive = path.resolve(
            process.cwd(),
            combinedReferencMap[foundMostRelevant].replace(
              '*',
              partFound[1] + getExtension(partFound[1])
            )
          );

          if (fs.existsSync(theoreticallyWhereItShouldLive)) {
            return {
              found: true,
              path: theoreticallyWhereItShouldLive,
            };
          } else {
            return { found: false };
          }
        }
      }

      return { found: false };
    }
  } catch (ex) {
    return { found: false };
  }
};
