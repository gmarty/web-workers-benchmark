/**
 * IMPORTANT: This file is installed into the app directory as part of the
 * npm install fxos-build process. Please do not try to modify this file
 * or create additional build steps without checking with the team first.
 *
 * For any build system feature requests or bugs, please open
 * an issue in the fxos-build project: https://github.com/fxos/build/issues
 */

var gulp = require('gulp');

var buildModules = __dirname + '/node_modules/fxos-build/node_modules/';
var concat = require(buildModules + 'gulp-concat');
var to5 = require(buildModules + 'gulp-6to5');
var jshint = require(buildModules + 'gulp-jshint');
var zip = require(buildModules + 'gulp-zip');
var del = require(buildModules + 'del');
var runSequence = require(buildModules + 'run-sequence');
var webserver = require(buildModules + 'gulp-webserver');

const APP_ROOT = './app/';
const DIST_ROOT = './dist/';
const DIST_APP_ROOT = './dist/app/';

/**
 * runs jslint on all javascript files found in the app dir.
 */
gulp.task('lint', function () {
  // Note: To have the process exit with an error code (1) on
  //  lint error, return the stream and pipe to failOnError last.
  return gulp.src([
      './app/js/**/*.js',
      '!./app/js/components/**/*.js'
    ])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

/**
 * copies necessary files for the 6to5 amd loader to the app.
 */
gulp.task('loader-polyfill', function () {
  return gulp.src(['./node_modules/fxos-build/app_files/loader_polyfill/*.js'])
    .pipe(concat('initapp.js'))
    .pipe(gulp.dest(DIST_APP_ROOT + 'js'));
});

/**
 * Copy all non-js directory app source/assets/components.
 */
gulp.task('copy-app', function() {
  return gulp.src([
    APP_ROOT + '**',
    '!' + APP_ROOT + 'js/**/*.js' // do not copy js
    ])
    .pipe(gulp.dest(DIST_APP_ROOT));
});

/**
 * converts javascript to es5. this allows us to use harmony classes and modules.
 */
gulp.task('to5', function () {
  var files = [
    APP_ROOT + 'js/**/*.js',
    ];

  try {
    return gulp.src(files)
      .pipe(to5({
          modules: 'amd'
        }).on('error', function(e) {
          console.log('error running 6to5', e);
        })
      )
      .pipe(gulp.dest(DIST_APP_ROOT + 'js/'));
  }  catch(e) {
    console.log('Got error in 6to5', e);
  }
});

/**
 * Packages the application into a zip.
 */
gulp.task('zip', function () {
  return gulp.src(DIST_APP_ROOT)
    .pipe(zip('app.zip'))
    .pipe(gulp.dest(DIST_ROOT));
});

/**
 * Runs travis tests
 */
gulp.task('travis', ['lint', 'loader-polyfill', 'to5']);

/**
 * Build the app.
 */
gulp.task('build', function(cb) {
  runSequence(['clobber'], ['loader-polyfill', 'copy-app'], ['to5', 'lint'], cb);
});

/**
 * Watch for changes on the file system, and rebuild if so.
 */
gulp.task('watch', function() {
  gulp.watch([APP_ROOT + '**'], ['build']);
});

gulp.task('webserver', function() {
  gulp.src('dist/app')
    .pipe(webserver({
      port: process.env.PORT || 8000,
      host: process.env.HOSTNAME || 'localhost',
      livereload: false,
      directoryListing: false,
      open: false
    }));
});

/**
 * The default task when `gulp` is run.
 * Adds a listener which will re-build on a file save.
 */
gulp.task('default', function() {
  runSequence('build', 'webserver', 'watch');
});

/**
 * Remove the distributable files.
 */
gulp.task('clobber', function(cb) {
  del('dist/', cb);
});

/**
 * Cleans all created files by this gulpfile, and node_modules.
 */
gulp.task('clean', function (cb) {
  del([
    '.bowerrc',
    '.editorconfig',
    '.git/hooks/pre-commit',
    '.jshintrc',
    'dist/',
    'app/components',
    'node_modules/',
    'gulpfile.js'
  ], cb);
});
