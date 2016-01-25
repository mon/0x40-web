# 0x40-web
A fairly complete HTML5/CSS3 Canvas + Web Audio clone of the 0x40 Hues Flash.

Should work on most modern browsers.

## Example pages:  
[Default Hues](http://0x40.mon.im/)  
[420 Hues](http://420.mon.im/)  
[Halloween Hues](http://spook.mon.im/)

You can also have animations that sync perfectly with the beats of the songs. Inspired by Kepstin's Integral experiments.  
[420 Hues, Snoop Edition](http://420.mon.im/snoop.html)  
["Montegral"](http://0x40.mon.im/montegral.html) 

## Install (Make your own Hues)
1. Start by downloading the latest [release](https://github.com/mon/0x40-web/releases). These are minified and load faster.
2. Put your respack zips somewhere they can be found by your web server. My hues have a `respacks/` folder under the main directory.
3. Edit the Javascript that runs on page load
  1. If your html is in a different location to your `lib` folder:
    * Edit `workersPath` to point to the correct (relative) location.
  3. Edit the `defaults` object so the `respacks` list contains the respacks you wish to load.
  3. *Optional:* Add any extra settings to the `defaults` object.
  4. Upload everything to your server!

### Example settings  
```javascript
var defaults = {
    workersPath : "lib/workers/",
    respacks : ["./respacks/Defaults_v5.0.zip", 
                "./respacks/HuesMixA.zip"
                ],
    firstSong : "Nhato - Miss You",
};
```

## Settings object  
See [HuesSettings.js](https://github.com/mon/0x40-web/blob/master/js/HuesSettings.js#L23) for the possible options you can put into the `defaults` object.

## Building
Install [Node.js](https://nodejs.org/en/), v5 preferred.  
Install the required packages for the build:
```bash
npm install gulp -g
npm install gulp-sourcemaps gulp-babel babel-preset-es2015 gulp-uglify gulp-concat gulp-cssnano gulp-autoprefixer gulp-order del
```
Build with `gulp`. Make a release folder with `gulp release`. For seamless development, auto-minify changed filed with `gulp watch`.