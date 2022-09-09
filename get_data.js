let interval = 20;
let cbSize = 13 / 2;

(function () {
    "use strict";

    let canvas = $('#myCanvas');
    let canvasW = canvas.width();
    let canvasH = canvas.height();
    let mouseArea = $('#cblist');
    let canvasL = canvas.offset().left;
    let canvasT = canvas.offset().top;

    let start;
    let timer;
    let curTime = 0;
    let currentRecordedSample;

    $('#record-btn').click(onRecordClick);
    $('#remove-last-btn').click(onRemoveLastClick);
    $('#play-btn').click(onPlayClick);
    $('#clear-btn').click(onClearClick);
    $('#train-btn').click(onTrainClick);

    $('#save-btn').click(onSaveClick);
    $('#load-btn').click(onLoadClick);

    recordNew();

    function recordNew() {
        removeCheckboxes();
        clearTimer();
        removeDots();

        let [xA, yA, xB, yB] = generateCheckboxes(canvasL, canvasT, canvasW, canvasH);

        currentRecordedSample = {
            A: {x: xA + cbSize, y: yA + cbSize, t: 0},
            B: {x: xB + cbSize, y: yB + cbSize, t: 0},
            points: []
        };

        let cbA = addCheckbox("A", xA, yA);
        let cbB = addCheckbox("B", xB, yB);
        cbA.click(handleCheckboxAClick);
        cbB.click(handleCheckboxBClick);
    }

    function onRecordClick() {
        recordNew();
    }

    function handleMouseMove(event) {
        let cursorX = event.pageX;
        let cursorY = event.pageY;

        let sample = {
            x: cursorX,
            y: cursorY,
            t: curTime
        };
        currentRecordedSample.points.push(sample);
        addDot(cursorX, cursorY);
    }

    function handleCheckboxAClick() {
        start = new Date;
        timer = setInterval(function () {
            curTime = new Date - start;
            setTimer(curTime);
        }, 5);
        currentRecordedSample.A.t = curTime;
        mouseArea.mousemove(handleMouseMove);
    }

    function handleCheckboxBClick() {
        currentRecordedSample.B.t = curTime;
        mouseArea.off('mousemove');
        clearInterval(timer);
        curTime = 0;

        let curSamples = parseCurrentSamples(getSamplesText());
        curSamples.push(currentRecordedSample);
        setSamplesText(toJson(curSamples));
        updateNumOfSamples(curSamples.length);
        recordNew();
    }
})();

function generateCheckboxes(canvasL, canvasT, canvasW, canvasH) {
    if (isChecked($('#mid-h-cb'))) {
        let [xA, yA, xB, yB] = generate2PointsInTheMiddleHeight(canvasL, canvasT, canvasW, canvasH);
        return [xA, yA, xB, yB];
    } else if (isChecked($('#vertical-random-cb'))) {
        let [xA, yA, xB, yB] = generate2PointsOnSameHeight(canvasL, canvasT, canvasW, canvasH);
        return [xA, yA, xB, yB];
    } else if (isChecked($('#horizontal-random-cb'))) {
        let [xA, yA, xB, yB] = generate2PointsOnSameWidth(canvasL, canvasT, canvasW, canvasH);
        return [xA, yA, xB, yB];
    } else if (isChecked($('#vertical-random-diff-cb'))) {
        let [xA, yA, xB, yB] = generate2PointsOnDifferentHeights(canvasL, canvasT, canvasW, canvasH);
        return [xA, yA, xB, yB];
    } else if (isChecked($('#random-cb'))) {
        let [xA, yA, xB, yB] = rand2PointsFurtherThan(canvasL, canvasT, canvasW, canvasH, 200);
        return [xA, yA, xB, yB];
    } else if (isChecked($('#hack-cb'))) {
        let [xA, yA, xB, yB] = generate2PointsInTheMiddleHeight(canvasL, canvasT, canvasW, canvasH);
        return [xA, yA, xB, yB];
    } else {
        let [xA, yA, xB, yB] = generate2PointsInTheMiddleHeight(canvasL, canvasT, canvasW, canvasH);
        return [xA, yA, xB, yB];
    }
}

function isChecked(checkbox) {
    return checkbox.is(':checked');
}

function updateNumOfSamples(num) {
    $('#num-of-samples').text(num);
}

function toJson(samplesObj) {
    return JSON.stringify(samplesObj, undefined, 4);
}

function onRemoveLastClick() {
    let curSamples = parseCurrentSamples(getSamplesText());
    curSamples.pop();
    setSamplesText(toJson(curSamples));
    updateNumOfSamples(curSamples.length);
}

async function onPlayClick() {
    let curSamples = parseCurrentSamples(getSamplesText());
    if (curSamples.length > 0) {
        await playMoves(curSamples[0]);
    }
}

function onClearClick() {
    clearSamplesText();
}

function onTrainClick() {
    runTraining();
}

function onSaveClick() {
    saveModel();
}

function onLoadClick() {
    loadModel();
}

async function playMoves(sample) {
    clearTimer();
    removeCheckboxes();
    removeDots();

    let xAPlay = sample.A.x - cbSize, yAPlay = sample.A.y - cbSize, tAPlay = sample.A.t;
    let xBPlay = sample.B.x - cbSize, yBPlay = sample.B.y - cbSize, tBPlay = (sample.points.length + 1) * interval;

    let cbAPlay = addCheckbox("A", xAPlay, yAPlay);
    let cbBPlay = addCheckbox("B", xBPlay, yBPlay);

    setTimeout(function () {
        cbAPlay.click();
    }, tAPlay);

    sample.points.forEach(function (s, index) {
        setTimeout(function () {
            addDot(s.x, s.y);
            // setTimer(s.t);
        }, index * interval);
    });

    setTimeout(function () {
        cbBPlay.click();
    }, tBPlay);
}

function parseCurrentSamples(samplesText) {
    if (!isEmptyOrSpaces(samplesText)) {
        return JSON.parse(samplesText);
    }
    return [];
}

function distance(xA, yA, xB, yB) {
    return Math.sqrt(Math.pow(xA - xB, 2) + Math.pow(yA - yB, 2));
}

function generate2PointsInTheMiddleHeight(canvasL, canvasT, canvasW, canvasH) {
    let xA = 0 + canvasL;
    let yA = canvasH / 2 + canvasT;
    let xB = canvasW + canvasL;
    let yB = canvasH / 2 + canvasT;

    return [xA, yA, xB, yB];
}

function generate2PointsOnSameHeight(canvasL, canvasT, canvasW, canvasH) {
    let randomHeight = Math.round(Math.random() * canvasH);
    let xA = 0 + canvasL;
    let yA = randomHeight + canvasT;
    let xB = canvasW + canvasL;
    let yB = randomHeight + canvasT;

    return [xA, yA, xB, yB];
}

function generate2PointsOnSameWidth(canvasL, canvasT, canvasW, canvasH) {
    let randomWidth = Math.round(Math.random() * canvasW);
    let xA = randomWidth + canvasL;
    let yA = 0 + canvasT;
    let xB = randomWidth + canvasL;
    let yB = canvasH + canvasT;

    return [xA, yA, xB, yB];
}

function generate2PointsOnDifferentHeights(canvasL, canvasT, canvasW, canvasH) {
    let randomHeightA = Math.round(Math.random() * canvasH);
    let randomHeightB = Math.round(Math.random() * canvasH);
    let xA = 0 + canvasL;
    let yA = randomHeightA + canvasT;
    let xB = canvasW + canvasL;
    let yB = randomHeightB + canvasT;

    return [xA, yA, xB, yB];
}

function rand2PointsFurtherThan(canvasL, canvasT, canvasW, canvasH, minDistance) {
    let xA = Math.round(canvasL + Math.random() * canvasW);
    let yA = Math.round(canvasT + Math.random() * canvasH);
    let xB = Math.round(canvasL + Math.random() * canvasW);
    let yB = Math.round(canvasT + Math.random() * canvasH);

    if (distance(xA, yA, xB, yB) < minDistance) {
        return rand2PointsFurtherThan(canvasL, canvasT, canvasW, canvasH, minDistance);
    }

    return [xA, yA, xB, yB];
}

function addDot(x, y) {
    let dot = document.createElement('div');
    dot.className = "dot";
    dot.style.left = x + "px";
    dot.style.top = y + "px";
    document.body.appendChild(dot);
}

function addCheckbox(name, x, y) {
    let container = $('#cblist');

    let cb = $('<input />', {type: 'checkbox', id: 'cb' + name, value: name, class: "check-box"});
    cb.css({left: x, top: y, position: 'absolute', zIndex: 1000});
    cb.appendTo(container);
    let label = $('<label />', {'for': 'cb' + name, text: name, class: "check-box-label"});
    label.css({left: x + 5, top: y - 15, position: 'absolute'});
    label.appendTo(container);

    return cb;
}

function removeDots() {
    $('.dot').remove();
}

function removeCheckboxes() {
    $('.check-box').remove();
    $('.check-box-label').remove();
}

function clearTimer() {
    $('#Timer').text('');
}

function setTimer(value) {
    $('#Timer').text(value + " ms");
}

function clearSamplesText() {
    $('#samples').val("");
}

function getSamplesText() {
    return $('#samples').val();
}

function setSamplesText(value) {
    $('#samples').val(value);
}

function isEmptyOrSpaces(str) {
    return str === null || str.match(/^ *$/) !== null;
}
