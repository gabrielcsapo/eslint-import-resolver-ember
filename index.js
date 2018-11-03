const fs = require('fs');
const path = require('path');
const resolver = require('resolve');

const { createReferenceMap, isRelative, getExtension } = require('./util');

const pathToCheckRelative = path.resolve(process.cwd(), 'app');
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
        const resolvedPaths = [
          path.resolve(pathToCheckRelative, source),
          path.resolve(path.dirname(file), source),
        ];

        if (resolvedPaths.includes(pathToCheckRelative)) {
          // this is the application path
          return {
            found: true,
            path: path.resolve(
              resolvedPaths[resolvedPaths.indexOf(pathToCheckRelative)],
              'app.js'
            ),
          };
        } else {
          for (const resolvedPath of resolvedPaths) {
            try {
              const theoreticallyWhereItShouldLive =
                resolvedPath + getExtension(resolvedPath);

              if (fs.existsSync(theoreticallyWhereItShouldLive)) {
                return {
                  found: true,
                  path: theoreticallyWhereItShouldLive,
                };
              }
            } catch (ex) {
              // noop
            }
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
