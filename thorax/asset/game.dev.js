//建立I/O控制器，用全域方便學生直接網頁測試
//建立diveWorld => controller
class Scenes {
    constructor(cols, rows, map) {
        this.cols = Number(cols);
        this.rows = Number(rows);
        this.map = map;
        this.now_cols = 0;
        this.now_rows = 0;
    }
    setMap(map) {
        this.map = map
    }
    getMap() {
        return this.map
    }
    getTile(col, row) {
        return this.map[Number(row) * this.cols + Number(col)]
    }
    getIndex(col, row) {
        return Number(row) * this.cols + Number(col)
    }
    getTileByIndex(i) {
        return this.map[i]
    }
    getNowTile() {
        return [this.now_cols, this.now_rows]
    }
    getIndexByPID(pid) {
        return this.map.findIndex((e) => {
            return e == pid
        })
    }
}
class DiveWorld {
    constructor(map, preload_json) {
        this.app = document.querySelector("#dive-app");
        this.loading = document.querySelector(".loading");
        this.preload_json = preload_json;
        this.isInitial = true;
        this.reset = false;
        this.linkers = [];
        this.cache_pids = [];
        this.outputNames = [];
        this.linkerIndex = 0;
        this.index = 0;
        this.scenes = new Scenes(map_col, map_row, map);
        this.prePid = this.pid = this.scenes.getTileByIndex(0);
        this.outputList = this.initOutput();
        this.complete_timer = null;
        this.init_timer = null;
        this.start_timer = null;
        this.input_timer = null;
        this.defaultCount = 6;
        this.init();
    }
    async init() {
        let _world = this;
        this.createPreloadMap();
        window.addEventListener("click", triggerFull, false)
        await this.nextStage();
        this.isInitial = false;
        this.fullScreen()

        function triggerFull() {
            _world.fullScreen();
            _world.hideBlock();
            _world.start();
            _world.hide();
            window.removeEventListener("click", triggerFull, false)
        }
    }
    initIframe(pid) {
        let iframe = document.createElement("iframe");
        iframe.className = "dive preload dive-hide";
        let name = (document.getElementsByName('dive' + pid).length === 0) ? 'dive' + pid : 'dive' + pid + '_1';
        iframe.setAttribute("name", name);
        return iframe
    }
    initLinker(name, option = {}) {
        const linker = new DiveLinker(name, option)
        linker.setProject(linker.pid);
        this.linkers.push(linker);
    }
    /**
     *
     * just append . refactory by Fragment  if need
     * @memberof DiveWorld
     */
    initPreload(pid) {
        // console.log(`init preload ${pid}`);
        let iframe = this.initIframe(pid);
        this.app.appendChild(iframe);
        this.initLinker(iframe.name, {
            watermark: false,
            pid: pid
        });
    }
    bind(func) {
        let world = this;
        return function () {
            return func.apply(world, arguments)
        }
    }
    bindTimer() {
        let linker = this.getNowLinker();
        this.checkTimer("complete_timer");
        this.reset = false;
        this.complete_timer = setInterval(() => {
            if (!linker.checkComplete()) return
            console.warn("go next :" + this.complete_timer);
            clearInterval(this.complete_timer);
            delete this.complete_timer;
            this.sleep(0.1)
                .then(linker.pause())
                .then(this.nextStage())
        }, 100);
    }
    waitInit() {
        return new Promise((resolve, reject) => {
            let linker = this.getNowLinker();
            this.checkTimer("init_timer");
            this.init_timer = setInterval(() => {
                if (!linker.initial) return linker.getIOList()
                clearInterval(this.init_timer)
                delete this.init_timer;
                resolve()
            }, 100);
        });
    }
    checkTimer(timer) {
        if (this[timer]) {
            clearInterval(this[timer]);
            delete this[timer];
        }
    }
    waitStart() {
        return new Promise((resolve, reject) => {
            let linker = this.getNowLinker();
            this.checkTimer("start_timer");
            if (this.isInitial) return resolve()
            this.start_timer = setInterval(() => {
                console.warn("wait start");
                if (linker.checkDiveStatus() !== "start") return this.start()
                clearInterval(this.start_timer);
                delete this.start_timer;
                resolve()
            }, 100);
        });
    }
    update() {
        this.updateScenes();
        this.updateIndex();
    }
    setPreview() {
        this.prePid = this.pid;
        this.pid = this.scenes.getTile(this.scenes.now_cols, this.scenes.now_rows);

        // let preloadPids = this.preloadMap[this.pid];
        let preloadPids = this.getPreloadPidsByCondition(this.pid);
        let saveLinkers = [];
        for (let i = 0; i < this.linkers.length; i++) {
            const linker = this.linkers[i];
            if (linker.pid === this.pid) {
                saveLinkers.push(linker);
                continue
            }
            if (preloadPids.includes(linker.pid)) {
                if (linker.pid === this.prePid) {
                    linker.reset();
                    linker.stop();
                }
                saveLinkers.push(linker);
                this.hide(linker.target);
            } else {
                this.removeLinker(linker);
            }
        }
        this.linkers = saveLinkers;
        // console.log(`now pid ${this.pid}`)
        for (let i = 0; i < preloadPids.length; i++) {
            const preloadPid = preloadPids[i];
            let isExist = this.isLinkerExist(preloadPid);
            if (isExist) continue
            // console.log(`not exist. ${preloadPid}`);
            this.initPreload(preloadPid);
        }
        if (!this.isLinkerExist(this.pid)) {
            //非預設且非設定，直接生成
            this.initPreload(this.pid);
        }
    }
    // fix 20190808 
    async nextStage() {
        if (!this.isInitial) this.updateOutput()
        this.update()
        this.setPreview();
        if (this.isInitial) this.fullScreen()
        // this.startPreload();
        await this.showNext();
        await this.waitInit();
        await this.setInput();
        await this.hideBlock();
        await this.waitStart();
        await this.bindTimer();
    }
    hideBlock() {
        return new Promise((resolve, reject) => {
            try {
                if (this.isInitial) return resolve()
                this.getNowLinker().enableBlock(false);
                resolve();
            } catch (err) {
                console.error('Error: HideWatermark failed!', err);
            }
        });
    }
    start() {
        try {
            this.getNowLinker().start();
            this.focusDIVE();
        } catch (err) {
            console.error('Error: Start DIVE failed!', err);
        }
    }
    getNowLinker() {
        return this.linkers.find((e) => {
            return e.pid === this.pid
        })
    }
    isLinkerExist(pid) {
        return this.linkers.find((e) => {
            return e.pid === pid
        })
    }
    initOutput() {
        let result = {};
        outputs.push(row);
        outputs.push(col);
        for (let i = 0; i < outputs.length; i++) {
            const output = outputs[i];
            //check case by case .foolproof.
            if (typeof output === 'string') {
                result[output] = {
                    name: output,
                    value: 0
                }
                this.outputNames.push(output)
                continue
            }
            if (typeof output === 'object') {
                result[output.name] = {
                    name: output.name,
                    value: output.value
                }
                this.outputNames.push(output.name)
                continue
            }
        }
        return result
    }
    sleep(delay) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, delay * 800);
        });
    }
    updateScenes() {
        this.scenes.now_cols = Number.parseInt((this.get_world_output(col)), 10);
        this.scenes.now_rows = Number.parseInt((this.get_world_output(row)), 10);
    }
    updateOutput() {
        let linker = this.getNowLinker();
        let new_outputs = linker.getOutputList();
        let keep_outputs = this.get_world_outputs();
        for (const key in new_outputs) {
            if (new_outputs.hasOwnProperty(key)) {
                const output = new_outputs[key];
                if (this.outputNames.indexOf(output.name) == -1) continue
                keep_outputs[output.name]["value"] = output.value;
            }
        }
    }

    updateIndex() {
        this.index = this.scenes.getIndex(this.scenes.now_cols, this.scenes.now_rows);
    }
    get_world_outputs() {
        return this.outputList
    }
    get_world_output(name) {
        return this.outputList[name].value
    }
    setInput() {
        return new Promise((resolve, reject) => {
            if (this.isInitial) return resolve()
            let linker = this.getNowLinker();
            this.checkTimer("input_timer");
            this.input_timer = setInterval(() => {
                if (!linker.initial) return
                clearInterval(this.input_timer);
                delete this.input_timer;
                let inputs = linker.getInputList();
                let outputList = this.get_world_outputs();
                let inputArray = [];
                for (const key in inputs) {
                    if (inputs.hasOwnProperty(key)) {
                        const input = inputs[key];
                        if (this.outputNames.indexOf(input.name) == -1) continue
                        let cache_output = outputList[input.name];
                        let obj = {
                            id: input.id,
                            value: cache_output.value
                        }
                        inputArray.push(obj);
                    }
                }
                linker.setInput(inputArray);
                resolve();
            }, 100);
        });
    }
    removeLinker(linker) {
        try {
            linker.target.remove();
        } catch (err) {
            console.error('remove linker faild', linker.pid);
        }
    }
    isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key))
                return false;
        }
        return true;
    }
    /**
     * default is loading
     * @param {HTMLElement} node
     */
    hide(node) {
        if (!node) return this.loading.classList.add("dive-hide")
        node.classList.add("dive-hide")
    }
    /**
     * default is loading
     * @param {HTMLElement} node
     */
    show(node) {
        if (!node) return this.loading.classList.remove("dive-hide")
        node.classList.remove("dive-hide")
    }
    focusDIVE() {
        try {
            this.getNowLinker().target.contentWindow.focus();
        } catch (err) {
            console.error('Error: Focus DIVE failed!', err);
        }
    }
    showNext() {
        return new Promise((resolve, reject) => {
            try {
                let linker = this.getNowLinker();
                this.show(linker.target);
                this.focusDIVE();
                resolve();
            } catch (err) {
                console.error('Error: ShowNext failed!', err);
            }
        });
    }
    fullScreen() {
        if (document.fullscreenEnabled ||
            document.webkitFullscreenEnabled ||
            document.mozFullScreenEnabled ||
            document.msFullscreenEnabled) {
            // Do fullscreen
            if (this.app.requestFullscreen) {
                this.app.requestFullscreen();
            } else if (this.app.webkitRequestFullscreen) {
                this.app.webkitRequestFullscreen();
            } else if (this.app.mozRequestFullScreen) {
                this.app.mozRequestFullScreen();
            } else if (this.app.msRequestFullscreen) {
                this.app.msRequestFullscreen();
            }
        }
    }
    /**
     * 建立預載map.
     */
    createPreloadMap() {
        let preloadMap = this.clone(preload_json);
        for (let i = 0; i < map.length; i++) {
            const _map = map[i];
            if (typeof preloadMap[_map] == 'undefined') {
                preloadMap[_map] = [
                    i - this.scenes.cols,
                    i - 1,
                    i + 1,
                    i + this.scenes.cols
                ]
                if (i == 0) {
                    preloadMap[_map].push(_map);
                }
            }
        }
        this.preloadMap = preloadMap;
    }
    getPreloadPidsByCondition(pid) {
        let preloadPids = this.preloadMap[pid];
        let result = [];
        for (let i = 0; i < preloadPids.length; i++) {
            const preloadSet = preloadPids[i];
            let canReturn = false;
            if (typeof preloadSet === 'number') {
                result = preloadPids;
                break;
            }
            if (typeof preloadSet === 'object') {
                let condis = preloadSet.conditions
                if (condis.length === 0) {
                    result = preloadSet.pids
                    break;
                }
                for (let i = 0; i < preloadSet.conditions.length; i++) {
                    const condi = preloadSet.conditions[i];
                    let passByCondis = true;
                    let attrs = Object.entries(condi);
                    for (let i = 0; i < attrs.length; i++) {
                        const attr = attrs[i];
                        passByCondis = this.isEqualToAttr(attr[0], attr[1]);
                        if (!passByCondis) break
                    }
                    if (passByCondis) {
                        result = preloadSet.pids;
                        canReturn = true;
                        break;
                    }
                }
                if (canReturn) break
            }
        }
        return result
    }
    isEqualToAttr(attrName, value) {
        return (this.get_world_output(attrName) === value)
    }
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    mobilecheck() {
        let check = false;
        (function (a) {
            if (
                /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i
                .test(a) ||
                /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
                .test(a.substr(0, 4))) check = true;
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    };
    /**
     * shakeHand with diveServer
     */
    getID() {
        const soup_ = '!#%()*+,-./:;=?@[]^_`{|}~' +
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const length = 20;
        const soupLength = soup_.length;
        const id = [];
        for (let i = 0; i < length; i++) {
            id[i] = soup_.charAt(Math.random() * soupLength);
        }
        return id.join('');
    }
}
/***************************************** 以下為自訂參數*****************************************/
/**
 * 要傳遞的輸出屬性名稱，請確保每個屬性在各實驗中都設定好I/O並名稱一致
 */
const outputs = [
    "肺活量",
    "結核菌量",
    "性別",
    "年齡",
    "興趣",
    "職業",
    "病史",
    {
        name: "對話",
        value: 1
    },
    "聯絡_姓名",
    "聯絡_電話",
    "聯絡_郵件",
    "聯絡_性別",
    "聯絡_方式",
    "填寫過",
    "map[from]",
    "任務完成1",
    "任務完成2",
    "任務完成3",
    "任務完成4",
    "任務完成5",
    "任務完成6",
    "任務完成7",
    "任務完成8",
    "電影對話3",
    "回診選項",
    "吃藥選項",
    "打掃選項",
    "飲食測",
    {
        name: "配音",
        value: 1
    },
    {
        name: "音效",
        value: 1
    },
    "帳號",
    "version"
];
/**
 * 切換時[範例中進入傳送點時]回傳的地圖[列]
 * 切換時[範例中進入傳送點時]回傳的地圖[行]
 */
const row = "row";
const col = "col";
/***************************以上是I/O屬性設定***************************/

/***************************以下是地圖&地圖參數設定***************************/
const map_col = 4; //地圖行
const map_row = 4; //地圖列
const map = [
    13552, 13137, 13136, 13136,
    13174, 13201, 13223, 13136,
    13189, 13190, 13481, 13136,
    13479, 13480, 13482, 14664
];
//首頁13136
//聊聊首頁13137
//聊聊親友14664
//聊聊醫護13189
//聊聊患者13190
//術前13174
//術中13201
//術後13223
//總首頁13552
//首頁13481$$
//術前13479
//術中13480
//術後13482
/**
 * 「指定預載」可設定專案要預載的專案集合，未指定時採用「預設預載」。
 */
const preload_json = {
    13552: [13136, 13481, 13137],
    13136: [13137, 13174, 13201, 13223, 13552],
    13481: [13137, 13479, 13480, 13482, 13552],
    13137: [{
        conditions: [{
            "version": 0
        }],
        pids: [13479, 13480, 13482]
    }, {
        conditions: [{
            "version": 1
        }],
        pids: [13174, 13201, 13223]
    }],
    13479: [13481, 13137],
    13480: [13481, 13137],
    13482: [13481, 13137],
    13189: [13137],
    13190: [13137],
    13174: [13136, 13137],
    13201: [13136, 13137],
    13223: [13136, 13137],
    14664: [13137]
}
/***************************以上為自訂參數***************************/

//put global. easy to check.
/***********************Code start************************************/
const diveWorld = new DiveWorld(map, preload_json);

setInterval(() => {
    for (const output in diveWorld.outputList) {
        if (diveWorld.outputList.hasOwnProperty(output)) {
            const _out = diveWorld.outputList[output];
            console.log(`name:${_out.name},value:${_out.value}`)
        }
    }
}, 10000);