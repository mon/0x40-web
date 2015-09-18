function HuesSettings(defaults) {
    this.core = null;
    // TODO: HTML5 local storage or something
}

HuesSettings.prototype.connectCore = function(core) {
    this.core = core;
};
/*
//class HuesSettings
package 
{
    import flash.display.*;
    import flash.net.*;
    
    public class HuesSettings extends Object
    {
        public function HuesSettings()
        {
            this.bools = ["imageSmoothing", "blurEnabled", "smartAlign", "autosongShuffle", "blackoutUI"];
            this.numbs = ["autosongDelay"];
            super();
            trace("Settings created");
            this.callbacks = [];
            this.currentSettings = {};
            this.setDefaults();
            this.load();
            return;
        }

        public function set autosongDelay(arg1:int):void
        {
            trace("AutoSong delay:", arg1);
            this.currentSettings["autosongDelay"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set autosongShuffle(arg1:Boolean):void
        {
            trace("Image scaling:", arg1);
            this.currentSettings["autosongShuffle"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set imagescaling(arg1:String):void
        {
            trace("Image scaling:", arg1);
            this.currentSettings["imagescaling"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set colors(arg1:String):void
        {
            trace("Colors:", arg1);
            this.currentSettings["colors"] = arg1;
            this.callCallbacks();
            return;
        }

        internal function setDefaults():void
        {
            this.currentSettings = {"flashQuality":flash.display.StageQuality.HIGH, "imageSmoothing":true, "blurEnabled":true, "blurAmount":"medium", "blurDecay":"high", "channels":"stereo", "smartAlign":true, "buildups":"once", "blendMode":"hard", "ui":"modern", "autosong":"off", "autosongDelay":5, "autosongShuffle":true, "imagescaling":"on", "colors":"normal", "blackoutUI":false};
            return;
        }

        public function defaults():void
        {
            this.setDefaults();
            this.saveSettings();
            return;
        }

        public function getSettingsFromParameters(arg1:Object):void
        {
            var loc1:*=undefined;
            var loc2:*=null;
            if (arg1) 
            {
                var loc3:*=0;
                var loc4:*=arg1;
                for (loc2 in loc4) 
                {
                    loc1 = arg1[loc2];
                    if (this.bools.indexOf(loc2) == -1) 
                    {
                        if (this.numbs.indexOf(loc2) != -1) 
                        {
                            if (loc1.match(new RegExp("\\d+"))) 
                            {
                                loc1 = int(loc1);
                                if (loc2 == "autosongDelay") 
                                {
                                    loc1 = Math.max(1, loc1);
                                }
                            }
                            else 
                            {
                                loc1 = null;
                            }
                        }
                    }
                    else if (loc1 != "true") 
                    {
                        if (loc1 != "false") 
                        {
                            loc1 = null;
                        }
                        else 
                        {
                            loc1 = false;
                        }
                    }
                    else 
                    {
                        loc1 = true;
                    }
                    if (loc1 == null) 
                    {
                        continue;
                    }
                    this.currentSettings[loc2] = loc1;
                }
                this.saveSettings();
                this.callCallbacks();
            }
            return;
        }

        public function saveSettings():void
        {
            var so:flash.net.SharedObject;
            var k:String;

            var loc1:*;
            k = null;
            trace("Saving settings!");
            so = flash.net.SharedObject.getLocal(this.objectName);
            var loc2:*=0;
            var loc3:*=this.currentSettings;
            for (k in loc3) 
            {
                so.data[k] = this.currentSettings[k];
            }
            so.data.saved = true;
            try 
            {
                so.flush();
            }
            catch (e:Error)
            {
                trace("Saving settings failed, oh well");
            }
            return;
        }

        public function load():void
        {
            var loc1:*=flash.net.SharedObject.getLocal(this.objectName);
            if ("saved" in loc1.data) 
            {
                trace("Old settings");
                this.currentSettings = loc1.data;
            }
            else 
            {
                trace("Defaults");
                this.defaults();
            }
            this.callCallbacks();
            return;
        }

        public function set blackoutUI(arg1:Boolean):void
        {
            trace("Blackout UI:", arg1);
            this.currentSettings["blackoutUI"] = arg1;
            this.callCallbacks();
            return;
        }

        public function addCallback(arg1:Function):void
        {
            if (this.callbacks.indexOf(arg1) == -1) 
            {
                this.callbacks.push(arg1);
                arg1();
            }
            return;
        }

        public function callCallbacks():void
        {
            var loc1:*=undefined;
            this.saveSettings();
            var loc2:*=0;
            var loc3:*=this.callbacks;
            for each (loc1 in loc3) 
            {
                loc1();
            }
            return;
        }

        public function get flashQuality():String
        {
            return this.currentSettings["flashQuality"];
        }

        public function get imageSmoothing():Boolean
        {
            return this.currentSettings["imageSmoothing"];
        }

        public function get blurEnabled():Boolean
        {
            return this.currentSettings["blurEnabled"];
        }

        public function get blurAmount():String
        {
            return this.currentSettings["blurAmount"];
        }

        public function get blurDecay():String
        {
            return this.currentSettings["blurDecay"];
        }

        public function get channels():String
        {
            return this.currentSettings["channels"];
        }

        public function get smartAlign():Boolean
        {
            return this.currentSettings["smartAlign"];
        }

        public function get buildups():String
        {
            return this.currentSettings["buildups"];
        }

        public function get blendMode():String
        {
            return this.currentSettings["blendMode"];
        }

        public function get ui():String
        {
            return this.currentSettings["ui"];
        }

        public function get autosong():String
        {
            return this.currentSettings["autosong"];
        }

        public function get autosongDelay():int
        {
            return this.currentSettings["autosongDelay"];
        }

        public function get autosongShuffle():Boolean
        {
            return this.currentSettings["autosongShuffle"];
        }

        public function get imagescaling():String
        {
            return this.currentSettings["imagescaling"];
        }

        public function get colors():String
        {
            return this.currentSettings["colors"];
        }

        public function get blackoutUI():Boolean
        {
            return this.currentSettings["blackoutUI"];
        }

        public function set flashQuality(arg1:String):void
        {
            trace("Flash quality:", arg1);
            this.currentSettings["flashQuality"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set imageSmoothing(arg1:Boolean):void
        {
            trace("Image smoothing:", arg1);
            this.currentSettings["imageSmoothing"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set blurEnabled(arg1:Boolean):void
        {
            trace("Blur:", arg1);
            this.currentSettings["blurEnabled"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set blurAmount(arg1:String):void
        {
            trace("Blur amount:", arg1);
            this.currentSettings["blurAmount"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set blurDecay(arg1:String):void
        {
            trace("Blur decay:", arg1);
            this.currentSettings["blurDecay"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set channels(arg1:String):void
        {
            trace("Channels:", arg1);
            this.currentSettings["channels"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set smartAlign(arg1:Boolean):void
        {
            trace("Smart align:", arg1);
            this.currentSettings["smartAlign"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set buildups(arg1:String):void
        {
            trace("Buildups:", arg1);
            this.currentSettings["buildups"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set blendMode(arg1:String):void
        {
            trace("Blend mode:", arg1);
            this.currentSettings["blendMode"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set ui(arg1:String):void
        {
            trace("UI:", arg1);
            this.currentSettings["ui"] = arg1;
            this.callCallbacks();
            return;
        }

        public function set autosong(arg1:String):void
        {
            trace("AutoSong:", arg1);
            this.currentSettings["autosong"] = arg1;
            this.callCallbacks();
            return;
        }

        internal var currentSettings:Object;

        internal var bools:Array;

        internal var numbs:Array;

        internal var objectName:*="HuesSettings51";

        internal var callbacks:Array;
    }
}


*/