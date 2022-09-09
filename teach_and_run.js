let tensorData;
let model;
let data;

let canvas = $('#myCanvas');
let canvasW = canvas.width();
let canvasH = canvas.height();
const inputMax = tf.tensor2d([canvasW, canvasH, canvasW, canvasH], [1, 4]);
const inputMin = tf.tensor2d([0, 0, 0, 0], [1, 4]);
const labelMax = tf.tensor2d([canvasW, canvasH], [1, 2]);
const labelMin = tf.tensor2d([0, 0], [1, 2]);

let normalizationData = {inputMax, inputMin, labelMax, labelMin};

const uploadJSONInput = document.getElementById('upload-json');
const uploadWeightsInput = document.getElementById('upload-weights');

$(document).ready(function () {
    $('#test-btn').click(function () {
        let result = testModel(model, tensorData);
        let testResultsText = $('#test-results');
        testResultsText.val(toJson(result));

        let testSamples;
        if (isChecked($('#hack-cb'))) {
            testSamples = helloWorld;
        } else {
            testSamples = parseCurrentSamples(testResultsText.val());
        }
        if (testSamples.points.length > 0) {
            playMoves(testSamples);
        }
    });
});

async function loadModel() {
    model = await tf.loadLayersModel(tf.io.browserFiles(
        [uploadJSONInput.files[0], uploadWeightsInput.files[0]]));
}

async function saveModel() {
    if (model !== null) {
        await model.save('downloads://2x16_sigmoid');
    } else {
        alert("Train model first.");
    }
}

async function getData() {
    let rawData = parseCurrentSamples(getSamplesText());

    let testDataPrepared = [];
    for (let i = 0; i < rawData.length; i++) {
        let start = rawData[i].A;
        let end = rawData[i].B;
        let points = rawData[i].points;
        points.unshift(start);
        points.push(end);
        for (let j = 0; j < points.length - 1; j++) {
            testDataPrepared.push({
                start: start,
                current: points[j],
                next: points[j + 1],
                goal: end
            });
        }
    }

    return testDataPrepared;
}

async function runTraining() {
    data = await getData();

    const values = data.map(d => ({
        x: d.current.x,
        y: d.current.y,
    }));

    tfvis.render.scatterplot(
        {name: 'Mouse track'},
        {values},
        {
            xLabel: 'x',
            yLabel: 'y',
            zoomToFit: true
        }
    );

    model = createModel();
    tfvis.show.modelSummary({name: 'Model Summary'}, model);

    tensorData = convertToTensor(data);
    const {inputs, labels} = tensorData;

    await trainModel(model, inputs, labels);
    console.log('Done Training');
}

function createModel() {
    const model = tf.sequential();

    model.add(tf.layers.dense({inputShape: [4], units: 1, useBias: true}));
    // model.add(tf.layers.dense({units: 8, activation: 'tanh'}));
    // model.add(tf.layers.dense({units: 8, activation: 'tanh'}));
    model.add(tf.layers.dense({units: 16, activation: 'sigmoid'}));
    model.add(tf.layers.dense({units: 16, activation: 'sigmoid'}));
    // model.add(tf.layers.dense({units: 8, activation: 'tanh'}));
    // model.add(tf.layers.dense({units: 8, activation: 'tanh'}));
    // model.add(tf.layers.dense({units: 8, activation: 'softmax'}));
    model.add(tf.layers.dense({units: 2, useBias: true}));

    return model;
}

function convertToTensor(data) {
    return tf.tidy(() => {
        tf.util.shuffle(data);

        const inputs = data.map(d => ([
            d.current.x - d.start.x,
            d.current.y - d.start.y,
            d.goal.x - d.start.x,
            d.goal.y - d.start.y
        ]));
        const labels = data.map(d => ([
            d.next.x - d.start.x,
            d.next.y - d.start.y
        ]));

        const inputTensor = tf.tensor2d(inputs, [inputs.length, 4]);
        const labelTensor = tf.tensor2d(labels, [labels.length, 2]);

        //Step 3. Normalize the data to the range 0 - 1 using min-max scaling
        /*const inputMax = tf.tensor2d([canvasW, canvasH, canvasW, canvasH], [1, 4]);
        const inputMin = tf.tensor2d([0, 0, 0, 0], [1, 4]);
        const labelMax = tf.tensor2d([canvasW, canvasH], [1, 2]);
        const labelMin = tf.tensor2d([0, 0], [1, 2]);*/

        // const inputMax = inputTensor.max();
        // const inputMin = inputTensor.min();
        // const labelMax = labelTensor.max();
        // const labelMin = labelTensor.min();

        const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
        const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));

        return {
            inputs: normalizedInputs,
            labels: normalizedLabels,
            // inputMax,
            // inputMin,
            // labelMax,
            // labelMin,
        }
    });
}

async function trainModel(model, inputs, labels) {
    model.compile({
        optimizer: tf.train.adam(),
        loss: tf.losses.meanSquaredError,
        metrics: ['mse'],
    });

    const batchSize = 4;
    const epochs = 10;

    return await model.fit(inputs, labels, {
        batchSize,
        epochs,
        shuffle: true,
        callbacks: tfvis.show.fitCallbacks(
            {name: 'Training Performance'},
            ['loss', 'mse'],
            {height: 200, callbacks: ['onEpochEnd']}
        )
    });
}

function hasReachedGoal(point, goal) {
    let p = point.dataSync();
    let g = goal.dataSync();
    let eps = [0.04, 0.04];
    return Math.abs(p[0] - g[0]) <= eps[0] && Math.abs(p[1] - g[1]) <= eps[1];
}

function testModel(model) {
    const {inputMax, inputMin, labelMax, labelMin} = normalizationData;

    let [start, goal] = prepareTestData();

    let resultPoints = tf.tidy(() => {

        const startTensor = tf.tensor2d([0, 0], [1, 2]);
        const goalTensor = tf.tensor2d([goal.x - start.x, goal.y - start.y], [1, 2]);

        let startNormalized = startTensor.sub(labelMin).div(labelMax.sub(labelMin));
        let goalNormalized = goalTensor.sub(labelMin).div(labelMax.sub(labelMin));

        let testPoints = [];
        testPoints.push(startNormalized);

        while(!hasReachedGoal(testPoints[testPoints.length - 1], goalNormalized)
            && testPoints.length <= 1000) {
            let current = testPoints[testPoints.length - 1].dataSync();
            let goalN = goalNormalized.dataSync();
            // let startN = startNormalized.dataSync();
            const currentTensor = tf.tensor2d([current[0], current[1], goalN[0], goalN[1]], [1, 4]);
            // const currentTensor = tf.tensor2d([0, 0, current[0], current[1], goalN[0], goalN[1]], [1, 6]);
            // const currentTensor = tf.tensor2d([startN[0], startN[1], current[0], current[1], goalN[0], goalN[1]], [1, 6]);
            let next = model.predict(currentTensor);
            testPoints.push(next);
        }

        // Un-normalize the data
        return testPoints.map(d => {
            let p = d.mul(labelMax.sub(labelMin)).add(labelMin);
            return p.dataSync();
        });
    });


    const predictedPoints = resultPoints.map((val, i) => {
        return {x: Math.round(val[0] + start.x), y: Math.round(val[1] + start.y), t: i * interval};
    });

    return {
        A: {x: start.x, y: start.y, t: 0},
        B: {x: goal.x, y: goal.y, t: interval * predictedPoints.length},
        points: predictedPoints
    };
}

function prepareTestData() {
    let canvas = $('#myCanvas');
    let canvasW = canvas.width();
    let canvasH = canvas.height();
    let canvasL = canvas.offset().left;
    let canvasT = canvas.offset().top;

    removeCheckboxes();
    clearTimer();
    removeDots();

    let [xA, yA, xB, yB] = generateCheckboxes(canvasL, canvasT, canvasW, canvasH);

    addCheckbox("A", xA, yA);
    addCheckbox("B", xB, yB);
    return [{x: xA + cbSize, y: yA + cbSize}, {x: xB + cbSize, y: yB + cbSize}];
}
