/* README for mon
 * download zip.js from here http://gildas-lormeau.github.io/zip.js/
 * place all .js from zip.js in lib/
 * place this file also somewhere in the webserver dir
 * add lib/zip.js, lib/zip-fs.js and this file as scripts
 * call respackInit() from somewhere.
 * Enjoy the filepicker.
 *
 * Limitations:
 * - does not load images yet
 * - cannot unload respacks
 *
 */

function respackParseSongs(songsxml){
  var oParser = new DOMParser();
  var oDOM = oParser.parseFromString(songsxml, "text/xml");
  var songList = [];
  if(oDOM.documentElement.nodeName !== "songs"){
    console.log("Songs.xml error, corrupt file?")
    return songList;
  }

  var domsonglist = oDOM.documentElement.children;
  for (var i = 0; i < domsonglist.length; i++){
    var filename = domsonglist[i].attributes[0].value + ".mp3";
    var rhythm = domsonglist[i].getElementsByTagName('rhythm')[0].textContent;
    var title = domsonglist[i].getElementsByTagName('title')[0].textContent;
    var source = domsonglist[i].getElementsByTagName('source')[0] && domsonglist[i].getElementsByTagName('source')[0].textContent;
    var buildUp = domsonglist[i].getElementsByTagName('buildup')[0] && domsonglist[i].getElementsByTagName('buildup')[0].textContent;
    var buildUpRhythm = domsonglist[i].getElementsByTagName('buildupRhythm')[0] && domsonglist[i].getElementsByTagName('buildupRhythm')[0].textContent;

    if (buildUp && !buildUpRhythm){
      buildUpRhythm = "."; //Add a empty rhythm
    }


    var result = {
      pack: packno,
      file: filename,
      name: title,
      source: source,
      rhythm: rhythm
    }
    if(buildUp){
      result.buildUp = buildUp + ".mp3";
      result.buildUpRhythm = buildUpRhythm;
    }
    songList[i] = result;
  }

  return songList;

}


function respackFindBuildUpData(song, songsDir, onend){
  songsDir.children.forEach(function(entry) {
    var buildupFile = song.buildUp;
    if (buildupFile === entry.name) {

      entry.getData64URI("audio/mpeg", function(data) {

        onend(data);
      });
    }
  });
}

function respackFindSongData(song, songsDir, onend){
  songsDir.children.forEach(function(entry) {
    var songfile = song.file;
    if (songfile === entry.name) {

      entry.getData64URI("audio/mpeg", function(data) {

        onend(data);
      });
    }

  })
}


function respackIsLoaded(packname){
  for (var i = 0; i < respacksLoaded.length; i++) {
    if(respacksLoaded[i].name === packname ){
      return true;
    }
  }
  return false;
}

function respackInit(audio) {

  //Add array.find() for chrome
  if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      var value;

      for (var i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) {
          return value;
        }
      }
      return undefined;
    };
  }

  zip.workerScriptsPath = 'lib/';
  respacksLoaded = [];
  packno = 4;
  function addGlobalSong(song){
    audio.songs[audio.songs.length] = song;
  }
  var fileInput = document.getElementById("respack-input");
  if(!audio || !audio.songs ){
    console.log("invalid audio object, bailing...");
    if(fileInput){
      fileInput.remove();
    }

  }


  function respackHandleZipFile(event) {
    var fileInput = document.getElementById("respack-input");

    var fs = new zip.fs.FS();

    fs.importBlob( fileInput.files[0], function() {

      if(fs.root.children.length === 1){
        rootdir = fs.root.children[0]
        var basename = rootdir.name;
        //Packshit respack is giving me headaches, this "fixes" the directory structure like Packshit.zip/Packshit/Packshit/songs.xml
        if(rootdir.children.length == 1 && rootdir.children[0].name == basename){
          rootdir = rootdir.children[0];
        }
        if(respackIsLoaded(basename)){
          alert("respack " + basename + " already loaded!");
          return;
        }else{
          respacksLoaded[respacksLoaded.length] = {name: basename, packno: packno};
        }
        console.log("Loading " + basename+".zip");
        //Find files of iterest
        var songsXML = rootdir.children.find(function(element,index, array){
          if( element.name.toLowerCase() === "songs.xml"){
            return element;
          }
          return false;
        });

        var songsDir = rootdir.children.find(function(element,index, array){
          if( element.directory && (element.name.toLowerCase() === "songs" || element.name.toLowerCase() === "loops")   ){
            return element;
          }
          return false;
        });
        songsXML.getText(function(text){
          text = text.replace(/&/g, '&amp;amp;'); //XML parser will complain about a bare '&', found in the Packshit respack
          var songList = respackParseSongs(text);
          songList.forEach(function(song, index, arr){
            if(song.buildUp){
              respackFindBuildUpData(song, songsDir, function(data){
                song.buildUp = data;

              });
            }
            respackFindSongData(song, songsDir, function(data){
              song.file = data;
              addGlobalSong(song);
            });

            if( index === (arr.length-1)){

              packno += 1;
              fs = null; //or somethin
            }
          });

        });

      }

    }, function(error) {
      // onerror callback
      console.log("Error loading zip file!");
    });
    this.value = null; //Chrom*
    return false; //Firefox
  }
  if(!fileInput){
    //create a file input
    fileInput = document.createElement("input");
    fileInput.type ="file"
    fileInput.accept="application/zip"
    fileInput.id="respack-input"
    var controls = document.getElementById("controls");
    controls.appendChild(fileInput);

  }
  fileInput.addEventListener('change', respackHandleZipFile, false);


}
