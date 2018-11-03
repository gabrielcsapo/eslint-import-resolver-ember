const fs = require('fs');
const path = require('path');
const resolver = require('resolve');

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

        // make sure the path isn't a file, but a directory
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
            currentDirectory,
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

module.exports = {
  createDirectoryReferenceMap,
  createReferenceMap,
  getPossiblePathsFromPackage,
  isRelative,
  getExtension
};
