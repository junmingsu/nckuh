/**
 * @param {string} iframe_name iframe name
 */
function DiveLinker(iframe_name, option) {
    this.iframeName = iframe_name;
    this.loadingStatus = false;
    this.initial = false;
    this.watermark = true;
    this.isComplete = false;
    this.isDebug = false;
    this.updateOutput = false;
    this.diveStatus = "init";
    this.IOList = {
        inValue: [],
        outValue: []
    };
    this.inputList = {};
    this.outputList = {};
    this.autoShakehand = true;
    this.target = document.querySelector("iframe[name=" + iframe_name + "]");
    this.error = (this.target == null) ? true : false;
    if (this.error) return this.showError()
    this._window = (this.target == null) ? null : this.target.contentWindow;
    this.bindHandle();
    if (option) {
        for (const key in option) {
            if (option.hasOwnProperty(key)) {
                this[key] = option[key]
            }
        }
    }
}

DiveLinker.prototype = (function () {
    function receiveMsg(event) {
        if (!event) return
        let linker = this;

        try {
            let title = event.data.title;
            let data = event.data.data;
            let id = event.data.id;
            if (linker.isDebug) console.log("title:" + title);
            if (linker.isDebug) console.log("data:" + JSON.stringify(data));
            if (!id) return linker.shakeHand()
            if (id !== linker._id) return
            let doByType = {
                "in_out_attr": function (data) {
                    if (linker.initial) return
                    linker.inputList = {};
                    linker.outputList = {};
                    let IOList = linker.IOList = data[0];
                    for (let i = 0; i < IOList.inValue.length; i++) {
                        const input = IOList.inValue[i];
                        linker.inputList[input.id] = input;
                    }
                    for (let i = 0; i < IOList.outValue.length; i++) {
                        const output = IOList.outValue[i];
                        linker.outputList[output.id] = output;
                    }
                    linker.initial = true;
                    // linker.shakeHand();
                },
                "status": function (data) {
                    linker.loadingStatus = data;
                },
                "r_out_val2": function (data) {

                    for (let i = 0; i < data.length; i++) {
                        const out = data[i];
                        linker.outputList[out.id] = out
                    }
                    linker.updateOutput = true;
                },
                "complete": function (data) {
                    if (linker.isComplete) return
                    linker.isComplete = true;
                },
                "sendError": function (data) {
                    if (linker.isDebug) console.log(data)
                },
                "checkError": function (data) {
                    if (linker.isDebug) console.log(data)
                },
                "dive_status": function (data) {
                    if (linker.isDebug) console.log(data)
                    linker.diveStatus = data;
                },
                "getLog": function (data) {
                    linker.log = data;
                },
                "getProject":function(data){
                    linker.project =data;
                }
            }
            if (typeof doByType[title] !== 'function') {
                console.log("title not support :" + title);
            }
            return doByType[title](data);
        } catch (e) {
            console.log("receive IO with error:" + e);
            console.log(event);
        }
    }
    const soup_ = '!#%()*+,-./:;=?@[]^_`{|}~' +
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const uid = function () {
        const length = 20;
        const soupLength = soup_.length;
        const id = [];
        for (let i = 0; i < length; i++) {
            id[i] = soup_.charAt(Math.random() * soupLength);
        }
        return id.join('');
    };

    return {
        constructor: DiveLinker,
        "post": function (msg) {
            if (this.error) return this.showError()
            this._window.postMessage(msg, "*");
        },
        /**
         * show error log if exist. most situation => not found iframe => put error name 
         * @method  
         * @name showError#DiveLinker
         * @param {string} msg 
         */
        "showError": function (msg) {
            if (msg) return console.error(msg)
            console.error(this.defaultErrorMsg)
        },
        "bind": function (func) {
            let linker = this;
            return function () {
                return func.apply(linker, arguments)
            }
        },
        "bindHandle": function () {
            window.addEventListener("message", this.bind(receiveMsg), false);
        },
        "removeHandle": function () {
            window.removeEventListener("message", receiveMsg())
        },
        /**
         * shwo hide waterMark
         * @param {boolean} enable 
         */
        "enableBlock": function (enable) {
            let d = {
                title: "setBlock",
                data: enable
            }
            this.post(d)
        },
        "fullScreen": function (iframe_name) {
            let iframe = (iframe_name) ? document.querySelector("iframe[name=" + iframe_name + "]") : this.target;
            full();

            function full() {
                if (!iframe) return
                if (iframe.requestFullscreen) {
                    iframe.requestFullscreen();
                } else if (iframe.webkitRequestFullscreen) {
                    iframe.webkitRequestFullscreen();
                } else if (iframe.mozRequestFullScreen) {
                    iframe.mozRequestFullScreen();
                } else if (iframe.msRequestFullscreen) {
                    iframe.msRequestFullscreen();
                }
            }
        },
        "shakeHand": function () {
            if (!this.autoShakehand) return
            this._id = uid();
            let d = {
                title: "shakeHand",
                data: this._id
            }
            this.post(d)
            return this._id
        },
        get id() {
            return this._id;
        },
        set id(id) {
            id = (!id) ? uid() : id;
            if (this._id) return
            this._id = id;
            let d = {
                title: "shakeHand",
                data: this._id
            }
            this.post(d)
            return this._id
        },
        /**
         * 
         * @param {string} newName new iframe  post name u want to reConnect
         */
        "changetTarget": function (newName) {
            this.iframeName = newName;
            this.target = document.querySelector("iframe[name=" + newName + "]");
            this.error = (this.target == null) ? true : this.error;
            this._window = (this.target == null) ? null : this.target.contentWindow;
            this.reset();
        },
        /**
         * 
         * @param {string} aid 
         * @param {string} value
         * @param {boolean} lockIO
         */
        "setInput": function (aid, value, lockIO) {
            let d = {
                title: "in_val",
            };
            const type = typeof aid;
            switch (type) {
                case "object":
                    d.data = {
                        'in_data': aid
                    }
                    break;
                case "number":
                case "string": {
                    let obj = [{
                        id: aid,
                        value: value,
                        lockIO: lockIO
                    }];
                    d.data = {
                        in_data: obj
                    }
                }
                break;
            default:
                break;
            }
            return this.post(d)
        },
        "setInputToParent": function (aid, value, lockIO) {
            let d = {
                title: "in_val",
            };
            const type = typeof aid;
            switch (type) {
                case "object":
                    d.data = {
                        'in_data': aid
                    }
                    break;
                case "number":
                case "string": {
                    let obj = [{
                        id: aid,
                        value: value,
                        lockIO: lockIO
                    }];
                    d.data = {
                        in_data: obj
                    }
                }
                break;
            default:
                break;
            }
            return parent.postMessage(d, "*");
        },
        "setWidth": function (w) {
            w = (w) ? String(w) : "100%";
            let d = {
                title: "setWidth",
                data: w
            }
            return this.post(d)
        },
        "setHeight": function (h) {
            h = (h) ? String(h) : "100%";
            let d = {
                title: "setHeight",
                data: h
            }
            return this.post(d)
        },
        "getViewbox":function(){
            let d = {
                title: "getViewbox"
            }
            return this.post(d)
        },
        "setProject": function (eiid) {
            let url = "https://120.114.170.38/dive/" + eiid + "/player.html?eid="+eiid;
            //  let url = "http://dive.nutn.edu.tw:8080/Experiment/kaleTestExperiment5.jsp?eid=" + eiid + "&record=false"  + "&r=" + Date.now();
            // let url = "http://dive.nutn.edu.tw:8080/Experiment/kaleTestExperiment5.jsp?eid=" + eiid + "&record=false" + "&blockE=" + this.watermark + "&r=" + Date.now();
            this.target.setAttribute("src", url);
            this.reset();
            this._window = (this.target == null) ? null : this.target.contentWindow;
            this.error = (this.target == null) ? true : this.error;
        },
        "getLoadingStatus": function () {
            let d = {
                title: "getLoadingStatus",
            }
            this.post(d)
            return this.loadingStatus
        },
        /**
         * resize dive
         * @param {string} w 
         * @param {string} h 
         */
        "resize": function (w, h) {
            let _w = (w) ? w : "100%";
            let _h = (h) ? h : "100%";
            let d = {
                title: "resize",
                data: {
                    w: _w,
                    h: _h
                }
            }
            return this.post(d)
        },
        "debug": function (is_enable) {
            this.isDebug = is_enable;
            if (is_enable) console.log("open debug mode. show log")
            if (!is_enable) console.log("close debug model.")
            let d = {
                title: "debug",
                data: ""
            }
            return this.post(d)
        },
        "getIOList": function () {
            let d = {
                title: "hello",
                data: ""
            }
            this.post(d)
            return this.IOList
        },
        "getFocus": function () {
            let d = {
                title: "focus"
            }
            this.post(d)
        },
        "start": function () {
            let d = {
                title: "start"
            }
            this.post(d);
        },
        "pause": function () {
            let d = {
                title: "pause"
            }
            this.post(d);
        },
        "stop": function () {
            let d = {
                title: "stop"
            }
            this.post(d);
        },
        "resume": function () {
            let d = {
                title: "resume"
            }
            this.post(d);
        },
        "getLog": function () {
            let d = {
                title: "getLog"
            }
            this.post(d);
            return this.log
        },
        "getAttr": function (attr_id) {
            if (!this.outputList[attr_id]) return this.showError("not find attr")
            return this.outputList[attr_id].value
        },
        "getInputList": function () {
            return this.inputList
        },
        "getOutputList": function () {
            return this.outputList
        },
        "getOutput": function () {
            let d = {
                title: "out_val_2",
            }
            this.post(d);
        },
        "checkComplete": function () {
            return this.isComplete
        },
        "checkDiveStatus": function () {
            let d = {
                title: "check_dive_status"
            }
            this.post(d);
            return this.diveStatus
        },
        "getProject":function(){
            if(typeof this.project !=="undefined")return this.project
            let d = {
                title: "getProject"
            }
            this.post(d);
        },
        "getProjectID": function () {
            try {
                let search_params = new URLSearchParams(new URL(this.target.src).search);
                return search_params.get("eid")
            } catch (error) {
                console.info(error);
                return -1
            }
        },
        "reset": function () {
            this.isDebug = false;
            this.loadingStatus = false;
            this.initial = false;
            this.watermark = true;
            this.isComplete = false;
            this._id = null;
            this.updateOutput = false;
            this.diveStatus = "init";
            this.IOList = {
                inValue: [],
                outValue: []
            };
            this.inputList = {};
            this.outputList = {};
            delete this.project;
        }
    }
})();