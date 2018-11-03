const test = require('tape');
const path = require('path');

const {
  isRelative,
  getExtension,
  createDirectoryReferenceMap,
  createReferenceMap,
  getPossiblePathsFromPackage,
} = require('../util');

test('@util', t => {
  t.test('@isRelative', t => {
    t.test('should validate a relative path', t => {
      t.plan(2);

      t.ok(isRelative('../foo'));
      t.ok(isRelative('./foo'));
    });

    t.test('should invalidate a non-relative path', t => {
      t.plan(2);

      t.notOk(isRelative('foo'));
      t.notOk(isRelative('@ember/foo'));
    });
  });

  t.test('@getExtension', t => {
    t.test('should retrieve extensions correctly', t => {
      t.plan(2);

      t.equal(getExtension('templates/foo'), '.hbs');
      t.equal(getExtension('./component/foo'), '.js');
    });
  });

  t.test('@createDirectoryReferenceMap', t => {
    t.test(
      'should be able to retreive reference map with only packageData',
      t => {
        t.plan(1);

        const directoryReferenceMap = createDirectoryReferenceMap(
          'foo/bar/foo',
          {
            name: 'foo',
          }
        );

        t.deepEqual(directoryReferenceMap, {
          'foo/*': 'foo/bar/foo/addon/*',
          'foo/test-support/*': 'foo/bar/foo/addon-test-support/*',
        });
      }
    );

    t.test(
      'should be able to retreive reference map with packageData and index.js with overriden name',
      t => {
        t.plan(1);

        const directoryReferenceMap = createDirectoryReferenceMap(
          path.resolve(
            __dirname,
            'fixtures/@createDirectoryReferenceMap-directory-with-index'
          ),
          {
            name: 'foo',
          }
        );

        t.deepEqual(directoryReferenceMap, {
          'bar/*': path.resolve(
            __dirname,
            'fixtures',
            '@createDirectoryReferenceMap-directory-with-index',
            'addon/*'
          ),
          'bar/test-support/*': path.resolve(
            __dirname,
            'fixtures',
            '@createDirectoryReferenceMap-directory-with-index',
            'addon-test-support/*'
          ),
        });
      }
    );
  });

  t.test('@getPossiblePathsFromPackage', t => {
    t.plan(1);

    const possiblePaths = getPossiblePathsFromPackage(
      require(path.resolve(
        __dirname,
        'fixtures',
        '@getPossiblePathsFromPackage-basic-paths',
        'package.json'
      )),
      path.resolve(
        __dirname,
        'fixtures',
        '@getPossiblePathsFromPackage-basic-paths'
      )
    );

    t.deepEqual(possiblePaths, [
      path.resolve(
        __dirname,
        'fixtures',
        '@getPossiblePathsFromPackage-basic-paths',
        'bar'
      ),
      path.resolve(
        __dirname,
        'fixtures',
        '@getPossiblePathsFromPackage-basic-paths',
        'foo'
      ),
    ]);
  });

  t.test('@createReferenceMap', t => {
    t.test('should be able to handle nested apps use case', t => {
      t.plan(1);

      const fixturesDirectory = path.resolve(
        __dirname,
        'fixtures',
        '@createReferenceMap-nested-apps'
      );
      const referenceMap = createReferenceMap(
        getPossiblePathsFromPackage(
          require(path.resolve(
            __dirname,
            'fixtures',
            '@createReferenceMap-nested-apps',
            'package.json'
          )),
          fixturesDirectory
        )
      );

      t.deepEqual(referenceMap, {
        'foo-bar/*': `${fixturesDirectory}/foo/lib/foo-bar/addon/*`,
        'foo-bar/test-support/*': `${fixturesDirectory}/foo/lib/foo-bar/addon-test-support/*`,
        'foo/*': `${fixturesDirectory}/foo/addon/*`,
        'foo/test-support/*': `${fixturesDirectory}/foo/addon-test-support/*`,
        'bar-foo/*': `${fixturesDirectory}/bar/lib/bar-foo/addon/*`,
        'bar-foo/test-support/*': `${fixturesDirectory}/bar/lib/bar-foo/addon-test-support/*`,
        'bar/*': `${fixturesDirectory}/bar/addon/*`,
        'bar/test-support/*': `${fixturesDirectory}/bar/addon-test-support/*`,
      });
    });
  });
});
