var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var uglify = require('gulp-uglify');
var concat = require("gulp-concat");
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var minifyCSS = require('cssnano');
var order = require("gulp-order");
var del = require('del');
var newer = require('gulp-newer');
var jshint = require('gulp-jshint');
var plumber = require('gulp-plumber');

gulp.task('css', function(){
  return gulp.src('src/css/**/*.css')
    .pipe(order([
        // hlwn must come after modern
        // modern must come after main
        "hues-main.css",
        "huesUI-modern.css",
        "huesUI-hlwn.css"
    ]))
    .pipe(plumber())
    .pipe(newer('css/hues-min.css'))
    .pipe(sourcemaps.init())
		.pipe(postcss([autoprefixer('defaults')]))
    .pipe(concat('hues-min.css'))
		.pipe(postcss([minifyCSS()]))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest('css'));
});

gulp.task("mp3", function () {
  return gulp.src(["src/js/audio/aurora.js", "src/js/audio/mpg123.js"])
    .pipe(newer('lib/audio-min.js'))
    .pipe(concat("audio-min.js"))
    .pipe(uglify())
    .pipe(gulp.dest("lib"));
});

gulp.task("oggvorbis", function () {
  return gulp.src(["src/js/audio/ogg.js", "src/js/audio/vorbis.js"])
    .pipe(newer('lib'))
    .pipe(uglify())
    .pipe(gulp.dest("lib"));
});

gulp.task("audio", gulp.parallel("mp3", "oggvorbis"));

gulp.task("minify", function () {
  return gulp.src("src/js/*.js")
    .pipe(plumber())
    .pipe(newer('lib/hues-min.js'))
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(uglify())
    .pipe(concat("hues-min.js"))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("lib"));
});

gulp.task("lint", function () {
  return gulp.src(["src/js/*.js", '!src/js/string_score.min.js'])
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('default'));
});

gulp.task('default', gulp.parallel('css', 'audio', 'minify'));

gulp.task('watch', gulp.series('default',
  gulp.parallel(
    function() { return gulp.watch('src/css/*.css', gulp.series('css'));},
    function() { return gulp.watch('src/js/*.js', gulp.series('minify'));}
)));

gulp.task('clean', function() {
    return del([
        'lib/hues-min.js',
        'lib/hues-min.map',
        'lib/hues-min.js.map',
        'lib/audio-min.js',
        'lib/ogg.js',
        'lib/vorbis.js',
        'css',
        'release']);
});

gulp.task('release', gulp.series('default', 'lint', function() {
    return gulp.src([
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
  }, function() {
    return gulp.src(['lib/workers/**/*','lib/zip*'], {base: 'lib'})
    .pipe(uglify())
    .pipe(gulp.dest("release/lib"));
}));

function onError(err) {
  gutil.beep();
  console.log(err);
  this.emit('end');
}
