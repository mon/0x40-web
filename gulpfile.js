var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var uglify = require('gulp-uglify');
var concat = require("gulp-concat");
var minifyCSS = require('gulp-cssnano');
var autoprefixer = require('gulp-autoprefixer');
var order = require("gulp-order");
var del = require('del');
var jshint = require('gulp-jshint');

gulp.task('default', ['css', 'audio', 'minify'], function() {
    
});

gulp.task('css', function(){
  return gulp.src('src/css/**/*.css')
    .pipe(order([
        "style.css",    // base
        "hues-m.css",   // modern
        "hues-x.css",   //   xmas
        "hues-h.css",   //   hlwn
        "hues-r.css",   // retro
        "hues-w.css"    //   weed
    ]))
    .pipe(sourcemaps.init())
    .pipe(autoprefixer('last 2 version', 'ios 6', 'android 4'))
    .pipe(concat('hues-min.css'))
    .pipe(minifyCSS())
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest('css'));
});

gulp.task("audio", function () {
  gulp.src(["src/js/audio/aurora.js", "src/js/audio/mpg123.js"])
  .pipe(concat("audio-min.js"))
  .pipe(uglify())
  .pipe(gulp.dest("lib"));
    
  gulp.src(["src/js/audio/ogg.js", "src/js/audio/vorbis.js"])
  .pipe(uglify())
  .pipe(gulp.dest("lib"));
});

gulp.task("minify", function () {
  return gulp.src("src/js/*.js")
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(uglify())
    .pipe(concat("hues-min.js"))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("lib"));
});

gulp.task("lint", function () {
  return gulp.src("src/js/*.js")
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('default'));
});

gulp.task('watch', ['default'], function() {
  gulp.watch('src/css/*.css', ['css']);
  gulp.watch('src/js/*.js', ['minify']);
});

gulp.task('clean', function() {
    return del([
        'lib/hues-min.js',
        'lib/hues-min.map',
        'lib/audio-min.js',
        'lib/ogg.js',
        'lib/vorbis.js',
        'css',
        'release']);
});

gulp.task('release', ['default', 'lint'], function() {
    gulp.src([
        'css/hues-min.css',
        'lib/hues-min.js',
        'lib/audio-min.js',
        'lib/ogg.js',
        'lib/vorbis.js',
        'fonts/**/*',
        'img/**/*',
        'index.html',
        'favicon.ico'], {
            base: '.'
    }).pipe(gulp.dest('release'));
    
    gulp.src(['lib/workers/**/*','lib/zip*'], {base: 'lib'})
    .pipe(uglify())
    .pipe(gulp.dest("release/lib"));
});